import { LiveLogs } from "@/components/logs/LiveLogs";
import { listActiveApiStreams } from "@/lib/api-streams";
import { loadLogsPage } from "@/lib/logs";

export const dynamic = "force-dynamic";

export default function LogsPage() {
  const initial = {
    ...loadLogsPage(1, 10),
    streams: listActiveApiStreams(),
  };
  return <LiveLogs initial={initial} />;
}
