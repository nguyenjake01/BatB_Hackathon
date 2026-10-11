import { network } from "hardhat";

const { viem, networkName } = await network.create();
const [deployer] = await viem.getWalletClients();

console.log(`Deploying PurchaseLog to ${networkName} from ${deployer.account.address}...`);
const purchaseLog = await viem.deployContract("PurchaseLog");

console.log(`PurchaseLog deployed at ${purchaseLog.address}`);
console.log(`Set PURCHASE_LOG_CONTRACT_ADDRESS=${purchaseLog.address} in .env.local`);
