// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title X402PolicyEngine
 * @notice On-chain policy enforcement for x402 Intent Firewall
 * @dev Receives x402 payment requests, applies policy rules, and enforces decisions
 *
 * This contract serves as the enforcement layer for the AI-powered middleware.
 * The AI agent (off-chain) makes decisions, but this contract validates and
 * applies them on-chain with gas-efficient policy checks.
 */

contract X402PolicyEngine {
  // ============================================================================
  // TYPES
  // ============================================================================

  /// @notice Possible payment decision states
  enum Decision {
    ALLOW,
    BLOCK,
    LIMIT,
    DELAY
  }

  /// @notice Policy configuration per recipient
  struct RecipientPolicy {
    bool exists;
    uint256 maxAmountPerTx; // max CRO per single transaction
    uint256 maxAmountPerDay; // max CRO per day
    uint256 minDelayBetweenTx; // min seconds between txs
    bool isBlacklisted;
    address[] allowedSenders; // empty = any sender allowed
  }

  /// @notice Payment attempt record
  struct PaymentAttempt {
    address sender;
    address recipient;
    uint256 amount;
    uint256 timestamp;
    Decision decision;
    string reason;
  }

  /// @notice Agent authorization record
  struct AgentPermission {
    bool active;
    uint256 revokeAt; // 0 = no expiration, otherwise block.timestamp when revoked
    string[] permissions; // "EVALUATE", "ENFORCE", etc
  }

  // ============================================================================
  // STATE
  // ============================================================================

  address public owner;
  mapping(address => AgentPermission) public agents;
  mapping(address => RecipientPolicy) public policies;
  mapping(address => uint256) public lastPaymentTime; // recipient -> timestamp
  mapping(address => uint256) public dailySpent; // recipient -> amount spent today
  mapping(address => uint256) public dailySpentResetAt; // recipient -> when to reset counter

  PaymentAttempt[] public attemptHistory;

  // ============================================================================
  // EVENTS
  // ============================================================================

  event PaymentDecisionRecorded(
    address indexed recipient,
    address indexed sender,
    uint256 amount,
    Decision indexed decision,
    string reason
  );

  event PolicyUpdated(
    address indexed recipient,
    uint256 maxAmountPerTx,
    uint256 maxAmountPerDay,
    uint256 minDelayBetweenTx
  );

  event AgentAuthorized(address indexed agent, string[] permissions);
  event AgentRevoked(address indexed agent);
  event PolicyRecipientBlacklisted(address indexed recipient, bool isBlacklisted);

  // ============================================================================
  // MODIFIERS
  // ============================================================================

  modifier onlyOwner() {
    require(msg.sender == owner, "X402: only owner");
    _;
  }

  modifier onlyAuthorizedAgent() {
    require(
      agents[msg.sender].active && agents[msg.sender].revokeAt == 0,
      "X402: agent not authorized"
    );
    _;
  }

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor() {
    owner = msg.sender;
  }

  // ============================================================================
  // AGENT MANAGEMENT
  // ============================================================================

  /// @notice Authorize an AI agent to make payment decisions
  /// @param agent Address of the AI agent service
  /// @param permissions Array of permission strings (e.g., "EVALUATE", "ENFORCE")
  function authorizeAgent(address agent, string[] calldata permissions) external onlyOwner {
    require(agent != address(0), "X402: invalid agent address");
    agents[agent] = AgentPermission({
      active: true,
      revokeAt: 0,
      permissions: permissions
    });
    emit AgentAuthorized(agent, permissions);
  }

  /// @notice Revoke an agent's authorization
  /// @param agent Address of the agent to revoke
  function revokeAgent(address agent) external onlyOwner {
    agents[agent].revokeAt = block.timestamp;
    emit AgentRevoked(agent);
  }

  // ============================================================================
  // POLICY MANAGEMENT
  // ============================================================================

  /// @notice Set policy for a recipient address
  /// @param recipient The recipient whose policy to configure
  /// @param maxPerTx Maximum CRO per transaction
  /// @param maxPerDay Maximum CRO per day
  /// @param minDelay Minimum delay between transactions (seconds)
  function setPolicyForRecipient(
    address recipient,
    uint256 maxPerTx,
    uint256 maxPerDay,
    uint256 minDelay
  ) external onlyOwner {
    require(recipient != address(0), "X402: invalid recipient");
    policies[recipient] = RecipientPolicy({
      exists: true,
      maxAmountPerTx: maxPerTx,
      maxAmountPerDay: maxPerDay,
      minDelayBetweenTx: minDelay,
      isBlacklisted: false,
      allowedSenders: new address[](0)
    });
    emit PolicyUpdated(recipient, maxPerTx, maxPerDay, minDelay);
  }

  /// @notice Blacklist/whitelist a recipient
  /// @param recipient Address to update
  /// @param blacklist True to blacklist, false to remove from blacklist
  function setRecipientBlacklist(address recipient, bool blacklist) external onlyOwner {
    require(policies[recipient].exists, "X402: policy does not exist for recipient");
    policies[recipient].isBlacklisted = blacklist;
    emit PolicyRecipientBlacklisted(recipient, blacklist);
  }

  // ============================================================================
  // CORE: EVALUATE PAYMENT DECISION
  // ============================================================================

  /// @notice Evaluate payment against on-chain policy rules
  /// @param recipient Address receiving the payment
  /// @param amount Amount of CRO being requested
  /// @return decision The policy enforcement decision
  /// @return reason Explanation for the decision
  function evaluatePayment(
    address recipient,
    uint256 amount
  ) external view onlyAuthorizedAgent returns (Decision, string memory) {
    // Check if recipient is blacklisted
    if (policies[recipient].isBlacklisted) {
      return (Decision.BLOCK, "Recipient blacklisted");
    }

    // If no policy exists, default ALLOW
    if (!policies[recipient].exists) {
      return (Decision.ALLOW, "No policy configured");
    }

    RecipientPolicy memory policy = policies[recipient];

    // Check max per transaction
    if (amount > policy.maxAmountPerTx) {
      uint256 adjustedAmount = policy.maxAmountPerTx;
      return (
        Decision.LIMIT,
        string(abi.encodePacked("Amount exceeds max per tx. Limited to ", _uintToString(adjustedAmount)))
      );
    }

    // Check daily limit
    uint256 spent = _getDailySpent(recipient);
    if (spent + amount > policy.maxAmountPerDay) {
      return (
        Decision.LIMIT,
        string(
          abi.encodePacked(
            "Exceeds daily limit. Remaining: ",
            _uintToString(policy.maxAmountPerDay - spent)
          )
        )
      );
    }

    // Check min delay between transactions
    uint256 lastTxTime = lastPaymentTime[recipient];
    if (lastTxTime > 0 && block.timestamp - lastTxTime < policy.minDelayBetweenTx) {
      uint256 delayUntil = lastTxTime + policy.minDelayBetweenTx;
      return (
        Decision.DELAY,
        string(
          abi.encodePacked(
            "Min delay not met. Retry after ",
            _uintToString(delayUntil)
          )
        )
      );
    }

    // All checks passed
    return (Decision.ALLOW, "Policy checks passed");
  }

  // ============================================================================
  // CORE: RECORD AND ENFORCE DECISION
  // ============================================================================

  /// @notice Record a payment decision from the AI agent (off-chain middleware)
  /// @param sender Address attempting payment
  /// @param recipient Address receiving payment
  /// @param amount Amount of CRO
  /// @param decision The AI agent's decision
  /// @param reason Explanation from the AI agent
  function recordDecision(
    address sender,
    address recipient,
    uint256 amount,
    Decision decision,
    string calldata reason
  ) external onlyAuthorizedAgent {
    PaymentAttempt memory attempt = PaymentAttempt({
      sender: sender,
      recipient: recipient,
      amount: amount,
      timestamp: block.timestamp,
      decision: decision,
      reason: reason
    });

    attemptHistory.push(attempt);

    // Update tracking if decision is ALLOW or LIMIT
    if (decision == Decision.ALLOW || decision == Decision.LIMIT) {
      lastPaymentTime[recipient] = block.timestamp;
      _addToDailySpent(recipient, amount);
    }

    emit PaymentDecisionRecorded(recipient, sender, amount, decision, reason);
  }

  // ============================================================================
  // QUERY FUNCTIONS
  // ============================================================================

  /// @notice Get total number of recorded payment attempts
  function getAttemptCount() external view returns (uint256) {
    return attemptHistory.length;
  }

  /// @notice Get a specific payment attempt
  function getAttempt(uint256 index)
    external
    view
    returns (
      address sender,
      address recipient,
      uint256 amount,
      uint256 timestamp,
      Decision decision,
      string memory reason
    )
  {
    require(index < attemptHistory.length, "X402: invalid attempt index");
    PaymentAttempt memory attempt = attemptHistory[index];
    return (
      attempt.sender,
      attempt.recipient,
      attempt.amount,
      attempt.timestamp,
      attempt.decision,
      attempt.reason
    );
  }

  /// @notice Get last N payment attempts
  function getRecentAttempts(uint256 count)
    external
    view
    returns (PaymentAttempt[] memory)
  {
    uint256 length = attemptHistory.length;
    uint256 start = length > count ? length - count : 0;
    PaymentAttempt[] memory recent = new PaymentAttempt[](length - start);

    for (uint256 i = start; i < length; i++) {
      recent[i - start] = attemptHistory[i];
    }
    return recent;
  }

  /// @notice Check if an agent is currently authorized
  function isAgentAuthorized(address agent) external view returns (bool) {
    return agents[agent].active && agents[agent].revokeAt == 0;
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /// @dev Calculate daily spent amount, resetting if day has changed
  function _getDailySpent(address recipient) internal view returns (uint256) {
    // Simple day-based tracking: if last reset was today, return accumulated
    if (dailySpentResetAt[recipient] + 1 days > block.timestamp) {
      return dailySpent[recipient];
    }
    return 0;
  }

  /// @dev Add amount to daily spent, resetting if day has changed
  function _addToDailySpent(address recipient, uint256 amount) internal {
    if (dailySpentResetAt[recipient] + 1 days > block.timestamp) {
      dailySpent[recipient] += amount;
    } else {
      dailySpent[recipient] = amount;
      dailySpentResetAt[recipient] = block.timestamp;
    }
  }

  /// @dev Convert uint to string for error messages
  function _uintToString(uint256 value) internal pure returns (string memory) {
    if (value == 0) return "0";
    uint256 temp = value;
    uint256 digits = 0;
    while (temp != 0) {
      digits++;
      temp /= 10;
    }
    bytes memory buffer = new bytes(digits);
    while (value != 0) {
      digits--;
      buffer[digits] = bytes1(uint8(48 + (value % 10)));
      value /= 10;
    }
    return string(buffer);
  }
}
