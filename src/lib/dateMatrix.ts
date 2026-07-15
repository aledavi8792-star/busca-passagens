import { addDays, format, parseISO, differenceInCalendarDays } from "date-fns";

export interface DatePair {
  departureDate: string; // yyyy-MM-dd
  returnDate?: string; // yyyy-MM-dd
}

// Hard cap on how many (departure, return) combinations a single search can
// generate. Protects the Amadeus free tier from a runaway 7x7=49-call burst
// when someone cranks flexDays up. With flexDays=3 (the UI max) a round trip
// is exactly 7x7=49, right at the cap.
export const MAX_DATE_COMBINATIONS = 49;

/**
 * Builds the flexible-date search matrix. For a one-way trip this is just
 * the `flexDays` window around `departureDate`. For a round trip it pairs
 * every candidate departure with every candidate return (skipping pairs
 * where the return would be before the departure), matching the "ida D-3 a
 * D+3, volta D-3 a D+3" behavior requested for the MVP.
 */
export function buildDateMatrix(
  departureDate: string,
  returnDate: string | undefined,
  flexDays: number
): DatePair[] {
  const flex = Math.max(0, Math.min(flexDays, 3));
  const departures = candidateDates(departureDate, flex);

  if (!returnDate) {
    return departures.map((d) => ({ departureDate: d }));
  }

  const returns = candidateDates(returnDate, flex);
  const pairs: DatePair[] = [];
  for (const dep of departures) {
    for (const ret of returns) {
      if (differenceInCalendarDays(parseISO(ret), parseISO(dep)) >= 0) {
        pairs.push({ departureDate: dep, returnDate: ret });
      }
    }
  }

  return pairs.slice(0, MAX_DATE_COMBINATIONS);
}

function candidateDates(centerDateISO: string, flexDays: number): string[] {
  const center = parseISO(centerDateISO);
  const dates: string[] = [];
  for (let offset = -flexDays; offset <= flexDays; offset++) {
    dates.push(format(addDays(center, offset), "yyyy-MM-dd"));
  }
  return dates;
}
