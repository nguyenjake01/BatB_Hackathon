// The agent wallet the owner's purchases are paid from: its public address and live AUSD
// balance on Base Sepolia (read-only; added for the owner dashboard, payments area: Jason).
import { erc20Abi, formatUnits } from "viem";
import { isMockMode } from "@/lib/config";
import { errorResponse } from "@/lib/http";
import { agentAccount, ausdToken, baseSepoliaClient } from "@/lib/payments/chain";

export async function GET() {
  try {
    // In payments test mode no real wallet is used, so there is no balance to show.
    if (isMockMode("payments")) return Response.json({ wallet: null });
    const { address } = agentAccount();
    const token = await ausdToken();
    const balance = await baseSepoliaClient().readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    return Response.json({
      wallet: {
        address,
        ausd: Number(formatUnits(balance, token.decimals)),
        network: "Base Sepolia",
        explorerUrl: `https://sepolia.basescan.org/address/${address}`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
