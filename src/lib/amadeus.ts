import type { FlightOffer, FlightItinerary, FlightSegment } from "@/types/flight";
import { toBRL } from "@/lib/currency";
import { buildBookingLink } from "@/lib/bookingLink";

const AMADEUS_ENV = process.env.AMADEUS_ENV === "production" ? "production" : "test";
const BASE_URL = AMADEUS_ENV === "production" ? "https://api.amadeus.com" : "https://test.api.amadeus.com";

export function amadeusConfigured(): boolean {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5000) {
    return tokenCache.token;
  }
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AmadeusError("AMADEUS_CLIENT_ID/AMADEUS_CLIENT_SECRET não configurados", 0);
  }

  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new AmadeusError(`Falha na autenticação com a Amadeus (HTTP ${res.status})`, res.status);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.token;
}

export class AmadeusError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface AmadeusSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
}

export async function searchAirportsRemote(keyword: string): Promise<
  Array<{ iata: string; name: string; city: string; country: string }>
> {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}/v1/reference-data/locations`);
  url.searchParams.set("subType", "AIRPORT");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("page[limit]", "10");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new AmadeusError(`Busca de aeroportos falhou (HTTP ${res.status})`, res.status);
  const data = await res.json();

  return (data.data || []).map((loc: Record<string, unknown>) => ({
    iata: loc.iataCode as string,
    name: loc.name as string,
    city: (loc.address as { cityName?: string } | undefined)?.cityName || (loc.name as string),
    country: (loc.address as { countryName?: string } | undefined)?.countryName || "",
  }));
}

export async function searchAmadeusFlightOffers(
  params: AmadeusSearchParams
): Promise<{ offers: FlightOffer[]; warnings: string[] }> {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}/v2/shopping/flight-offers`);
  url.searchParams.set("originLocationCode", params.origin);
  url.searchParams.set("destinationLocationCode", params.destination);
  url.searchParams.set("departureDate", params.departureDate);
  if (params.returnDate) url.searchParams.set("returnDate", params.returnDate);
  url.searchParams.set("adults", String(params.adults));
  url.searchParams.set("currencyCode", "USD");
  url.searchParams.set("max", "10");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 429) {
    throw new AmadeusError("Limite de requisições da Amadeus excedido (rate limit)", 429);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AmadeusError(`Busca de voos falhou (HTTP ${res.status}): ${body.slice(0, 300)}`, res.status);
  }

  const data = await res.json();
  const carriers: Record<string, string> = data.dictionaries?.carriers || {};
  const warnings: string[] = [];

  const offers: FlightOffer[] = [];
  for (const raw of data.data || []) {
    try {
      offers.push(await normalizeAmadeusOffer(raw, carriers, params));
    } catch {
      warnings.push("Uma oferta retornada pela Amadeus não pôde ser processada e foi ignorada.");
    }
  }

  return { offers, warnings };
}

async function normalizeAmadeusOffer(
  raw: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  carriers: Record<string, string>,
  params: AmadeusSearchParams
): Promise<FlightOffer> {
  const itineraries: FlightItinerary[] = raw.itineraries.map((it: Record<string, any>) => normalizeItinerary(it, carriers)); // eslint-disable-line @typescript-eslint/no-explicit-any
  const outbound = itineraries[0];
  const inbound = itineraries[1];

  const priceTotal = parseFloat(raw.price.total);
  const priceCurrency = raw.price.currency;
  const priceBRL = await toBRL(priceTotal, priceCurrency);

  const carrierCodes = Array.from(
    new Set(itineraries.flatMap((it) => it.segments.map((s) => s.carrierCode)))
  );

  const totalDurationMinutes = itineraries.reduce((sum, it) => sum + it.durationMinutes, 0);
  const totalStops = Math.max(...itineraries.map((it) => it.stops));

  const offerForLink = {
    carrierCodes,
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
  };

  return {
    id: `amadeus-${raw.id}-${params.origin}-${params.destination}-${params.departureDate}`,
    source: "amadeus",
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
    bookingLink: buildBookingLink(offerForLink),
    bookingLinkNote:
      "A Amadeus (modo busca) não fornece link de checkout direto — este link abre a busca equivalente para você finalizar a compra.",
    isMock: false,
    originRequested: params.origin,
    destinationRequested: params.destination,
    originActual: params.origin,
    destinationActual: params.destination,
  };
}

function normalizeItinerary(raw: Record<string, any>, carriers: Record<string, string>): FlightItinerary { // eslint-disable-line @typescript-eslint/no-explicit-any
  const segments: FlightSegment[] = raw.segments.map((seg: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    carrierCode: seg.carrierCode,
    carrierName: carriers[seg.carrierCode] || seg.carrierCode,
    flightNumber: seg.number,
    from: seg.departure.iataCode,
    to: seg.arrival.iataCode,
    departureAt: seg.departure.at,
    arrivalAt: seg.arrival.at,
    durationMinutes: parseISODuration(seg.duration || raw.duration),
  }));

  return {
    segments,
    durationMinutes: parseISODuration(raw.duration),
    stops: segments.length - 1,
  };
}

export function parseISODuration(iso: string | undefined): number {
  if (!iso) return 0;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!match) return 0;
  const days = parseInt(match[1] || "0", 10);
  const hours = parseInt(match[2] || "0", 10);
  const minutes = parseInt(match[3] || "0", 10);
  return days * 24 * 60 + hours * 60 + minutes;
}
