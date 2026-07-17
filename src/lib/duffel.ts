import type { FlightOffer, FlightItinerary, FlightSegment } from "@/types/flight";
import { toBRL } from "@/lib/currency";
import { buildBookingLink } from "@/lib/bookingLink";
import { parseISODuration } from "@/lib/amadeus";

// Duffel API client — the primary flight-data provider now that Amadeus has
// shut down its self-service developer portal (2026-07-17). Search-only
// usage (no booking/order creation) is effectively free: Duffel only charges
// per confirmed order ($3) plus a small excess-search fee past a 1,500
// searches-per-order ratio (https://duffel.com/pricing) — this app never
// creates an order, so normal personal use shouldn't incur any cost.
//
// Test-mode tokens (duffel_test_...) hit each airline's own sandbox
// environment, so results are realistic but not live market prices. Live
// tokens (duffel_live_...) require completing account verification in the
// Duffel dashboard (email, company info, payment details) — see
// https://duffel.com/docs/api/overview/test-mode.
const BASE_URL = "https://api.duffel.com";
const API_VERSION = "v2";

export function duffelConfigured(): boolean {
  return Boolean(process.env.DUFFEL_ACCESS_TOKEN);
}

export class DuffelError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface DuffelSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
}

export async function searchDuffelFlightOffers(
  params: DuffelSearchParams
): Promise<{ offers: FlightOffer[]; warnings: string[] }> {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) throw new DuffelError("DUFFEL_ACCESS_TOKEN não configurado", 0);

  const slices = [{ origin: params.origin, destination: params.destination, departure_date: params.departureDate }];
  if (params.returnDate) {
    slices.push({ origin: params.destination, destination: params.origin, departure_date: params.returnDate });
  }

  const res = await fetch(`${BASE_URL}/air/offer_requests?return_offers=true&supplier_timeout=15000`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        slices,
        passengers: Array.from({ length: params.adults }, () => ({ type: "adult" })),
        cabin_class: "economy",
      },
    }),
  });

  if (res.status === 429) {
    throw new DuffelError("Limite de requisições da Duffel excedido (rate limit)", 429);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DuffelError(`Busca de voos falhou (HTTP ${res.status}): ${body.slice(0, 300)}`, res.status);
  }

  const json = await res.json();
  const rawOffers: Array<Record<string, any>> = json.data?.offers ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const warnings: string[] = [];

  const offers: FlightOffer[] = [];
  for (const raw of rawOffers) {
    try {
      offers.push(await normalizeDuffelOffer(raw, params));
    } catch {
      warnings.push("Uma oferta retornada pela Duffel não pôde ser processada e foi ignorada.");
    }
  }

  return { offers, warnings };
}

async function normalizeDuffelOffer(
  raw: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  params: DuffelSearchParams
): Promise<FlightOffer> {
  const itineraries: FlightItinerary[] = raw.slices.map((slice: Record<string, any>) => normalizeSlice(slice)); // eslint-disable-line @typescript-eslint/no-explicit-any
  const outbound = itineraries[0];
  const inbound = itineraries[1];

  const priceTotal = parseFloat(raw.total_amount);
  const priceCurrency = raw.total_currency;
  const priceBRL = await toBRL(priceTotal, priceCurrency);

  const carrierCodes = Array.from(
    new Set(itineraries.flatMap((it) => it.segments.map((s) => s.carrierCode)))
  );

  const totalDurationMinutes = itineraries.reduce((sum, it) => sum + it.durationMinutes, 0);
  const totalStops = Math.max(...itineraries.map((it) => it.stops));

  return {
    id: `duffel-${raw.id}-${params.origin}-${params.destination}-${params.departureDate}`,
    source: "amadeus", // reuses the same "real provider" badge semantics as Amadeus (isMock: false)
    priceTotal,
    priceCurrency,
    priceBRL,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    outbound,
    inbound,
    carrierCodes,
    totalStops,
    totalDurationMinutes,
    bookingLink: buildBookingLink({
      carrierCodes,
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
    }),
    bookingLinkNote:
      "A Duffel (modo busca) não fornece link de checkout direto — este link abre a busca equivalente para você finalizar a compra.",
    isMock: false,
    originRequested: params.origin,
    destinationRequested: params.destination,
    originActual: params.origin,
    destinationActual: params.destination,
  };
}

function normalizeSlice(raw: Record<string, any>): FlightItinerary { // eslint-disable-line @typescript-eslint/no-explicit-any
  const segments: FlightSegment[] = raw.segments.map((seg: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    carrierCode: seg.marketing_carrier?.iata_code ?? seg.operating_carrier?.iata_code ?? "??",
    carrierName: seg.marketing_carrier?.name ?? seg.operating_carrier?.name ?? "Companhia desconhecida",
    flightNumber: String(seg.marketing_carrier_flight_number ?? seg.operating_carrier_flight_number ?? ""),
    from: seg.origin?.iata_code ?? raw.origin?.iata_code,
    to: seg.destination?.iata_code ?? raw.destination?.iata_code,
    departureAt: seg.departing_at,
    arrivalAt: seg.arriving_at,
    durationMinutes: parseISODuration(seg.duration),
  }));

  return {
    segments,
    durationMinutes: segments.reduce((sum, s) => sum + s.durationMinutes, 0),
    stops: segments.length - 1,
  };
}
