// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title X402IntentRegistry
 * @notice Registers and tracks x402 payment intent approvals
 * @dev Core component of the Intent Firewall - no execution without registration
 * 
 * This contract is the AUTHORIZATION BOUNDARY for the x402 Intent Firewall.
 * All payment intents MUST be registered and approved here before execution.
 */
contract X402IntentRegistry {
    
    // ============================================================================
    // TYPES
    // ============================================================================
    
    enum IntentStatus {
        PENDING,    // Registered but not yet evaluated
        APPROVED,   // Approved by AI agent - ready for execution
        REJECTED,   // Rejected by AI agent - cannot execute
        EXECUTED,   // Successfully executed
        EXPIRED,    // Past expiry timestamp
        CANCELLED   // Cancelled by sender
    }
    
    struct IntentRecord {
        bytes32 intentHash;      // Unique identifier
        address sender;          // Who submitted the intent
        address recipient;       // Who receives the payment
        uint256 amount;          // Amount in wei
        uint256 chainId;         // Target chain (must match)
        uint256 expiry;          // Unix timestamp when intent expires
        IntentStatus status;     // Current status
        uint256 riskScore;       // AI-computed risk score (0-100)
        string policyReason;     // Human-readable decision reason
        uint256 registeredAt;    // When intent was registered
        address approvedBy;      // Agent that approved/rejected
    }

    // ============================================================================
    // STATE
    // ============================================================================
    
    address public owner;
    mapping(bytes32 => IntentRecord) public intents;
    mapping(address => bool) public authorizedAgents;
    
    // Statistics
    uint256 public totalIntents;
    uint256 public approvedCount;
    uint256 public rejectedCount;
    uint256 public executedCount;
    
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
    
    event IntentExecuted(
        bytes32 indexed intentHash,
        address indexed executor
    );
    
    event IntentCancelled(
        bytes32 indexed intentHash,
        address indexed sender
    );
    
    event AgentAuthorized(address indexed agent);
    event AgentRevoked(address indexed agent);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // ============================================================================
    // MODIFIERS
    // ============================================================================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "X402Registry: only owner");
        _;
    }
    
    modifier onlyAuthorizedAgent() {
        require(authorizedAgents[msg.sender], "X402Registry: agent not authorized");
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    // ============================================================================
    // AGENT MANAGEMENT
    // ============================================================================
    
    /**
     * @notice Authorize an agent to approve/reject intents
     * @param agent Address of the AI agent service
     */
    function authorizeAgent(address agent) external onlyOwner {
        require(agent != address(0), "X402Registry: invalid agent");
        authorizedAgents[agent] = true;
        emit AgentAuthorized(agent);
    }
    
    /**
     * @notice Revoke agent authorization
     * @param agent Address of the agent to revoke
     */
    function revokeAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = false;
        emit AgentRevoked(agent);
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner Address of new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "X402Registry: invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ============================================================================
    // INTENT REGISTRATION
    // ============================================================================
    
    /**
     * @notice Compute the intent hash for a payment intent
     * @dev This hash uniquely identifies an intent and prevents tampering
     */
    function computeIntentHash(
        address sender,
        address recipient,
        uint256 amount,
        uint256 chainId,
        uint256 expiry,
        bytes32 memoHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            "x402-intent-v1",
            sender,
            recipient,
            amount,
            chainId,
            expiry,
            memoHash
        ));
    }
    
    /**
     * @notice Register a new intent (called by backend after simulation)
     * @param intentHash Pre-computed intent hash
     * @param sender Address submitting the intent
     * @param recipient Address receiving the payment
     * @param amount Amount in wei
     * @param expiry Unix timestamp when intent expires
     */
    function registerIntent(
        bytes32 intentHash,
        address sender,
        address recipient,
        uint256 amount,
        uint256 expiry
    ) external onlyAuthorizedAgent {
        require(intents[intentHash].registeredAt == 0, "X402Registry: intent exists");
        require(sender != address(0), "X402Registry: invalid sender");
        require(recipient != address(0), "X402Registry: invalid recipient");
        require(amount > 0, "X402Registry: invalid amount");
        require(expiry > block.timestamp, "X402Registry: already expired");
        
        intents[intentHash] = IntentRecord({
            intentHash: intentHash,
            sender: sender,
            recipient: recipient,
            amount: amount,
            chainId: block.chainid,
            expiry: expiry,
            status: IntentStatus.PENDING,
            riskScore: 0,
            policyReason: "",
            registeredAt: block.timestamp,
            approvedBy: address(0)
        });
        
        totalIntents++;
        
        emit IntentRegistered(intentHash, sender, recipient, amount, expiry);
    }
    
    // ============================================================================
    // INTENT APPROVAL / REJECTION
    // ============================================================================
    
    /**
     * @notice Approve an intent (called by AI agent after policy evaluation)
     * @dev This is the CRITICAL x402 authorization step
     * @param intentHash Hash of the intent to approve
     * @param riskScore AI-computed risk score (0-100)
     * @param policyReason Human-readable explanation
     */
    function approveIntent(
        bytes32 intentHash,
        uint256 riskScore,
        string calldata policyReason
    ) external onlyAuthorizedAgent {
        IntentRecord storage intent = intents[intentHash];
        require(intent.registeredAt > 0, "X402Registry: intent not found");
        require(intent.status == IntentStatus.PENDING, "X402Registry: not pending");
        require(intent.expiry > block.timestamp, "X402Registry: expired");
        require(riskScore <= 100, "X402Registry: invalid risk score");
        
        intent.status = IntentStatus.APPROVED;
        intent.riskScore = riskScore;
        intent.policyReason = policyReason;
        intent.approvedBy = msg.sender;
        
        approvedCount++;
        
        emit IntentApproved(intentHash, msg.sender, riskScore, policyReason);
    }
    
    /**
     * @notice Reject an intent
     * @param intentHash Hash of the intent to reject
     * @param riskScore AI-computed risk score (0-100)
     * @param policyReason Human-readable explanation for rejection
     */
    function rejectIntent(
        bytes32 intentHash,
        uint256 riskScore,
        string calldata policyReason
    ) external onlyAuthorizedAgent {
        IntentRecord storage intent = intents[intentHash];
        require(intent.registeredAt > 0, "X402Registry: intent not found");
        require(intent.status == IntentStatus.PENDING, "X402Registry: not pending");
        
        intent.status = IntentStatus.REJECTED;
        intent.riskScore = riskScore;
        intent.policyReason = policyReason;
        intent.approvedBy = msg.sender;
        
        rejectedCount++;
        
        emit IntentRejected(intentHash, msg.sender, riskScore, policyReason);
    }
    
    /**
     * @notice Cancel an intent (only sender can cancel their own pending intent)
     * @param intentHash Hash of the intent to cancel
     */
    function cancelIntent(bytes32 intentHash) external {
        IntentRecord storage intent = intents[intentHash];
        require(intent.registeredAt > 0, "X402Registry: intent not found");
        require(intent.sender == msg.sender, "X402Registry: not sender");
        require(intent.status == IntentStatus.PENDING, "X402Registry: not pending");
        
        intent.status = IntentStatus.CANCELLED;
        
        emit IntentCancelled(intentHash, msg.sender);
    }

    // ============================================================================
    // EXECUTION TRACKING
    // ============================================================================
    
    /**
     * @notice Check if an intent is approved and valid for execution
     * @dev Called by ExecutionRouter before transferring funds
     * @param intentHash Hash of the intent to check
     * @return True if intent is approved and not expired
     */
    function isIntentApproved(bytes32 intentHash) external view returns (bool) {
        IntentRecord storage intent = intents[intentHash];
        return intent.status == IntentStatus.APPROVED && 
               intent.expiry > block.timestamp;
    }
    
    /**
     * @notice Mark intent as executed (called by ExecutionRouter after successful transfer)
     * @param intentHash Hash of the executed intent
     */
    function markExecuted(bytes32 intentHash) external {
        IntentRecord storage intent = intents[intentHash];
        require(intent.status == IntentStatus.APPROVED, "X402Registry: not approved");
        require(intent.expiry > block.timestamp, "X402Registry: expired");
        
        intent.status = IntentStatus.EXECUTED;
        executedCount++;
        
        emit IntentExecuted(intentHash, msg.sender);
    }
    
    // ============================================================================
    // QUERY FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Get full intent details
     * @param intentHash Hash of the intent
     * @return Intent record
     */
    function getIntent(bytes32 intentHash) external view returns (IntentRecord memory) {
        return intents[intentHash];
    }
    
    /**
     * @notice Get intent status
     * @param intentHash Hash of the intent
     * @return Current status
     */
    function getIntentStatus(bytes32 intentHash) external view returns (IntentStatus) {
        IntentRecord storage intent = intents[intentHash];
        
        // Check if expired
        if (intent.registeredAt > 0 && 
            intent.status != IntentStatus.EXECUTED &&
            intent.status != IntentStatus.REJECTED &&
            intent.status != IntentStatus.CANCELLED &&
            intent.expiry <= block.timestamp) {
            return IntentStatus.EXPIRED;
        }
        
        return intent.status;
    }
    
    /**
     * @notice Check if an agent is authorized
     * @param agent Address to check
     * @return True if authorized
     */
    function isAgentAuthorized(address agent) external view returns (bool) {
        return authorizedAgents[agent];
    }
    
    /**
     * @notice Get registry statistics
     * @return total Total intents registered
     * @return approved Number of approved intents
     * @return rejected Number of rejected intents
     * @return executed Number of executed intents
     */
    function getStats() external view returns (
        uint256 total,
        uint256 approved,
        uint256 rejected,
        uint256 executed
    ) {
        return (totalIntents, approvedCount, rejectedCount, executedCount);
    }
}
