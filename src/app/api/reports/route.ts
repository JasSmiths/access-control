import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { REPORT_FILENAME_PREFIX } from "@/lib/brand";
import { generateReportPdf } from "@/lib/pdf";
import type { Period } from "@/lib/period";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const b = (body ?? {}) as {
    period?: Period;
    from?: string;
    to?: string;
    contractorId?: number;
  };
  if (!b.period || !["day", "week", "month", "custom"].includes(b.period)) {
    return new Response("Invalid period", { status: 400 });
  }
  try {
    const pdf = await generateReportPdf({
      period: b.period,
      from: b.from,
      to: b.to,
      contractorId: b.contractorId ? Number(b.contractorId) : undefined,
    });
    const filename = `${REPORT_FILENAME_PREFIX}-${b.period}-${new Date().toISOString().slice(0, 10)}.pdf`;
    auditLog({
      level: "info",
      category: "reports",
      action: "report.generated_downloaded",
      message: `Report generated and downloaded (${filename}).`,
      request,
      actor: session.username,
      details: {
        period: b.period,
        from: b.from ?? null,
        to: b.to ?? null,
        contractorId: b.contractorId ?? null,
      },
    });
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    auditLog({
      level: "error",
      category: "reports",
      action: "report.failed",
      message: `Report generation failed: ${err instanceof Error ? err.message : "unknown error"}`,
      request,
      actor: session.username,
      details: {
        period: b.period,
        from: b.from ?? null,
        to: b.to ?? null,
        contractorId: b.contractorId ?? null,
      },
    });
    return new Response(err instanceof Error ? err.message : "Report failed", {
      status: 500,
    });
  }
}
