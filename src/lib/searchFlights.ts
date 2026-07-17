import type { SearchQuery, SearchResult, FlightOffer, DateHeatmapEntry, AwardOption } from "@/types/flight";
import { buildDateMatrix, type DatePair, MAX_DATE_COMBINATIONS } from "@/lib/dateMatrix";
import { nearbyAirports } from "@/lib/airports";
import { getCombinedRoute, type GroundTransfer } from "@/lib/combinedRoutes";
import { amadeusConfigured, searchAmadeusFlightOffers, AmadeusError } from "@/lib/amadeus";
import { duffelConfigured, searchDuffelFlightOffers, DuffelError } from "@/lib/duffel";
import { generateMockOffers } from "@/lib/mockData";
import { getCached, setCached, cacheKey } from "@/lib/cache";
import { createLimiter } from "@/lib/concurrency";
import { seatsAeroConfigured, searchAwardAvailability, SeatsAeroError } from "@/lib/seatsAero";

// Total (origin airport x destination airport x date pair) combinations a
// single search will actually execute. Flexible dates + nearby airports can
// multiply quickly (e.g. 3 origins x 2 destinations x 49 date pairs = 294),
// so this is the real backstop protecting the free tier — MAX_DATE_COMBINATIONS
// alone isn't enough once airport fan-out is added.
const MAX_TOTAL_COMBINATIONS = 60;
const MAX_SPLIT_COMBINATIONS = 30;
const PROVIDER_CONCURRENCY = 3;

interface Combo {
  origin: string;
  destination: string;
  datePair: DatePair;
  combinedInfo?: GroundTransfer & { arrivalAirport: string };
}

type Provider = "duffel" | "amadeus" | "mock";

function selectProvider(): Provider {
  if (duffelConfigured()) return "duffel";
  if (amadeusConfigured()) return "amadeus";
  return "mock";
}

export async function searchFlights(query: SearchQuery): Promise<SearchResult> {
  const warnings: string[] = [];
  const provider = selectProvider();
  const mockMode = provider === "mock";

  const originVariants = uniq([query.origin, ...(query.nearbyAirports ? nearbyAirports(query.origin) : [])]);

  const combinedRoute = getCombinedRoute(query.destination);
  let combinedRouteNote: string | undefined;
  let destinationTargets: Array<{ airport: string; combinedInfo?: Combo["combinedInfo"] }>;

  if (combinedRoute) {
    combinedRouteNote = combinedRoute.note;
    destinationTargets = combinedRoute.options.map((opt) => ({
      airport: opt.arrivalAirport,
      combinedInfo: { arrivalAirport: opt.arrivalAirport, ...opt.groundTransfer },
    }));
  } else {
    destinationTargets = uniq([
      query.destination,
      ...(query.nearbyAirports ? nearbyAirports(query.destination) : []),
    ]).map((airport) => ({ airport }));
  }

  const datePairs = buildDateMatrix(query.departureDate, query.returnDate, query.flexDays);

  const combos: Combo[] = [];
  for (const origin of originVariants) {
    for (const dest of destinationTargets) {
      for (const datePair of datePairs) {
        combos.push({ origin, destination: dest.airport, datePair, combinedInfo: dest.combinedInfo });
      }
    }
  }

  let finalCombos = combos;
  if (combos.length > MAX_TOTAL_COMBINATIONS) {
    finalCombos = combos.slice(0, MAX_TOTAL_COMBINATIONS);
    warnings.push(
      `A combinação de datas flexíveis + aeroportos próximos gerou ${combos.length} buscas; ` +
        `limitado às primeiras ${MAX_TOTAL_COMBINATIONS} para não estourar o limite gratuito da API.`
    );
  }

  const limiter = createLimiter(PROVIDER_CONCURRENCY);

  let allOffers = await fetchOffers(finalCombos, query, provider, limiter, warnings);

  // Split-ticket comparison: two separate one-way fares can beat any single
  // round-trip bundle, especially across different carriers. Only worth the
  // extra calls for round trips — a one-way search has nothing to split.
  if (query.returnDate) {
    const splitOffer = await searchSplitOption(
      query,
      originVariants,
      destinationTargets,
      datePairs,
      provider,
      limiter,
      warnings
    );
    if (splitOffer) allOffers.push(splitOffer);
  }

  allOffers = dedupeOffers(allOffers);
  allOffers.sort((a, b) => a.priceBRL - b.priceBRL);

  const heatmap = buildHeatmap(allOffers);
  const bestOfferId = allOffers.length ? allOffers[0].id : null;

  if (allOffers.length === 0) {
    if (combinedRoute) {
      warnings.push(
        "Nenhuma oferta encontrada em nenhuma das opções combinadas (voo + trecho terrestre) para essas datas."
      );
    } else {
      warnings.push(
        "Nenhum voo encontrado para esta rota/data. Tente ativar 'datas flexíveis' ou 'aeroportos próximos', " +
          "ou verifique se este destino exige um trecho terrestre (ex.: Ciudad del Este via Assunção ou Foz do Iguaçu)."
      );
    }
  }

  let awardOptions: AwardOption[] | undefined;
  let awardOptionsNote: string | undefined;
  if (seatsAeroConfigured() && !combinedRoute) {
    try {
      awardOptions = await searchAwards(query, datePairs);
      if (awardOptions.length === 0) {
        awardOptionsNote = "Nenhuma disponibilidade de milhas encontrada para esta rota/datas.";
      }
    } catch (err) {
      awardOptionsNote =
        err instanceof SeatsAeroError
          ? `Busca de milhas (seats.aero) falhou: ${err.message}`
          : "Busca de milhas (seats.aero) falhou por um erro inesperado.";
    }
  }

  return {
    query,
    offers: allOffers,
    heatmap,
    bestOfferId,
    usedMockData: mockMode,
    warnings,
    combinedRouteNote,
    awardOptions,
    awardOptionsNote,
  };
}

