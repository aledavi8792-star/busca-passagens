import { addMinutes, parseISO } from "date-fns";
import type { FlightOffer, FlightItinerary } from "@/types/flight";
import { toBRL } from "@/lib/currency";
import { buildBookingLink } from "@/lib/bookingLink";
import type { AmadeusSearchParams } from "@/lib/amadeus";

// Deterministic mock flight offers, used whenever AMADEUS_CLIENT_ID/SECRET
// are not configured, so the full search flow (flexible dates, heatmap,
// combined routes, sorting) can be validated end to end before signing up
// for a real API key. Every offer this module returns has isMock: true and
// the UI must surface that clearly — this is NOT a source of real prices.

const ROUTE_CARRIERS: Record<string, Array<{ code: string; name: string; basePriceUSD: number; directOnly?: boolean }>> = {
  "BSB-AGT": [
    { code: "PZ", name: "Paranair", basePriceUSD: 210 },
    { code: "LA", name: "LATAM", basePriceUSD: 260 },
  ],
  "BSB-IGU": [
    { code: "G3", name: "GOL", basePriceUSD: 95, directOnly: true },
    { code: "AD", name: "Azul", basePriceUSD: 105, directOnly: true },
    { code: "LA", name: "LATAM", basePriceUSD: 120 },
  ],
};

const DEFAULT_CARRIERS = [
  { code: "LA", name: "LATAM", basePriceUSD: 300 },
  { code: "G3", name: "GOL", basePriceUSD: 280 },
];

function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

export async function generateMockOffers(params: AmadeusSearchParams): Promise<FlightOffer[]> {
  const routeKey = `${params.origin}-${params.destination}`;
  const carriers = ROUTE_CARRIERS[routeKey] || DEFAULT_CARRIERS;
  const offers: FlightOffer[] = [];

  for (const carrier of carriers) {
    const seed = `${routeKey}-${params.departureDate}-${params.returnDate ?? ""}-${carrier.code}`;
    const rand = seededRandom(seed);
    const dayOfWeek = parseISO(params.departureDate).getDay();
    // Cheaper mid-week (Tue/Wed), pricier Fri/Sun — mirrors real fare patterns
    const weekdayMultiplier = [1.15, 0.95, 0.85, 0.9, 1.05, 1.25, 1.15][dayOfWeek];
    const priceUSD = Math.round(carrier.basePriceUSD * weekdayMultiplier * (0.85 + rand * 0.3) * params.adults);

    const hasStop = !carrier.directOnly && rand > 0.5;
    const outbound = buildMockItinerary(params.origin, params.destination, params.departureDate, carrier.code, hasStop, rand);
    const inbound = params.returnDate
      ? buildMockItinerary(params.destination, params.origin, params.returnDate, carrier.code, hasStop, 1 - rand)
      : undefined;

    const priceBRL = await toBRL(priceUSD, "USD");
    const totalStops = Math.max(outbound.stops, inbound?.stops ?? 0);
    const totalDurationMinutes = outbound.durationMinutes + (inbound?.durationMinutes ?? 0);

    offers.push({
      id: `mock-${seed}`,
      source: "mock",
      priceTotal: priceUSD,
      priceCurrency: "USD",
      priceBRL,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      outbound,
      inbound,
      carrierCodes: [carrier.code],
      totalStops,
      totalDurationMinutes,
      bookingLink: buildBookingLink({
        carrierCodes: [carrier.code],
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.returnDate,
      }),
      bookingLinkNote: "Dados simulados (mock) — configure AMADEUS_CLIENT_ID/SECRET para preços reais.",
      isMock: true,
      originRequested: params.origin,
      destinationRequested: params.destination,
      originActual: params.origin,
      destinationActual: params.destination,
    });
  }

  return offers;
}

function buildMockItinerary(
  from: string,
  to: string,
  date: string,
  carrierCode: string,
  hasStop: boolean,
  rand: number
): FlightItinerary {
  const departureAt = new Date(parseISO(date).getTime());
  departureAt.setHours(6 + Math.floor(rand * 14), Math.floor(rand * 60));

  if (!hasStop) {
    const durationMinutes = 90 + Math.floor(rand * 60);
    const arrivalAt = addMinutes(departureAt, durationMinutes);
    return {
      durationMinutes,
      stops: 0,
      segments: [
        {
          carrierCode,
          carrierName: carrierCode,
          flightNumber: String(1000 + Math.floor(rand * 8000)),
          from,
          to,
          departureAt: departureAt.toISOString(),
          arrivalAt: arrivalAt.toISOString(),
          durationMinutes,
        },
      ],
    };
  }

  const connection = "GRU";
  const leg1Duration = 70 + Math.floor(rand * 40);
  const layover = 60 + Math.floor(rand * 90);
  const leg2Duration = 80 + Math.floor(rand * 50);
  const leg1Arrival = addMinutes(departureAt, leg1Duration);
  const leg2Departure = addMinutes(leg1Arrival, layover);
  const leg2Arrival = addMinutes(leg2Departure, leg2Duration);

  return {
    durationMinutes: leg1Duration + layover + leg2Duration,
    stops: 1,
    segments: [
      {
        carrierCode,
        carrierName: carrierCode,
        flightNumber: String(1000 + Math.floor(rand * 8000)),
        from,
        to: connection,
        departureAt: departureAt.toISOString(),
        arrivalAt: leg1Arrival.toISOString(),
        durationMinutes: leg1Duration,
      },
      {
        carrierCode,
        carrierName: carrierCode,
        flightNumber: String(1000 + Math.floor(rand * 8000)),
        from: connection,
        to,
        departureAt: leg2Departure.toISOString(),
        arrivalAt: leg2Arrival.toISOString(),
        durationMinutes: leg2Duration,
      },
    ],
  };
}
