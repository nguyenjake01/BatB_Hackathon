import { isMockMode, type IntegrationModule } from "@/lib/config";
import { Dashboard } from "./_components/Dashboard";

// Read the mock flags at request time so .env changes show up without a rebuild.
export const dynamic = "force-dynamic";

const MODULES: IntegrationModule[] = ["square", "supply", "agent", "payments"];

export default function Home() {
  const mockModes = Object.fromEntries(MODULES.map((m) => [m, isMockMode(m)])) as Record<IntegrationModule, boolean>;
  return <Dashboard mockModes={mockModes} />;
}
