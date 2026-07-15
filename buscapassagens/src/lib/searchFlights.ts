import type { SearchQuery, SearchResult, FlightOffer, DateHeatmapEntry } from "@/types/flight";
import { buildDateMatrix, type DatePair, MAX_DATE_COMBINATIONS } from "@/lib/dateMatrix";
import { nearbyAirports } from "@/lib/airports";
import { getCombinedRoute, type GroundTransfer } from "@/lib/combinedRoutes";
import { amadeusConfigured, searchAmadeusFlightOffers, AmadeusError } from "@/lib/amadeus";
import { generateMockOffers } from "@/lib/mockData";
import { getCached, setCached, cacheKey } from "@/lib/cache";
import { createLimiter } from "@/lib/concurrency";

// Total (origin airport x destination airport x date pair) combinations a
// single search will actually execute. Flexible dates + nearby airports can
// multiply quickly (e.g. 3 origins x 2 destinations x 49 date pairs = 294),
// so this is the real backstop protecting the free tier — MAX_DATE_COMBINATIONS
// alone isn't enough once airport fan-out is added.
const MAX_TOTAL_COMBINATIONS = 60;
const AMADEUS_CONCURRENCY = 3;

interface Combo {
  origin: string;
  destination: string;
  datePair: DatePair;
  combinedInfo?: GroundTransfer & { arrivalAirport: string };
}

export async function searchFlights(query: SearchQuery): Promise<SearchResult> {
  const warnings: string[] = [];
  const mockMode = !amadeusConfigured();

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

  const limiter = createLimiter(AMADEUS_CONCURRENCY);

  const perComboResults = await Promise.all(
    finalCombos.map((combo) =>
      limiter(async () => {
        const key = cacheKey({
          origin: combo.origin,
          destination: combo.destination,
          dep: combo.datePair.departureDate,
          ret: combo.datePair.returnDate,
          adults: query.adults,
          mock: mockMode,
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
          if (mockMode) {
            offers = await generateMockOffers(params);
          } else {
            const result = await searchAmadeusFlightOffers(params);
            offers = result.offers;
            if (result.warnings.length) warnings.push(...result.warnings);
          }
          await setCached(key, offers);
          return { offers, combo };
        } catch (err) {
          if (err instanceof AmadeusError) {
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

  let allOffers: FlightOffer[] = [];
  for (const { offers, combo } of perComboResults) {
    for (const offer of offers) {
      allOffers.push({
        ...offer,
        originRequested: query.origin,
        destinationRequested: query.destination,
        originActual: combo.origin,
        destinationActual: combo.destination,
        combinedRoute: combo.combinedInfo,
      });
    }
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

  return {
    query,
    offers: allOffers,
    heatmap,
    bestOfferId,
    usedMockData: mockMode,
    warnings,
    combinedRouteNote,
  };
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
