import { existsSync } from "node:fs";
import path from "node:path";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, type HardhatUserConfig } from "hardhat/config";

// Share the app's env file so BSC_TESTNET_RPC_URL and AGENT_WALLET_PRIVATE_KEY live in one place.
// Earlier files win, matching Next.js (.env.local overrides .env).
for (const file of ["../.env.local", "../.env"]) {
  const envPath = path.resolve(import.meta.dirname, file);
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    bscTestnet: {
      type: "http",
      chainType: "l1",
      chainId: 97,
      url: configVariable("BSC_TESTNET_RPC_URL"),
      // The deployer becomes the contract owner, the only account allowed to log purchases,
      // so deploy with the same wallet the app uses. Testnet keys only.
      accounts: [configVariable("AGENT_WALLET_PRIVATE_KEY")],
    },
  },
};

export default config;
