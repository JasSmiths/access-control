import { redirect } from "next/navigation";
import { adminExists, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (!adminExists()) redirect("/setup");
  const session = await getSession();
  if (!session) redirect("/login");
  redirect("/dashboard");
}
