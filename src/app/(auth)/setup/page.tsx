import { redirect } from "next/navigation";
import { adminExists } from "@/lib/auth";
import { SetupForm } from "@/components/auth/SetupForm";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand/BrandMark";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (adminExists()) redirect("/login");
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <BrandMark className="h-10 w-10 mx-auto" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {APP_NAME}
          </h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Create your first admin account to get started.
          </p>
        </div>
        <div className="rounded-xl border bg-[var(--bg-elevated)] p-6 shadow-sm">
          <SetupForm />
        </div>
      </div>
    </div>
  );
}
