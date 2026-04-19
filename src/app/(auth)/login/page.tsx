import { redirect } from "next/navigation";
import { adminExists, getSession } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand/BrandMark";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!adminExists()) redirect("/setup");
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <BrandMark className="h-10 w-10 mx-auto" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to {APP_NAME}
          </h1>
        </div>
        <div className="rounded-xl border bg-[var(--bg-elevated)] p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
