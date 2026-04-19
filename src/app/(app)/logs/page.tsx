import { LiveLogs } from "@/components/logs/LiveLogs";
import { loadLogs } from "@/lib/logs";

export const dynamic = "force-dynamic";

export default function LogsPage() {
  const initial = loadLogs(200);
  return <LiveLogs initial={initial} />;
}
