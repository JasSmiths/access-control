import "server-only";

type ClientIpDetails = {
  ip: string | null;
  source: string | null;
  chain: string[];
};

const SIMPLE_IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-forwarded-for",
  "forwarded",
  "x-real-ip",
] as const;

const FALLBACK_IP_HEADERS = ["x-client-ip"] as const;

export function getClientIp(request: Request): string | null {
  return getClientIpDetails(request).ip;
}

export function getClientIpDetails(request: Request): ClientIpDetails {
  let fallback: ClientIpDetails | null = null;

  for (const header of [...SIMPLE_IP_HEADERS, ...FALLBACK_IP_HEADERS]) {
    const raw = request.headers.get(header);
    if (!raw) continue;
    const chain = extractIpsFromHeader(header, raw);
    if (chain.length === 0) continue;
    const details = {
      ip: pickBestClientIp(chain),
      source: header,
      chain,
    };
    if (details.ip && !isContainerHopIp(details.ip) && !isLoopbackIp(details.ip)) {
      return details;
    }
    if (!fallback || isPreferredFallback(details, fallback)) fallback = details;
  }

  return fallback ?? {
    ip: null,
    source: null,
    chain: [],
  };
}

function isPreferredFallback(next: ClientIpDetails, current: ClientIpDetails): boolean {
  const nextIsCustom = FALLBACK_IP_HEADERS.includes(
    next.source as (typeof FALLBACK_IP_HEADERS)[number]
  );
  const currentIsCustom = FALLBACK_IP_HEADERS.includes(
    current.source as (typeof FALLBACK_IP_HEADERS)[number]
  );

  if (currentIsCustom && !nextIsCustom) return true;
  if (nextIsCustom && !currentIsCustom) return false;
  return false;
}

export function getPathname(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

function extractIpsFromHeader(header: string, raw: string): string[] {
  const candidates =
    header === "forwarded"
      ? raw
          .split(",")
          .flatMap((part) =>
            [...part.matchAll(/for=(?:"?\[?([A-Fa-f0-9:.]+)\]?"?)/g)].map((match) => match[1] ?? "")
          )
      : raw.split(",");

  return candidates
    .map((value) => normalizeIpToken(value))
    .filter((value): value is string => Boolean(value));
}

function normalizeIpToken(raw: string): string | null {
  let value = raw.trim();
  if (!value || value.toLowerCase() === "unknown") return null;

  if (value.startsWith("for=")) {
    value = value.slice(4).trim();
  }

  value = value.replace(/^"|"$/g, "");

  if (value.startsWith("[")) {
    const closing = value.indexOf("]");
    if (closing !== -1) {
      return value.slice(1, closing);
    }
  }

  const ipv4WithPort = value.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort) return ipv4WithPort[1] ?? null;

  return value;
}

function pickBestClientIp(chain: string[]): string | null {
  const nonContainer = chain.find((ip) => !isContainerHopIp(ip) && !isLoopbackIp(ip));
  if (nonContainer) return nonContainer;

  const nonLoopback = chain.find((ip) => !isLoopbackIp(ip));
  if (nonLoopback) return nonLoopback;

  return chain[0] ?? null;
}

function isLoopbackIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized === "127.0.0.1" || normalized.startsWith("127.");
}

function isContainerHopIp(ip: string): boolean {
  if (isLoopbackIp(ip)) return true;

  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1] ?? "");
    if (Number.isInteger(second) && second >= 16 && second <= 31) return true;
  }

  if (ip.startsWith("192.168.")) {
    const third = Number(ip.split(".")[2] ?? "");
    if (Number.isInteger(third) && third >= 64 && third <= 255) return true;
  }

  return false;
}
