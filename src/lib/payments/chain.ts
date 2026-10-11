// Chain and token config for payments (AUSD on Base Sepolia) and the audit log (BSC Testnet).
// Addresses come from env; token metadata is read from the chain, never hard-coded.

import { createPublicClient, getAddress, http, parseAbi, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

/** CAIP-2 id of Base Sepolia, the network x402 payments settle on. */
export const PAYMENT_NETWORK = `eip155:${baseSepolia.id}` as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  return value;
}

export function ausdAddress(): Address {
  return getAddress(requireEnv("AUSD_CONTRACT_ADDRESS"));
}

export function purchaseLogAddress(): Address {
  return getAddress(requireEnv("PURCHASE_LOG_CONTRACT_ADDRESS"));
}

/** The agent's testnet wallet. Pays in AUSD and owns the PurchaseLog contract. */
export function agentAccount(): PrivateKeyAccount {
  const key = requireEnv("AGENT_WALLET_PRIVATE_KEY");
  return privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
}

export function baseSepoliaClient() {
  return createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC_URL || undefined) });
}

export function bscTestnetTransport() {
  return http(process.env.BSC_TESTNET_RPC_URL || undefined);
}

const tokenAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)",
]);

export interface AusdToken {
  address: Address;
  decimals: number;
  /**
   * EIP-712 domain the token verifies ERC-3009 signatures against. This is NOT the
   * ERC-20 `name()`: AUSD's `name()` is "AUSD" but its signing domain is "Agora Dollar".
   * Signing with the wrong one makes every payment fail signature verification.
   */
  eip712: { name: string; version: string };
}

let cachedToken: Promise<AusdToken> | undefined;

/** AUSD metadata, read once from the token contract (ERC-5267 `eip712Domain`). */
export function ausdToken(): Promise<AusdToken> {
  cachedToken ??= (async () => {
    const address = ausdAddress();
    const client = baseSepoliaClient();
    const [decimals, domain] = await Promise.all([
      client.readContract({ address, abi: tokenAbi, functionName: "decimals" }),
      client.readContract({ address, abi: tokenAbi, functionName: "eip712Domain" }),
    ]);
    return { address, decimals, eip712: { name: domain[1], version: domain[2] } };
  })();
  // Don't cache a failed lookup (e.g. a flaky RPC).
  cachedToken.catch(() => (cachedToken = undefined));
  return cachedToken;
}

/** USD (1 AUSD = 1 USD) to token base units. Prices are rounded to cents before converting. */
export function toTokenUnits(usd: number, decimals: number): bigint {
  return parseUnits(usd.toFixed(2), decimals);
}
