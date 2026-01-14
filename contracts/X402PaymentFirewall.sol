// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./X402PolicyEngine.sol";

/**
 * @title X402PaymentFirewall
 * @notice Complete x402 Payment Firewall with Intent Registration + Policy Enforcement
 * @dev Combines IntentRegistry + ExecutionRouter into single secure contract
 * 
 * HACKATHON HIGHLIGHT: This is the CORE INNOVATION
 * - Payments MUST be registered as intents before execution
 * - AI/Backend approves or rejects intents off-chain
 * - On-chain enforcement prevents bypass attempts
 * - Full audit trail with events
 */
contract X402PaymentFirewall {
    
    // ============================================================================
    // TYPES
    // ============================================================================
    
    enum IntentStatus { PENDING, APPROVED, REJECTED, EXECUTED, EXPIRED, CANCELLED }
    
    struct PaymentIntent {
        bytes32 intentHash;
        address sender;
        address recipient;
        uint256 amount;
        uint256 expiry;
        IntentStatus status;
        uint256 riskScore;
        string reason;
        uint256 createdAt;
    }
    
    // ============================================================================
    // STATE
    // ============================================================================
    
    X402PolicyEngine public immutable policyEngine;
    address public owner;
    bool public paused;
    
    // Intent storage
    mapping(bytes32 => PaymentIntent) public intents;
    mapping(address => bytes32[]) public senderIntents;
    
    // Authorized agents (can approve/reject intents)
    mapping(address => bool) public authorizedAgents;

    
    // Statistics
    uint256 public totalIntents;
    uint256 public totalApproved;
    uint256 public totalRejected;
    uint256 public totalExecuted;
    uint256 public totalBlocked;
    uint256 public totalVolume;
    
    // Rate limiting
    mapping(address => uint256) public lastPaymentTime;
    uint256 public minPaymentInterval = 0; // seconds between payments (0 = disabled)
    
    // ============================================================================
    // EVENTS
    // ============================================================================
    
    event IntentRegistered(
        bytes32 indexed intentHash,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 expiry
    );
    
    event IntentApproved(
        bytes32 indexed intentHash,
        address indexed agent,
        uint256 riskScore,
        string reason
    );
    
    event IntentRejected(
        bytes32 indexed intentHash,
        address indexed agent,
        uint256 riskScore,
        string reason
    );
    
    event PaymentExecuted(
        bytes32 indexed intentHash,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    event PaymentBlocked(
        bytes32 indexed intentHash,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string reason
    );
    
    event EmergencyPause(address indexed by, uint256 timestamp);
    event EmergencyUnpause(address indexed by, uint256 timestamp);

    
    // ============================================================================
    // MODIFIERS
    // ============================================================================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "X402Firewall: not owner");
        _;
    }
    
    modifier onlyAgent() {
        require(authorizedAgents[msg.sender] || msg.sender == owner, "X402Firewall: not agent");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "X402Firewall: paused");
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor(address _policyEngine) {
        require(_policyEngine != address(0), "X402Firewall: invalid policy engine");
        policyEngine = X402PolicyEngine(_policyEngine);
        owner = msg.sender;
        authorizedAgents[msg.sender] = true;
    }
    
    // ============================================================================
    // INTENT REGISTRATION (Step 1: User registers intent)
    // ============================================================================
    
    /**
     * @notice Register a payment intent for approval
     * @param recipient Address to receive payment
     * @param amount Amount in wei
     * @param validFor How long the intent is valid (seconds)
     * @return intentHash Unique identifier for this intent
     */
    function registerIntent(
        address recipient,
        uint256 amount,
        uint256 validFor
    ) external whenNotPaused returns (bytes32 intentHash) {
        require(recipient != address(0), "X402Firewall: invalid recipient");
        require(amount > 0, "X402Firewall: zero amount");
        require(validFor > 0 && validFor <= 7 days, "X402Firewall: invalid validity");
        
        // Generate unique hash
        intentHash = keccak256(abi.encodePacked(
            msg.sender,
            recipient,
            amount,
            block.timestamp,
            totalIntents
        ));
        
        require(intents[intentHash].createdAt == 0, "X402Firewall: intent exists");
        
        // Store intent
        intents[intentHash] = PaymentIntent({
            intentHash: intentHash,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            expiry: block.timestamp + validFor,
            status: IntentStatus.PENDING,
            riskScore: 0,
            reason: "",
            createdAt: block.timestamp
        });
        
        senderIntents[msg.sender].push(intentHash);
        totalIntents++;
        
        emit IntentRegistered(intentHash, msg.sender, recipient, amount, block.timestamp + validFor);
        
        return intentHash;
    }

    
    // ============================================================================
    // INTENT APPROVAL (Step 2: Agent approves/rejects)
    // ============================================================================
    
    /**
     * @notice Approve a payment intent (called by authorized agent)
     * @param intentHash The intent to approve
     * @param riskScore Risk score from AI evaluation (0-100)
     * @param reason Explanation for the decision
     */
    function approveIntent(
        bytes32 intentHash,
        uint256 riskScore,
        string calldata reason
    ) external onlyAgent {
        PaymentIntent storage intent = intents[intentHash];
        require(intent.createdAt > 0, "X402Firewall: intent not found");
        require(intent.status == IntentStatus.PENDING, "X402Firewall: not pending");
        require(block.timestamp < intent.expiry, "X402Firewall: expired");
        
        intent.status = IntentStatus.APPROVED;
        intent.riskScore = riskScore;
        intent.reason = reason;
        totalApproved++;
        
        emit IntentApproved(intentHash, msg.sender, riskScore, reason);
    }
    
    /**
     * @notice Reject a payment intent (called by authorized agent)
     */
    function rejectIntent(
        bytes32 intentHash,
        uint256 riskScore,
        string calldata reason
    ) external onlyAgent {
        PaymentIntent storage intent = intents[intentHash];
        require(intent.createdAt > 0, "X402Firewall: intent not found");
        require(intent.status == IntentStatus.PENDING, "X402Firewall: not pending");
        
        intent.status = IntentStatus.REJECTED;
        intent.riskScore = riskScore;
        intent.reason = reason;
        totalRejected++;
        
        emit IntentRejected(intentHash, msg.sender, riskScore, reason);
    }
    
    // ============================================================================
    // PAYMENT EXECUTION (Step 3: User executes approved intent)
    // ============================================================================
    
    /**
     * @notice Execute an approved payment intent
     * @dev Requires: intent approved + policy check passes + correct value sent
     * @param intentHash The approved intent to execute
     */
    function executeIntent(bytes32 intentHash) external payable whenNotPaused {
        PaymentIntent storage intent = intents[intentHash];
        
        // Validate intent
        require(intent.createdAt > 0, "X402Firewall: intent not found");
        require(intent.sender == msg.sender, "X402Firewall: not intent sender");
        require(intent.status == IntentStatus.APPROVED, "X402Firewall: not approved");
        require(block.timestamp < intent.expiry, "X402Firewall: expired");
        require(msg.value == intent.amount, "X402Firewall: wrong amount");
        
        // Rate limiting check
        if (minPaymentInterval > 0) {
            require(
                block.timestamp >= lastPaymentTime[msg.sender] + minPaymentInterval,
                "X402Firewall: rate limited"
            );
        }
        
        // Policy check (double enforcement)
        (bool allowed, string memory reason) = policyEngine.evaluate(
            msg.sender,
            intent.recipient,
            msg.value
        );
        
        if (!allowed) {
            intent.status = IntentStatus.REJECTED;
            totalBlocked++;
            emit PaymentBlocked(intentHash, msg.sender, intent.recipient, msg.value, reason);
            revert(string(abi.encodePacked("X402Firewall: ", reason)));
        }
        
        // Execute transfer
        intent.status = IntentStatus.EXECUTED;
        lastPaymentTime[msg.sender] = block.timestamp;
        totalExecuted++;
        totalVolume += msg.value;
        
        (bool success, ) = payable(intent.recipient).call{value: msg.value}("");
        require(success, "X402Firewall: transfer failed");
        
        emit PaymentExecuted(intentHash, msg.sender, intent.recipient, msg.value, block.timestamp);
    }

    
    // ============================================================================
    // DIRECT EXECUTION (Bypass intent for trusted senders)
    // ============================================================================
    
    /**
     * @notice Execute payment directly (policy check only, no intent required)
     * @dev For backwards compatibility and simple use cases
     */
    function executePayment(address recipient) external payable whenNotPaused {
        require(recipient != address(0), "X402Firewall: invalid recipient");
        require(msg.value > 0, "X402Firewall: zero amount");
        
        // Rate limiting
        if (minPaymentInterval > 0) {
            require(
                block.timestamp >= lastPaymentTime[msg.sender] + minPaymentInterval,
                "X402Firewall: rate limited"
            );
        }
        
        // Policy check
        (bool allowed, string memory reason) = policyEngine.evaluate(
            msg.sender,
            recipient,
            msg.value
        );
        
        if (!allowed) {
            totalBlocked++;
            emit PaymentBlocked(bytes32(0), msg.sender, recipient, msg.value, reason);
            revert(string(abi.encodePacked("X402Firewall: ", reason)));
        }
        
        // Execute
        lastPaymentTime[msg.sender] = block.timestamp;
        totalExecuted++;
        totalVolume += msg.value;
        
        (bool success, ) = payable(recipient).call{value: msg.value}("");
        require(success, "X402Firewall: transfer failed");
        
        emit PaymentExecuted(bytes32(0), msg.sender, recipient, msg.value, block.timestamp);
    }
    
    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================
    
    function getIntent(bytes32 intentHash) external view returns (PaymentIntent memory) {
        return intents[intentHash];
    }
    
    function getSenderIntents(address sender) external view returns (bytes32[] memory) {
        return senderIntents[sender];
    }
    
    function getStats() external view returns (
        uint256 _totalIntents,
        uint256 _totalApproved,
        uint256 _totalRejected,
        uint256 _totalExecuted,
        uint256 _totalBlocked,
        uint256 _totalVolume
    ) {
        return (totalIntents, totalApproved, totalRejected, totalExecuted, totalBlocked, totalVolume);
    }
    
    function simulatePayment(
        address sender,
        address recipient,
        uint256 amount
    ) external view returns (bool allowed, string memory reason) {
        if (paused) return (false, "Firewall paused");
        if (recipient == address(0)) return (false, "Invalid recipient");
        if (amount == 0) return (false, "Zero amount");
        return policyEngine.evaluateView(sender, recipient, amount);
    }
    
    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================
    
    function addAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = true;
    }
    
    function removeAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = false;
    }
    
    function setMinPaymentInterval(uint256 interval) external onlyOwner {
        minPaymentInterval = interval;
    }
    
    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPause(msg.sender, block.timestamp);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpause(msg.sender, block.timestamp);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    // Reject direct transfers
    receive() external payable {
        revert("X402Firewall: use executePayment()");
    }
}