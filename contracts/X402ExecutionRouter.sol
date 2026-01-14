// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./X402PolicyEngine.sol";

/**
 * @title X402ExecutionRouter
 * @notice Single execution gate for x402 payments on Cronos
 * @dev ALL payments MUST go through this contract
 * 
 * Enforcement guarantees:
 * - msg.sender is the ONLY trusted payer (no JSON, no off-chain data)
 * - PolicyEngine.evaluate() MUST pass before ANY funds move
 * - Failed policy checks REVERT the entire transaction
 * - Events prove on-chain enforcement for both allowed and blocked payments
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract X402ExecutionRouter {
    
    // ============================================================================
    // STATE
    // ============================================================================
    
    X402PolicyEngine public immutable policyEngine;
    address public owner;
    bool public paused;
    
    // Supported tokens (address(0) = native CRO)
    mapping(address => bool) public supportedTokens;
    
    // Statistics
    uint256 public totalPayments;
    uint256 public totalVolume;
    uint256 public totalBlocked;
    
    // ============================================================================
    // EVENTS (Prove on-chain enforcement)
    // ============================================================================
    
    /// @notice Emitted when a payment is ALLOWED and executed
    event PaymentExecuted(
        address indexed sender,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    /// @notice Emitted when a payment is BLOCKED by policy
    event PaymentBlocked(
        address indexed sender,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        string reason
    );
    
    /// @notice Emitted for audit trail (both allowed and blocked)
    event PaymentAttempt(
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        bool allowed,
        string reason
    );
    
    // ============================================================================
    // MODIFIERS
    // ============================================================================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "X402Router: not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "X402Router: paused");
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor(address _policyEngine) {
        require(_policyEngine != address(0), "X402Router: invalid policy engine");
        policyEngine = X402PolicyEngine(_policyEngine);
        owner = msg.sender;
        
        // Native CRO is always supported
        supportedTokens[address(0)] = true;
    }

    // ============================================================================
    // CORE: EXECUTE PAYMENT (Native CRO)
    // ============================================================================
    
    /**
     * @notice Execute a native CRO payment through the firewall
     * @dev msg.sender is the payer - NO external data is trusted
     * @param recipient Address to receive payment
     * 
     * Flow:
     * 1. Check policy via PolicyEngine.evaluate()
     * 2. If policy fails → REVERT (no funds move)
     * 3. If policy passes → Transfer CRO
     * 4. Emit events for audit trail
     */
    function executePayment(
        address recipient
    ) external payable whenNotPaused {
        require(recipient != address(0), "X402Router: invalid recipient");
        require(msg.value > 0, "X402Router: zero amount");
        
        // ====== POLICY CHECK (CRITICAL) ======
        // msg.sender is the ONLY trusted source of payer identity
        (bool allowed, string memory reason) = policyEngine.evaluate(
            msg.sender,    // Payer (trusted: msg.sender)
            recipient,     // Recipient (from calldata)
            msg.value      // Amount (from msg.value)
        );
        
        // Emit attempt for audit trail
        emit PaymentAttempt(
            msg.sender,
            recipient,
            address(0),  // Native CRO
            msg.value,
            allowed,
            reason
        );
        
        // ====== ENFORCEMENT ======
        if (!allowed) {
            totalBlocked++;
            emit PaymentBlocked(msg.sender, recipient, address(0), msg.value, reason);
            
            // REVERT - No funds move, gas refunded (minus used)
            revert(string(abi.encodePacked("X402Router: ", reason)));
        }
        
        // ====== EXECUTE TRANSFER ======
        (bool success, ) = payable(recipient).call{value: msg.value}("");
        require(success, "X402Router: transfer failed");
        
        // Update stats
        totalPayments++;
        totalVolume += msg.value;
        
        emit PaymentExecuted(msg.sender, recipient, address(0), msg.value, block.timestamp);
    }
    
    // ============================================================================
    // CORE: EXECUTE PAYMENT (ERC20)
    // ============================================================================
    
    /**
     * @notice Execute an ERC20 token payment through the firewall
     * @dev Requires prior approval: token.approve(router, amount)
     * @param token ERC20 token address
     * @param recipient Address to receive payment
     * @param amount Token amount to transfer
     */
    function executeTokenPayment(
        address token,
        address recipient,
        uint256 amount
    ) external whenNotPaused {
        require(token != address(0), "X402Router: use executePayment for CRO");
        require(supportedTokens[token], "X402Router: token not supported");
        require(recipient != address(0), "X402Router: invalid recipient");
        require(amount > 0, "X402Router: zero amount");
        
        // ====== POLICY CHECK (CRITICAL) ======
        (bool allowed, string memory reason) = policyEngine.evaluate(
            msg.sender,
            recipient,
            amount
        );
        
        emit PaymentAttempt(msg.sender, recipient, token, amount, allowed, reason);
        
        // ====== ENFORCEMENT ======
        if (!allowed) {
            totalBlocked++;
            emit PaymentBlocked(msg.sender, recipient, token, amount, reason);
            revert(string(abi.encodePacked("X402Router: ", reason)));
        }
        
        // ====== EXECUTE TRANSFER ======
        // transferFrom requires prior approval
        bool success = IERC20(token).transferFrom(msg.sender, recipient, amount);
        require(success, "X402Router: token transfer failed");
        
        totalPayments++;
        totalVolume += amount;
        
        emit PaymentExecuted(msg.sender, recipient, token, amount, block.timestamp);
    }

    // ============================================================================
    // SIMULATION (View-only, no state changes)
    // ============================================================================
    
    /**
     * @notice Simulate a payment to check if it would pass policy
     * @dev Does NOT execute transfer or update state
     * @return allowed Whether payment would be allowed
     * @return reason Explanation
     */
    function simulatePayment(
        address sender,
        address recipient,
        uint256 amount
    ) external view returns (bool allowed, string memory reason) {
        if (paused) {
            return (false, "Router is paused");
        }
        if (recipient == address(0)) {
            return (false, "Invalid recipient");
        }
        if (amount == 0) {
            return (false, "Zero amount");
        }
        
        return policyEngine.evaluateView(sender, recipient, amount);
    }
    
    /**
     * @notice Simulate ERC20 payment including allowance check
     */
    function simulateTokenPayment(
        address token,
        address sender,
        address recipient,
        uint256 amount
    ) external view returns (bool allowed, string memory reason) {
        if (paused) {
            return (false, "Router is paused");
        }
        if (!supportedTokens[token]) {
            return (false, "Token not supported");
        }
        if (recipient == address(0)) {
            return (false, "Invalid recipient");
        }
        if (amount == 0) {
            return (false, "Zero amount");
        }
        
        // Check allowance
        uint256 allowance = IERC20(token).allowance(sender, address(this));
        if (allowance < amount) {
            return (false, "Insufficient allowance");
        }
        
        // Check balance
        uint256 balance = IERC20(token).balanceOf(sender);
        if (balance < amount) {
            return (false, "Insufficient balance");
        }
        
        return policyEngine.evaluateView(sender, recipient, amount);
    }
    
    // ============================================================================
    // ADMIN
    // ============================================================================
    
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
    
    function removeSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Cannot remove native CRO");
        supportedTokens[token] = false;
    }
    
    function pause() external onlyOwner {
        paused = true;
    }
    
    function unpause() external onlyOwner {
        paused = false;
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    // ============================================================================
    // VIEW
    // ============================================================================
    
    function getStats() external view returns (
        uint256 payments,
        uint256 volume,
        uint256 blocked
    ) {
        return (totalPayments, totalVolume, totalBlocked);
    }
    
    // ============================================================================
    // RECEIVE (Reject direct transfers - must use executePayment)
    // ============================================================================
    
    receive() external payable {
        revert("X402Router: use executePayment()");
    }
    
    fallback() external payable {
        revert("X402Router: use executePayment()");
    }
}
