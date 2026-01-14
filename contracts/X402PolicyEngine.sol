// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title X402PolicyEngine
 * @notice Deterministic on-chain policy checker for x402 payments
 * @dev Called by X402ExecutionRouter BEFORE any funds move
 * 
 * This contract contains NO trust assumptions:
 * - All rules are deterministic and auditable
 * - No off-chain data, no oracles, no AI
 * - Returns (bool allowed, string reason) for every check
 */
contract X402PolicyEngine {
    
    // ============================================================================
    // STATE
    // ============================================================================
    
    address public owner;
    
    // Global policies
    uint256 public globalMaxPayment;           // Max single payment (0 = unlimited)
    uint256 public globalDailyLimit;           // Max daily spend per sender (0 = unlimited)
    bool public globalWhitelistEnabled;        // If true, only whitelisted recipients allowed
    
    // Per-sender policies
    mapping(address => uint256) public senderMaxPayment;      // Per-sender cap (0 = use global)
    mapping(address => uint256) public senderDailyLimit;      // Per-sender daily limit
    mapping(address => bool) public senderBlocked;            // Blocked senders
    
    // Per-recipient policies  
    mapping(address => bool) public recipientBlacklist;       // Blocked recipients
    mapping(address => bool) public recipientWhitelist;       // Allowed recipients (if whitelist enabled)
    
    // Per-sender-recipient policies
    mapping(address => mapping(address => bool)) public senderRecipientAllowed;  // Sender can pay recipient
    mapping(address => mapping(address => uint256)) public senderRecipientMax;   // Max per recipient
    
    // Tracking for daily limits
    mapping(address => uint256) public senderDailySpent;      // Amount spent today
    mapping(address => uint256) public senderDayStart;        // When current day started
    
    // ============================================================================
    // EVENTS
    // ============================================================================
    
    event PolicyUpdated(string indexed policyType, address indexed target, uint256 value);
    event SenderBlocked(address indexed sender, bool blocked);
    event RecipientBlacklisted(address indexed recipient, bool blacklisted);
    event RecipientWhitelisted(address indexed recipient, bool whitelisted);
    
    // ============================================================================
    // MODIFIERS
    // ============================================================================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "X402Policy: not owner");
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor() {
        owner = msg.sender;
        globalMaxPayment = 100000 ether;  // 100,000 CRO default max
        globalDailyLimit = 500000 ether;  // 500,000 CRO daily default
        globalWhitelistEnabled = false;   // Whitelist disabled by default
    }

    // ============================================================================
    // CORE: POLICY EVALUATION (Called by ExecutionRouter)
    // ============================================================================
    
    /**
     * @notice Evaluate a payment against all policies
     * @dev This is the ONLY function the router needs to call
     * @param sender The address paying (msg.sender in router)
     * @param recipient The address receiving payment
     * @param amount The payment amount in wei
     * @return allowed True if payment passes all policies
     * @return reason Human-readable explanation if denied
     */
    function evaluate(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool allowed, string memory reason) {
        
        // ====== CHECK 1: Sender not blocked ======
        if (senderBlocked[sender]) {
            return (false, "Sender is blocked");
        }
        
        // ====== CHECK 2: Recipient not blacklisted ======
        if (recipientBlacklist[recipient]) {
            return (false, "Recipient is blacklisted");
        }
        
        // ====== CHECK 3: Whitelist check (if enabled) ======
        if (globalWhitelistEnabled && !recipientWhitelist[recipient]) {
            return (false, "Recipient not whitelisted");
        }
        
        // ====== CHECK 4: Amount cap ======
        uint256 maxPayment = senderMaxPayment[sender];
        if (maxPayment == 0) {
            maxPayment = globalMaxPayment;
        }
        if (maxPayment > 0 && amount > maxPayment) {
            return (false, "Amount exceeds maximum");
        }
        
        // ====== CHECK 5: Per-recipient cap ======
        uint256 recipientMax = senderRecipientMax[sender][recipient];
        if (recipientMax > 0 && amount > recipientMax) {
            return (false, "Amount exceeds recipient limit");
        }
        
        // ====== CHECK 6: Daily limit ======
        uint256 dailyLimit = senderDailyLimit[sender];
        if (dailyLimit == 0) {
            dailyLimit = globalDailyLimit;
        }
        if (dailyLimit > 0) {
            _updateDailyTracking(sender);
            if (senderDailySpent[sender] + amount > dailyLimit) {
                return (false, "Daily limit exceeded");
            }
            // Update spent amount
            senderDailySpent[sender] += amount;
        }
        
        // ====== CHECK 7: Sender-recipient allowlist (if configured) ======
        // Only check if sender has explicit recipient restrictions
        if (senderRecipientMax[sender][address(0)] > 0) {
            // Sender has restrictions configured
            if (!senderRecipientAllowed[sender][recipient]) {
                return (false, "Recipient not allowed for sender");
            }
        }
        
        // All checks passed
        return (true, "Policy checks passed");
    }
    
    /**
     * @notice View-only policy check (for simulation)
     * @dev Does NOT update daily tracking
     */
    function evaluateView(
        address sender,
        address recipient,
        uint256 amount
    ) external view returns (bool allowed, string memory reason) {
        
        if (senderBlocked[sender]) {
            return (false, "Sender is blocked");
        }
        
        if (recipientBlacklist[recipient]) {
            return (false, "Recipient is blacklisted");
        }
        
        if (globalWhitelistEnabled && !recipientWhitelist[recipient]) {
            return (false, "Recipient not whitelisted");
        }
        
        uint256 maxPayment = senderMaxPayment[sender];
        if (maxPayment == 0) maxPayment = globalMaxPayment;
        if (maxPayment > 0 && amount > maxPayment) {
            return (false, "Amount exceeds maximum");
        }
        
        uint256 recipientMax = senderRecipientMax[sender][recipient];
        if (recipientMax > 0 && amount > recipientMax) {
            return (false, "Amount exceeds recipient limit");
        }
        
        uint256 dailyLimit = senderDailyLimit[sender];
        if (dailyLimit == 0) dailyLimit = globalDailyLimit;
        if (dailyLimit > 0) {
            uint256 spent = _getDailySpent(sender);
            if (spent + amount > dailyLimit) {
                return (false, "Daily limit exceeded");
            }
        }
        
        return (true, "Policy checks passed");
    }
    
    // ============================================================================
    // INTERNAL HELPERS
    // ============================================================================
    
    function _updateDailyTracking(address sender) internal {
        uint256 dayStart = senderDayStart[sender];
        if (block.timestamp >= dayStart + 1 days) {
            senderDailySpent[sender] = 0;
            senderDayStart[sender] = block.timestamp;
        }
    }
    
    function _getDailySpent(address sender) internal view returns (uint256) {
        if (block.timestamp >= senderDayStart[sender] + 1 days) {
            return 0;
        }
        return senderDailySpent[sender];
    }

    // ============================================================================
    // ADMIN: GLOBAL POLICIES
    // ============================================================================
    
    function setGlobalMaxPayment(uint256 max) external onlyOwner {
        globalMaxPayment = max;
        emit PolicyUpdated("globalMaxPayment", address(0), max);
    }
    
    function setGlobalDailyLimit(uint256 limit) external onlyOwner {
        globalDailyLimit = limit;
        emit PolicyUpdated("globalDailyLimit", address(0), limit);
    }
    
    function setGlobalWhitelistEnabled(bool enabled) external onlyOwner {
        globalWhitelistEnabled = enabled;
    }
    
    // ============================================================================
    // ADMIN: SENDER POLICIES
    // ============================================================================
    
    function setSenderMaxPayment(address sender, uint256 max) external onlyOwner {
        senderMaxPayment[sender] = max;
        emit PolicyUpdated("senderMaxPayment", sender, max);
    }
    
    function setSenderDailyLimit(address sender, uint256 limit) external onlyOwner {
        senderDailyLimit[sender] = limit;
        emit PolicyUpdated("senderDailyLimit", sender, limit);
    }
    
    function blockSender(address sender, bool blocked) external onlyOwner {
        senderBlocked[sender] = blocked;
        emit SenderBlocked(sender, blocked);
    }
    
    // ============================================================================
    // ADMIN: RECIPIENT POLICIES
    // ============================================================================
    
    function blacklistRecipient(address recipient, bool blacklisted) external onlyOwner {
        recipientBlacklist[recipient] = blacklisted;
        emit RecipientBlacklisted(recipient, blacklisted);
    }
    
    function whitelistRecipient(address recipient, bool whitelisted) external onlyOwner {
        recipientWhitelist[recipient] = whitelisted;
        emit RecipientWhitelisted(recipient, whitelisted);
    }
    
    // ============================================================================
    // ADMIN: SENDER-RECIPIENT POLICIES
    // ============================================================================
    
    function setSenderRecipientAllowed(
        address sender, 
        address recipient, 
        bool allowed
    ) external onlyOwner {
        senderRecipientAllowed[sender][recipient] = allowed;
        // Mark that sender has restrictions by setting address(0) flag
        if (allowed) {
            senderRecipientMax[sender][address(0)] = 1;
        }
    }
    
    function setSenderRecipientMax(
        address sender,
        address recipient,
        uint256 max
    ) external onlyOwner {
        senderRecipientMax[sender][recipient] = max;
    }
    
    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================
    
    function getDailySpent(address sender) external view returns (uint256) {
        return _getDailySpent(sender);
    }
    
    function getDailyRemaining(address sender) external view returns (uint256) {
        uint256 limit = senderDailyLimit[sender];
        if (limit == 0) limit = globalDailyLimit;
        if (limit == 0) return type(uint256).max;
        
        uint256 spent = _getDailySpent(sender);
        if (spent >= limit) return 0;
        return limit - spent;
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
