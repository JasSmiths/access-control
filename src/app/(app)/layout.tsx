import { redirect } from "next/navigation";
import { adminExists, getSession } from "@/lib/auth";
import { Sidebar } from "@/components/nav/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!adminExists()) redirect("/setup");
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <Sidebar username={session.username} />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