async function fetchOffers(
  combos: Combo[],
  query: SearchQuery,
  provider: Provider,
  limiter: <T>(task: () => Promise<T>) => Promise<T>,
  warnings: string[]
): Promise<FlightOffer[]> {
  const perComboResults = await Promise.all(
    combos.map((combo) =>
      limiter(async () => {
        const key = cacheKey({
          origin: combo.origin,
          destination: combo.destination,
          dep: combo.datePair.departureDate,
          ret: combo.datePair.returnDate,
          adults: query.adults,
          provider,
        });

        const cached = await getCached<FlightOffer[]>(key);
        if (cached) return { offers: cached, combo };

        const params = {
          origin: combo.origin,
          destination: combo.destination,
          departureDate: combo.datePair.departureDate,
          returnDate: combo.datePair.returnDate,
          adults: query.adults,
        };

        try {
          let offers: FlightOffer[];
          if (provider === "duffel") {
            const result = await searchDuffelFlightOffers(params);
            offers = result.offers;
            if (result.warnings.length) warnings.push(...result.warnings);
          } else if (provider === "amadeus") {
            const result = await searchAmadeusFlightOffers(params);
            offers = result.offers;
            if (result.warnings.length) warnings.push(...result.warnings);
          } else {
            offers = await generateMockOffers(params);
          }
          await setCached(key, offers);
          return { offers, combo };
        } catch (err) {
          if (err instanceof AmadeusError || err instanceof DuffelError) {
            warnings.push(
              `${combo.origin} → ${combo.destination} em ${combo.datePair.departureDate}: ${err.message}`
            );
          } else {
            warnings.push(`${combo.origin} → ${combo.destination}: erro inesperado na busca.`);
          }
          return { offers: [], combo };
        }
      })
    )
  );

  const annotated: FlightOffer[] = [];
  for (const { offers, combo } of perComboResults) {
    for (const offer of offers) {
      annotated.push({
        ...offer,
        originRequested: query.origin,
        destinationRequested: query.destination,
        originActual: combo.origin,
        destinationActual: combo.destination,
        combinedRoute: combo.combinedInfo,
      });
    }
  }
  return annotated;
}

