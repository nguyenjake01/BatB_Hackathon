// Agent wallet helper (Person 2, Jason). Testnet only.
//
//   npm run wallet            show the address, balances, and what is still missing
//   npm run wallet -- faucet  claim test AUSD from Agora's faucet on Base Sepolia
//                             (npm run wallet -- faucet sepolia claims on Ethereum Sepolia instead)
//   npm run wallet -- bridge  move test ETH from Ethereum Sepolia to Base Sepolia (default 0.02,
//                             or pass an amount: npm run wallet -- bridge 0.01)
//
// Reads .env.local. Never prints the private key.

import { createPublicClient, createWalletClient, formatEther, formatUnits, getAddress, http, parseAbi, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, bscTestnet, sepolia } from "viem/chains";
import { getL2TransactionHashes, publicActionsL2, walletActionsL1 } from "viem/op-stack";

// Agora's testnet faucet, same address on every EVM testnet:
// https://docs.agora.finance/developer/contract-deployments
const AUSD_FAUCET = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C";

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);
const faucetAbi = parseAbi(["function requestFunds(address recipient)"]);
const purchaseLogAbi = parseAbi(["function owner() view returns (address)"]);

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is not set in .env.local`);
    process.exit(1);
  }
  return value;
}

const key = env("AGENT_WALLET_PRIVATE_KEY");
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const ausd = getAddress(env("AUSD_CONTRACT_ADDRESS"));
const baseTransport = http(process.env.BASE_SEPOLIA_RPC_URL || undefined);
const base = createPublicClient({ chain: baseSepolia, transport: baseTransport });
// Ethereum Sepolia is only used to bridge test ETH over to Base Sepolia.
const sepoliaTransport = http(process.env.SEPOLIA_RPC_URL || undefined);
const l1 = createPublicClient({ chain: sepolia, transport: sepoliaTransport });
const bsc = createPublicClient({ chain: bscTestnet, transport: http(process.env.BSC_TESTNET_RPC_URL || undefined) });

async function status() {
  const [eth, ausdBalance, decimals, bnb] = await Promise.all([
    base.getBalance({ address: account.address }),
    base.readContract({ address: ausd, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
    base.readContract({ address: ausd, abi: erc20Abi, functionName: "decimals" }),
    bsc.getBalance({ address: account.address }),
  ]);

  console.log(`Agent wallet:  ${account.address}`);
  console.log(`Base Sepolia:  ${formatEther(eth)} ETH, ${formatUnits(ausdBalance, decimals)} AUSD`);
  console.log(`BSC Testnet:   ${formatEther(bnb)} tBNB`);

  const todo = [];
  if (ausdBalance === 0n && eth > 0n) todo.push("Claim test AUSD: npm run wallet -- faucet");
  if (ausdBalance === 0n && eth === 0n) {
    // Faucets often pay out on Ethereum Sepolia, which is a different network from Base Sepolia.
    const l1Eth = await l1.getBalance({ address: account.address }).catch(() => 0n);
    const l1Ausd = await l1
      .readContract({ address: ausd, abi: erc20Abi, functionName: "balanceOf", args: [account.address] })
      .catch(() => 0n);
    if (l1Eth > 0n || l1Ausd > 0n) {
      console.log(`Eth Sepolia:   ${formatEther(l1Eth)} ETH, ${formatUnits(l1Ausd, decimals)} AUSD (payments run on Base Sepolia, not here)`);
    }
    todo.push(
      l1Eth > 0n
        ? "Move test ETH to Base Sepolia: npm run wallet -- bridge   (then: npm run wallet -- faucet)"
        : "Get Base Sepolia ETH for this address (any Base Sepolia faucet), then run: npm run wallet -- faucet",
    );
  }
  if (bnb === 0n) todo.push("Get BSC Testnet tBNB for this address: https://www.bnbchain.org/en/testnet-faucet");

  const purchaseLog = process.env.PURCHASE_LOG_CONTRACT_ADDRESS?.trim();
  if (!purchaseLog) {
    todo.push("Deploy the audit contract: cd contracts && npm run deploy:bsc-testnet, then set PURCHASE_LOG_CONTRACT_ADDRESS");
  } else {
    const owner = await bsc.readContract({ address: getAddress(purchaseLog), abi: purchaseLogAbi, functionName: "owner" });
    const ok = owner.toLowerCase() === account.address.toLowerCase();
    console.log(`PurchaseLog:   ${purchaseLog} (owner ${ok ? "is the agent wallet" : `is ${owner}, NOT the agent wallet`})`);
    if (!ok) todo.push("PurchaseLog only accepts logs from its deployer. Redeploy it with this wallet.");
  }
  const demo = process.env.DEMO_DISTRIBUTOR_WALLET?.trim();
  if (!demo) todo.push("Set DEMO_DISTRIBUTOR_WALLET (where unclaimed distributors get paid)");

  console.log(todo.length ? `\nStill to do:\n${todo.map((t) => `  - ${t}`).join("\n")}` : "\nReady for real payments.");
}

async function faucet(network) {
  const onL1 = network === "sepolia";
  const [client, chain, transport, explorer] = onL1
    ? [l1, sepolia, sepoliaTransport, "https://sepolia.etherscan.io"]
    : [base, baseSepolia, baseTransport, "https://sepolia.basescan.org"];
  // The faucet call is a normal transaction, so the wallet has to pay its gas.
  if ((await client.getBalance({ address: account.address })) === 0n) {
    console.error(`${account.address} has no ${chain.name} ETH for gas. Fund it from a ${chain.name} faucet first.`);
    process.exit(1);
  }
  const wallet = createWalletClient({ account, chain, transport });
  const { request } = await client.simulateContract({
    account,
    address: AUSD_FAUCET,
    abi: faucetAbi,
    functionName: "requestFunds",
    args: [account.address],
  });
  const hash = await wallet.writeContract(request);
  console.log(`Faucet transaction on ${chain.name}: ${explorer}/tx/${hash}`);
  // Two confirmations, so the balance read below is not served by a node that is one block behind.
  await client.waitForTransactionReceipt({ hash, confirmations: 2 });
  await status();
}

/** Deposits test ETH from Ethereum Sepolia into Base Sepolia through Base's official bridge. */
async function bridge(amount = "0.02") {
  const l2 = base.extend(publicActionsL2());
  const wallet = createWalletClient({ account, chain: sepolia, transport: sepoliaTransport }).extend(walletActionsL1());
  const args = await l2.buildDepositTransaction({ account, mint: parseEther(amount), to: account.address });
  const hash = await wallet.depositTransaction(args);
  console.log(`Deposit sent on Ethereum Sepolia: https://sepolia.etherscan.io/tx/${hash}`);
  const receipt = await l1.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The deposit transaction reverted");
  const [l2Hash] = getL2TransactionHashes(receipt);
  console.log("Waiting for it to arrive on Base Sepolia (usually 1 to 3 minutes)...");
  await l2.waitForTransactionReceipt({ hash: l2Hash, confirmations: 2, timeout: 600_000 });
  await status();
}

const [command, argument] = process.argv.slice(2);
await (command === "faucet" ? faucet(argument) : command === "bridge" ? bridge(argument) : status());
