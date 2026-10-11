import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, keccak256, parseEventLogs, parseUnits, toHex } from "viem";

describe("PurchaseLog", async () => {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [owner, stranger] = await viem.getWalletClients();

  it("makes the deployer the owner", async () => {
    const purchaseLog = await viem.deployContract("PurchaseLog");
    assert.equal(await purchaseLog.read.owner(), getAddress(owner.account.address));
  });

  it("emits PurchaseLogged with the purchase details", async () => {
    const purchaseLog = await viem.deployContract("PurchaseLog");
    const amount = parseUnits("237.90", 6);
    const reasoningHash = keccak256(toHex("Restaurant Depot is 9% cheaper per lb than the Costco baseline."));

    const hash = await purchaseLog.write.logPurchase(["ord_123", "Restaurant Depot", amount, reasoningHash]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const events = parseEventLogs({ abi: purchaseLog.abi, logs: receipt.logs, eventName: "PurchaseLogged" });

    assert.equal(events.length, 1);
    assert.deepEqual(events[0].args, {
      orderId: "ord_123",
      distributor: "Restaurant Depot",
      amount,
      timestamp: block.timestamp,
      reasoningHash,
    });
  });

  it("rejects purchases logged by anyone but the owner", async () => {
    const purchaseLog = await viem.deployContract("PurchaseLog");
    await viem.assertions.revertWithCustomError(
      purchaseLog.write.logPurchase(["ord_456", "Costco Business Center", 1n, keccak256(toHex("x"))], {
        account: stranger.account,
      }),
      purchaseLog,
      "NotOwner",
    );
  });
});