async function searchSplitOption(
  query: SearchQuery,
  originVariants: string[],
  destinationTargets: Array<{ airport: string; combinedInfo?: Combo["combinedInfo"] }>,
  datePairs: DatePair[],
  provider: Provider,
  limiter: <T>(task: () => Promise<T>) => Promise<T>,
  warnings: string[]
): Promise<FlightOffer | null> {
  const departureDates = Array.from(new Set(datePairs.map((d) => d.departureDate)));
  const returnDates = Array.from(new Set(datePairs.map((d) => d.returnDate).filter((d): d is string => !!d)));

  const outboundCombos: Combo[] = [];
  for (const origin of originVariants) {
    for (const dest of destinationTargets) {
      for (const departureDate of departureDates) {
        outboundCombos.push({ origin, destination: dest.airport, datePair: { departureDate }, combinedInfo: dest.combinedInfo });
      }
    }
  }
  const inboundCombos: Combo[] = [];
  for (const dest of destinationTargets) {
    for (const origin of originVariants) {
      for (const departureDate of returnDates) {
        inboundCombos.push({ origin: dest.airport, destination: origin, datePair: { departureDate }, combinedInfo: dest.combinedInfo });
      }
    }
  }

  const cappedOutbound = outboundCombos.slice(0, MAX_SPLIT_COMBINATIONS);
  const cappedInbound = inboundCombos.slice(0, MAX_SPLIT_COMBINATIONS);
  if (outboundCombos.length > MAX_SPLIT_COMBINATIONS || inboundCombos.length > MAX_SPLIT_COMBINATIONS) {
    warnings.push(
      `Comparação de passagens separadas limitada às primeiras ${MAX_SPLIT_COMBINATIONS} combinações por trecho.`
    );
  }

  const [outboundLegs, inboundLegs] = await Promise.all([
    fetchOffers(cappedOutbound, query, provider, limiter, warnings),
    fetchOffers(cappedInbound, query, provider, limiter, warnings),
  ]);

  const bestOut = cheapest(outboundLegs);
  const bestIn = cheapest(inboundLegs);
  if (!bestOut || !bestIn) return null;

  return {
    id: `split-${bestOut.id}-${bestIn.id}`,
    source: bestOut.source,
    priceTotal: bestOut.priceTotal + bestIn.priceTotal,
    priceCurrency: bestOut.priceCurrency,
    priceBRL: bestOut.priceBRL + bestIn.priceBRL,
    departureDate: bestOut.departureDate,
    returnDate: bestIn.departureDate,
    outbound: bestOut.outbound,
    inbound: bestIn.outbound,
    carrierCodes: Array.from(new Set([...bestOut.carrierCodes, ...bestIn.carrierCodes])),
    totalStops: Math.max(bestOut.totalStops, bestIn.totalStops),
    totalDurationMinutes: bestOut.totalDurationMinutes + bestIn.totalDurationMinutes,
    bookingLink: bestOut.bookingLink,
    bookingLinkNote:
      "Duas passagens só-ida separadas (possivelmente companhias diferentes) — compre cada uma no seu próprio link.",
    isMock: bestOut.isMock || bestIn.isMock,
    combinedRoute: bestOut.combinedRoute,
    originRequested: query.origin,
    destinationRequested: query.destination,
    originActual: bestOut.originActual,
    destinationActual: bestOut.destinationActual,
    isSplit: true,
    splitOutboundLeg: {
      bookingLink: bestOut.bookingLink,
      priceTotal: bestOut.priceTotal,
      priceCurrency: bestOut.priceCurrency,
      priceBRL: bestOut.priceBRL,
    },
    splitInboundLeg: {
      bookingLink: bestIn.bookingLink,
      priceTotal: bestIn.priceTotal,
      priceCurrency: bestIn.priceCurrency,
      priceBRL: bestIn.priceBRL,
    },
  };
}

function cheapest(offers: FlightOffer[]): FlightOffer | null {
  if (offers.length === 0) return null;
  return offers.reduce((min, o) => (o.priceBRL < min.priceBRL ? o : min), offers[0]);
}

async function searchAwards(query: SearchQuery, datePairs: DatePair[]): Promise<AwardOption[]> {
  const departureDates = datePairs.map((d) => d.departureDate).sort();
  const startDate = departureDates[0];
  const endDate = departureDates[departureDates.length - 1];

  const outbound = await searchAwardAvailability({
    origin: query.origin,
    destination: query.destination,
    startDate,
    endDate,
  });

  if (!query.returnDate) return outbound;

  const returnDates = datePairs.map((d) => d.returnDate).filter((d): d is string => !!d).sort();
  const inbound = await searchAwardAvailability({
    origin: query.destination,
    destination: query.origin,
    startDate: returnDates[0] ?? query.returnDate,
    endDate: returnDates[returnDates.length - 1] ?? query.returnDate,
  });

  return [...outbound, ...inbound];
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.toUpperCase())));
}

function dedupeOffers(offers: FlightOffer[]): FlightOffer[] {
  const byKey = new Map<string, FlightOffer>();
  for (const offer of offers) {
    const firstSeg = offer.outbound.segments[0];
    const key = `${firstSeg.carrierCode}${firstSeg.flightNumber}-${offer.departureDate}-${offer.returnDate ?? ""}-${offer.destinationActual}`;
    const existing = byKey.get(key);
    if (!existing || offer.priceBRL < existing.priceBRL) {
      byKey.set(key, offer);
    }
  }
  return Array.from(byKey.values());
}

function buildHeatmap(offers: FlightOffer[]): DateHeatmapEntry[] {
  const byDate = new Map<string, DateHeatmapEntry>();
  for (const offer of offers) {
    const key = `${offer.departureDate}|${offer.returnDate ?? ""}`;
    const existing = byDate.get(key);
    if (!existing || offer.priceBRL < (existing.lowestPriceBRL ?? Infinity)) {
      byDate.set(key, {
        departureDate: offer.departureDate,
        returnDate: offer.returnDate,
        lowestPriceBRL: offer.priceBRL,
      });
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.departureDate.localeCompare(b.departureDate));
}

export { MAX_DATE_COMBINATIONS };
