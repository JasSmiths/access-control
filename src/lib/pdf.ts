import "server-only";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { resolvePeriod, type Period } from "./period";
import { formatDate, formatHours, formatTime } from "./format";
import { getSettings } from "./settings";
import { parseReportSections } from "./settings-shared";
import { APP_NAME } from "./brand";

type Row = {
  session_id: number;
  contractor_id: number;
  contractor_name: string;
  contractor_role: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: "open" | "closed" | "flagged";
  notes: string | null;
};

type Palette = {
  primary: string;
  primarySoft: string;
  primaryDark: string;
  ink: string;
  muted: string;
  subtle: string;
  border: string;
  stripe: string;
  danger: string;
  dangerSoft: string;
  canvas: string;
};

type RenderCtx = {
  palette: Palette;
  companyName: string;
  periodLabel: string;
  generatedAt: string;
};

type TableColumn<T> = {
  title: string;
  width: number;
  align?: "left" | "center" | "right";
  value: (row: T) => string;
};

const PAGE_MARGIN = 40;
const TABLE_GAP = 12;

export type ReportInput = {
  period: Period;
  from?: string;
  to?: string;
  contractorId?: number;
};

export async function generateReportPdf(input: ReportInput): Promise<Buffer> {
  const { fromISO, toISO, label } = resolvePeriod(input.period, input.from, input.to);
  const db = getDb();

  const settings = getSettings();
  const themeColor = settings.report_theme_color ?? "#2563eb";
  const companyName = settings.report_company_name ?? APP_NAME;
  const siteAddress = settings.site_address;
  const sections = parseReportSections(settings.report_sections);

  const params: (string | number)[] = [fromISO, toISO];
  let where = "s.started_at >= ? AND s.started_at <= ?";
  if (input.contractorId) {
    where += " AND s.contractor_id = ?";
    params.push(input.contractorId);
  }

  const rows = db
    .prepare(
      `SELECT s.id AS session_id,
              s.contractor_id,
              c.name   AS contractor_name,
              c.role   AS contractor_role,
              s.started_at,
              s.ended_at,
              s.duration_seconds,
              s.status,
              s.notes
         FROM sessions s
         JOIN contractors c ON c.id = s.contractor_id
        WHERE ${where}
        ORDER BY c.name ASC, s.started_at ASC`
    )
    .all(...params) as Row[];

  const palette = buildPalette(themeColor);
  const generatedAt = `${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`;

  const ctx: RenderCtx = {
    palette,
    companyName,
    periodLabel: `${input.period.toUpperCase()} (${label})`,
    generatedAt,
  };

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: {
      Title: `${companyName} - Contractor Activity Report`,
      Author: APP_NAME,
      Subject: "Contractor activity report",
      Keywords: "contractor, report, sessions",
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", resolve));

  drawPageChrome(doc, ctx);

  const totalSessions = rows.length;
  const contractors = new Set(rows.map((r) => r.contractor_id)).size;
  const closedRows = rows.filter((r) => r.status === "closed");
  const closedSeconds = closedRows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0);
  const flaggedOrOpen = rows.filter((r) => r.status === "flagged" || r.status === "open");
  const openCount = rows.filter((r) => r.status === "open").length;

  for (const section of sections) {
    if (!section.enabled) continue;

    if (section.key === "header") {
      drawCoverBlock(doc, ctx, {
        siteAddress,
        sessionCount: totalSessions,
        contractors,
        closedHours: formatHours(closedSeconds),
        flaggedCount: flaggedOrOpen.length,
        openCount,
      });
      continue;
    }

    if (section.key === "summary") {
      drawSectionHeading(doc, ctx, "Summary", "Contractor totals and output for the selected range");

      const byContractor = new Map<
        number,
        { name: string; role: string | null; sessions: number; seconds: number; flagged: number }
      >();

      for (const row of rows) {
        const entry =
          byContractor.get(row.contractor_id) ??
          {
            name: row.contractor_name,
            role: row.contractor_role,
            sessions: 0,
            seconds: 0,
            flagged: 0,
          };

        entry.sessions += 1;
        if (row.status === "closed") entry.seconds += row.duration_seconds ?? 0;
        if (row.status !== "closed") entry.flagged += 1;
        byContractor.set(row.contractor_id, entry);
      }

      const summaryRows = [...byContractor.values()].sort((a, b) => {
        if (b.seconds !== a.seconds) return b.seconds - a.seconds;
        return a.name.localeCompare(b.name);
      });

      if (summaryRows.length === 0) {
        drawEmptyState(doc, ctx, "No sessions matched this date range.");
      } else {
        drawDataTable(doc, ctx, {
          columns: [
            { title: "Contractor", width: 180, value: (r) => r.name },
            { title: "Role", width: 100, value: (r) => r.role ?? "Unspecified" },
            { title: "Sessions", width: 75, align: "right", value: (r) => String(r.sessions) },
            { title: "Closed Hours", width: 80, align: "right", value: (r) => formatHours(r.seconds) },
            { title: "Attention", width: 80, align: "right", value: (r) => String(r.flagged) },
          ],
          rows: summaryRows,
        });
      }

      doc.moveDown(0.6);
      continue;
    }

    if (section.key === "sessions") {
      drawSectionHeading(doc, ctx, "Session Log", "Detailed timeline of all captured sessions");

      if (rows.length === 0) {
        drawEmptyState(doc, ctx, "No session records available.");
      } else {
        drawDataTable(doc, ctx, {
          columns: [
            { title: "Contractor", width: 115, value: (r) => r.contractor_name },
            { title: "Role", width: 92, value: (r) => r.contractor_role ?? "-" },
            { title: "Date", width: 72, value: (r) => formatDate(r.started_at) },
            { title: "In", width: 46, align: "center", value: (r) => formatTime(r.started_at) },
            {
              title: "Out",
              width: 46,
              align: "center",
              value: (r) => (r.ended_at ? formatTime(r.ended_at) : "-")
            },
            {
              title: "Duration",
              width: 66,
              align: "right",
              value: (r) =>
                r.status === "closed" && r.duration_seconds != null
                  ? `${formatHours(r.duration_seconds)} h`
                  : r.status === "open"
                    ? "Open"
                    : "-",
            },
            { title: "Status", width: 54, align: "center", value: (r) => r.status.toUpperCase() },
            { title: "Notes", width: 92, value: (r) => r.notes ?? "-" },
          ],
          rows,
        });
      }

      doc.moveDown(0.6);
      continue;
    }

    if (section.key === "flagged") {
      drawSectionHeading(doc, ctx, "Anomalies", "Open sessions or records that need follow-up");

      if (flaggedOrOpen.length === 0) {
        drawEmptyState(doc, ctx, "No flagged or open sessions were detected.");
      } else {
        drawDataTable(doc, ctx, {
          columns: [
            { title: "Contractor", width: 130, value: (r) => r.contractor_name },
            { title: "Started", width: 120, value: (r) => `${formatDate(r.started_at)} ${formatTime(r.started_at)}` },
            { title: "Status", width: 70, align: "center", value: (r) => r.status.toUpperCase() },
            { title: "Notes", width: 195, value: (r) => r.notes ?? "No notes" },
          ],
          rows: flaggedOrOpen,
          emphasizeRows: (r) => r.status === "flagged",
        });
      }

      doc.moveDown(0.6);
    }
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

function drawCoverBlock(
  doc: PDFKit.PDFDocument,
  ctx: RenderCtx,
  data: {
    siteAddress: string | null;
    sessionCount: number;
    contractors: number;
    closedHours: string;
    flaggedCount: number;
    openCount: number;
  }
) {
  const { palette } = ctx;

  const left = doc.page.margins.left;
  const width = getContentWidth(doc);
  const innerWidth = width - 40;
  const metaLines = [
    { text: "Contractor Activity Report", font: "Helvetica", size: 10, color: "#e2e8f0" },
    { text: `Period: ${ctx.periodLabel}`, font: "Helvetica", size: 9, color: "#bfdbfe" },
    { text: `Generated: ${ctx.generatedAt}`, font: "Helvetica", size: 9, color: "#bfdbfe" },
    ...(data.siteAddress
      ? [{ text: `Site: ${data.siteAddress}`, font: "Helvetica", size: 9, color: "#bfdbfe" }]
      : []),
  ];

  doc.font("Helvetica-Bold").fontSize(22);
  const titleHeight = doc.heightOfString(ctx.companyName, { width: innerWidth });

  let metaHeight = 0;
  for (const line of metaLines) {
    doc.font(line.font).fontSize(line.size);
    metaHeight += doc.heightOfString(line.text, { width: innerWidth });
  }

  const heroHeight = Math.max(110, 24 + titleHeight + 12 + metaHeight + 18);
  const cardWidth = (width - TABLE_GAP) / 2;
  const cardHeight = 56;
  const cardAreaHeight = cardHeight * 2 + 10;
  const totalHeight = heroHeight + 18 + cardAreaHeight + 14;

  ensureRoom(doc, totalHeight, ctx);
  const top = doc.y;
  const actualCardTop = top + heroHeight + 18;

  doc.roundedRect(left, top, width, heroHeight, 10).fill(palette.primaryDark);

  let currentY = top + 18;

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22).text(ctx.companyName, left + 20, currentY, {
    width: innerWidth,
  });
  currentY += titleHeight + 10;

  for (const line of metaLines) {
    doc.fillColor(line.color).font(line.font).fontSize(line.size).text(line.text, left + 20, currentY, {
      width: innerWidth,
    });
    currentY += doc.heightOfString(line.text, { width: innerWidth });
  }

  const cards = [
    { label: "Total Sessions", value: String(data.sessionCount), helper: "Within selected period" },
    { label: "Active Contractors", value: String(data.contractors), helper: "Unique people recorded" },
    { label: "Closed Hours", value: data.closedHours, helper: "Completed, signed-out time" },
    {
      label: "Needs Attention",
      value: String(data.flaggedCount),
      helper: `${data.openCount} currently open`,
    },
  ];

  cards.forEach((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = left + col * (cardWidth + TABLE_GAP);
    const y = actualCardTop + row * (cardHeight + 10);

    doc.roundedRect(x, y, cardWidth, cardHeight, 8).fill(palette.primarySoft);
    doc.roundedRect(x, y, cardWidth, cardHeight, 8).strokeColor(palette.border).lineWidth(0.8).stroke();

    doc.fillColor(palette.muted).font("Helvetica").fontSize(9).text(card.label, x + 12, y + 10, {
      width: cardWidth - 24,
    });

    doc.fillColor(palette.ink).font("Helvetica-Bold").fontSize(18).text(card.value, x + 12, y + 22, {
      width: cardWidth - 24,
    });

    doc.fillColor(palette.subtle).font("Helvetica").fontSize(8).text(card.helper, x + 12, y + 40, {
      width: cardWidth - 24,
    });
  });

  doc.y = actualCardTop + cardAreaHeight + 14;
}

function drawSectionHeading(doc: PDFKit.PDFDocument, ctx: RenderCtx, title: string, subtitle: string) {
  ensureRoom(doc, 48, ctx);

  const left = doc.page.margins.left;
  const top = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.roundedRect(left, top, width, 34, 8).fill(ctx.palette.canvas);
  doc.roundedRect(left, top, width, 34, 8).strokeColor(ctx.palette.border).lineWidth(0.8).stroke();

  doc.rect(left, top, 4, 34).fill(ctx.palette.primary);

  doc.fillColor(ctx.palette.ink).font("Helvetica-Bold").fontSize(12).text(title, left + 12, top + 7);
  doc.fillColor(ctx.palette.muted).font("Helvetica").fontSize(8.5).text(subtitle, left + 100, top + 10, {
    width: width - 112,
    align: "right",
  });

  doc.y = top + 42;
}

function drawEmptyState(doc: PDFKit.PDFDocument, ctx: RenderCtx, message: string) {
  ensureRoom(doc, 40, ctx);

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;

  doc.roundedRect(left, top, width, 30, 6).fill("#f8fafc");
  doc.roundedRect(left, top, width, 30, 6).strokeColor(ctx.palette.border).lineWidth(0.8).stroke();

  doc.fillColor(ctx.palette.muted).font("Helvetica-Oblique").fontSize(9).text(message, left + 10, top + 10, {
    width: width - 20,
  });

  doc.y = top + 38;
}

function drawDataTable<T>(
  doc: PDFKit.PDFDocument,
  ctx: RenderCtx,
  opts: {
    columns: TableColumn<T>[];
    rows: T[];
    emphasizeRows?: (row: T) => boolean;
  }
) {
  const { rows, emphasizeRows } = opts;
  const left = doc.page.margins.left;
  const columns = normalizeTableColumns(doc, opts.columns);
  const tableWidth = getContentWidth(doc);
  const headerHeight = 22;
  const cellPadX = 6;
  const cellPadY = 5;

  const drawHeaderRow = () => {
    ensureRoom(doc, headerHeight + 6, ctx);
    const y = doc.y;

    doc.roundedRect(left, y, tableWidth, headerHeight, 4).fill(ctx.palette.primary);

    let x = left;
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
    for (const col of columns) {
      doc.text(col.title, x + cellPadX, y + 6, {
        width: col.width - cellPadX * 2,
        align: col.align ?? "left",
        lineBreak: false,
      });
      x += col.width;
    }

    doc.y = y + headerHeight;
  };

  drawHeaderRow();

  rows.forEach((row, rowIndex) => {
    doc.font("Helvetica").fontSize(8.6);

    const rowHeight = Math.max(
      20,
      ...columns.map((col) => {
        const text = col.value(row);
        const height = doc.heightOfString(text, {
          width: col.width - cellPadX * 2,
          align: col.align ?? "left",
        });
        return height + cellPadY * 2;
      })
    );

    const bottomLimit = doc.page.height - doc.page.margins.bottom - 28;
    if (doc.y + rowHeight > bottomLimit) {
      addStyledPage(doc, ctx);
      drawHeaderRow();
    }

    const y = doc.y;

    if (emphasizeRows?.(row)) {
      doc.rect(left, y, tableWidth, rowHeight).fill(ctx.palette.dangerSoft);
    } else if (rowIndex % 2 === 0) {
      doc.rect(left, y, tableWidth, rowHeight).fill(ctx.palette.stripe);
    }

    doc.strokeColor(ctx.palette.border).lineWidth(0.4);
    doc.rect(left, y, tableWidth, rowHeight).stroke();

    let x = left;
    columns.forEach((col) => {
      const text = col.value(row);
      doc.fillColor(ctx.palette.ink).font("Helvetica").fontSize(8.6).text(text, x + cellPadX, y + cellPadY, {
        width: col.width - cellPadX * 2,
        align: col.align ?? "left",
      });

      x += col.width;
      doc.moveTo(x, y).lineTo(x, y + rowHeight).strokeColor(ctx.palette.border).lineWidth(0.3).stroke();
    });

    doc.y = y + rowHeight;
  });

  doc.moveDown(0.35);
}

function drawPageChrome(doc: PDFKit.PDFDocument, ctx: RenderCtx) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.page.margins.top;
  const chromeWidth = right - left;

  doc.moveTo(left, top - 12).lineTo(right, top - 12).strokeColor(ctx.palette.primarySoft).lineWidth(2).stroke();

  doc.fillColor(ctx.palette.subtle).font("Helvetica").fontSize(8).text(ctx.companyName, left, top - 26, {
    width: chromeWidth * 0.45,
    lineBreak: false,
    ellipsis: true,
  });

  doc.text(ctx.periodLabel, left, top - 26, {
    width: chromeWidth,
    align: "right",
    lineBreak: false,
    ellipsis: true,
  });

  doc.y = top;
}

