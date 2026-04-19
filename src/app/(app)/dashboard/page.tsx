import { LiveDashboard } from "@/components/dashboard/LiveDashboard";
import { loadDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const data = loadDashboard();
  return <LiveDashboard initial={data} />;
}
