import { isMockMode } from "@/lib/config";
import { DistributorPortal } from "./_components/DistributorPortal";

// Read the mock flags at request time so .env changes show up without a rebuild.
export const dynamic = "force-dynamic";

export default function DistributorPage() {
  return <DistributorPortal paymentsMocked={isMockMode("payments")} />;
}
