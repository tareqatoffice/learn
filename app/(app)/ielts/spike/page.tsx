// TEMPORARY phone spike. Remove after results are recorded.
import { requireUser } from "@/lib/authz";
import { SpikeClient } from "./SpikeClient";

export const metadata = { title: "IELTS phone spike", robots: { index: false } };

export default async function SpikePage() {
  await requireUser();
  return <SpikeClient />;
}
