import { LiveEvents } from "@/components/events/LiveEvents";
import { loadEventsPageData } from "@/lib/events-page";

export const dynamic = "force-dynamic";

export default function EventsPage() {
  const initial = loadEventsPageData(100);
  return <LiveEvents initial={initial} />;
}
