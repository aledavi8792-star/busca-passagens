import type { AwardOption } from "@/types/flight";

// Optional data source for award-seat (miles/points) availability, via
// seats.aero's Partner API. This is a separate paid/free-tier signup at
// https://seats.aero — get a Partner-Authorization key from their
// developer portal. Cash-fare search (Amadeus) and award search are
// fundamentally different data sources (airline loyalty inventory isn't
// exposed by Amadeus), so this is additive, not a replacement.
//
// Endpoint/params follow seats.aero's documented Partner API as of this
// writing (GET /partnerapi/search with Partner-Authorization header) —
// verify against https://developers.seats.aero if responses stop matching
// the shape parsed below, since third-party API contracts do change.
const BASE_URL = "https://seats.aero/partnerapi";

export function seatsAeroConfigured(): boolean {
  return Boolean(process.env.SEATS_AERO_API_KEY);
}

export interface SeatsAeroParams {
  origin: string;
  destination: string;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
}

export class SeatsAeroError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function searchAwardAvailability(params: SeatsAeroParams): Promise<AwardOption[]> {
  const apiKey = process.env.SEATS_AERO_API_KEY;
  if (!apiKey) throw new SeatsAeroError("SEATS_AERO_API_KEY não configurada", 0);

  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set("origin_airport", params.origin);
  url.searchParams.set("destination_airport", params.destination);
  url.searchParams.set("start_date", params.startDate);
  url.searchParams.set("end_date", params.endDate);

  const res = await fetch(url, {
    headers: { "Partner-Authorization": apiKey, Accept: "application/json" },
  });

  if (res.status === 429) {
    throw new SeatsAeroError("Limite de requisições da seats.aero excedido (rate limit)", 429);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SeatsAeroError(`Busca de milhas falhou (HTTP ${res.status}): ${body.slice(0, 300)}`, res.status);
  }

  const data = await res.json();
  const rows: Array<Record<string, unknown>> = data.data ?? data.results ?? [];

  return rows.map((row) => normalizeAwardRow(row, params)).filter((r): r is AwardOption => r !== null);
}

function normalizeAwardRow(row: Record<string, unknown>, params: SeatsAeroParams): AwardOption | null {
  const cabin = pickCheapestCabin(row);
  if (!cabin) return null;

  return {
    program: String(row.source ?? row.program ?? "desconhecido"),
    origin: String(row.OriginAirport ?? row.origin_airport ?? params.origin),
    destination: String(row.DestinationAirport ?? row.destination_airport ?? params.destination),
    date: String(row.Date ?? row.date ?? params.startDate),
    cabin: cabin.name,
    miles: cabin.miles,
    taxesFeesUSD: cabin.taxesUSD,
    direct: Boolean(row.Direct ?? row.direct ?? false),
    seatsAvailable: Number(row.RemainingSeats ?? row.seats_available ?? 0),
  };
}

const CABIN_FIELDS: Array<{ name: string; milesField: string; taxesField: string }> = [
  { name: "economy", milesField: "YMileageCost", taxesField: "YTotalTaxes" },
  { name: "premium", milesField: "WMileageCost", taxesField: "WTotalTaxes" },
  { name: "business", milesField: "JMileageCost", taxesField: "JTotalTaxes" },
  { name: "first", milesField: "FMileageCost", taxesField: "FTotalTaxes" },
];

function pickCheapestCabin(row: Record<string, unknown>): { name: string; miles: number; taxesUSD: number } | null {
  let best: { name: string; miles: number; taxesUSD: number } | null = null;
  for (const cabin of CABIN_FIELDS) {
    const milesRaw = row[cabin.milesField];
    const miles = typeof milesRaw === "string" ? parseInt(milesRaw, 10) : Number(milesRaw);
    if (!miles || Number.isNaN(miles)) continue;
    const taxesRaw = row[cabin.taxesField];
    const taxesCents = typeof taxesRaw === "string" ? parseInt(taxesRaw, 10) : Number(taxesRaw) || 0;
    const candidate = { name: cabin.name, miles, taxesUSD: taxesCents / 100 };
    if (!best || candidate.miles < best.miles) best = candidate;
  }
  return best;
}