function addStyledPage(doc: PDFKit.PDFDocument, ctx: RenderCtx) {
  doc.addPage();
  drawPageChrome(doc, ctx);
}

function ensureRoom(doc: PDFKit.PDFDocument, height: number, ctx: RenderCtx) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 28;
  if (doc.y + height > bottomLimit) addStyledPage(doc, ctx);
}

function buildPalette(color: string): Palette {
  const base = normalizeHex(color) ?? "#2563eb";
  return {
    primary: base,
    primarySoft: blend(base, "#ffffff", 0.83),
    primaryDark: blend(base, "#0f172a", 0.55),
    ink: "#0f172a",
    muted: "#334155",
    subtle: "#64748b",
    border: "#cbd5e1",
    stripe: "#f8fafc",
    danger: "#b91c1c",
    dangerSoft: "#fef2f2",
    canvas: "#f8fafc",
  };
}

function normalizeHex(input: string): string | null {
  const v = input.trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const full = /^#([0-9a-fA-F]{6})$/;

  if (full.test(v)) return v.toLowerCase();
  const shortMatch = v.match(short);
  if (!shortMatch) return null;

  const [r, g, b] = shortMatch[1].split("");
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
}

function blend(colorA: string, colorB: string, weightToB: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const w = clamp(weightToB, 0, 1);

  const r = Math.round(a.r * (1 - w) + b.r * w);
  const g = Math.round(a.g * (1 - w) + b.g * w);
  const bch = Math.round(a.b * (1 - w) + b.b * w);

  return rgbToHex(r, g, bch);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHex(hex) ?? "#2563eb";
  return {
    r: Number.parseInt(clean.slice(1, 3), 16),
    g: Number.parseInt(clean.slice(3, 5), 16),
    b: Number.parseInt(clean.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getContentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function normalizeTableColumns<T>(
  doc: PDFKit.PDFDocument,
  columns: TableColumn<T>[]
): TableColumn<T>[] {
  const availableWidth = getContentWidth(doc);
  const sourceWidth = columns.reduce((sum, col) => sum + col.width, 0);

  if (sourceWidth === 0) return columns;

  let assigned = 0;
  return columns.map((col, index) => {
    const isLast = index === columns.length - 1;
    const width = isLast
      ? availableWidth - assigned
      : Math.round((col.width / sourceWidth) * availableWidth);

    assigned += width;
    return { ...col, width };
  });
}
