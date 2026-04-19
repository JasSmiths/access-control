import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminUsersCard,
  ChangePasswordCard,
  SiteSettingsCard,
  AppRiseCard,
} from "@/components/settings/SettingsPanels";
import { getSettings } from "@/lib/settings";
import { getSession, listAdminUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const settings = getSettings();
  const adminUsers = listAdminUsers().map((row) => ({
    id: row.id,
    username: row.username,
    active: !!row.active,
    last_login_at: row.last_login_at,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Admin users, site information, and notification configuration.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Site and Access
          </h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <SiteSettingsCard initial={settings} />
          <ChangePasswordCard />
        </div>
        <AdminUsersCard currentUserId={session.userId} initialUsers={adminUsers} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Notifications
          </h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <AppRiseCard initial={settings} />
          <div className="rounded-xl border bg-[var(--bg-elevated)] p-5 text-sm text-[var(--fg-muted)]">
            Webhook and API integration settings have moved to{" "}
            <Link href="/integrations" className="text-[var(--accent)] hover:underline">
              Integrations
            </Link>
            .
          </div>
        </div>
      </section>
    </div>
  );
}
