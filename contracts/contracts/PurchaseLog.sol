// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PurchaseLog
/// @notice Append-only audit trail of purchases made by the purchasing agent.
/// One event per paid order. The full reasoning text stays off-chain and is
/// referenced by its keccak256 hash.
contract PurchaseLog {
    /// @notice The agent wallet allowed to log purchases (the deployer).
    address public immutable owner;

    event PurchaseLogged(
        string orderId,
        string distributor,
        uint256 amount,
        uint256 timestamp,
        bytes32 reasoningHash
    );

    error NotOwner();

    constructor() {
        owner = msg.sender;
    }

    /// @param orderId Order id from the app, e.g. "ord_1a2b3c4d5e".
    /// @param distributor Distributor name, e.g. "Restaurant Depot".
    /// @param amount Amount paid, in AUSD base units.
    /// @param reasoningHash keccak256 of the agent's reasoning text.
    function logPurchase(
        string calldata orderId,
        string calldata distributor,
        uint256 amount,
        bytes32 reasoningHash
    ) external {
        if (msg.sender != owner) revert NotOwner();
        emit PurchaseLogged(orderId, distributor, amount, block.timestamp, reasoningHash);
    }
}
