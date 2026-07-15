// Converts flight-offer prices (usually USD or EUR from the provider) to BRL.
// Tries a live rate first, falls back to a fixed rate from env so the app
// keeps working even if the free exchange-rate API is down or rate-limited.

type RatesCache = { rates: Record<string, number>; fetchedAt: number };
let cache: RatesCache | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — exchange rates don't need to be fresher than this here

async function getUsdBaseRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.rates;
  }
  const url = process.env.EXCHANGE_RATE_API_URL || "https://open.er-api.com/v6/latest/USD";
  try {
    const res = await fetch(url, { next: { revalidate: 21600 } });
    if (!res.ok) throw new Error(`exchange rate API returned ${res.status}`);
    const data = await res.json();
    const rates = data.rates ?? data.conversion_rates;
    if (!rates?.BRL) throw new Error("exchange rate API response missing BRL");
    cache = { rates, fetchedAt: Date.now() };
    return rates;
  } catch {
    // Fallback fixed rates, still expressed relative to USD=1
    const usdToBrl = Number(process.env.FALLBACK_USD_TO_BRL || 5.4);
    const eurToBrl = Number(process.env.FALLBACK_EUR_TO_BRL || 5.85);
    return { USD: 1, BRL: usdToBrl, EUR: usdToBrl / eurToBrl };
  }
}

export async function toBRL(amount: number, currency: string): Promise<number> {
  if (currency === "BRL") return amount;
  const rates = await getUsdBaseRates();
  const brlPerUsd = rates.BRL;
  const currencyPerUsd = rates[currency];
  if (!currencyPerUsd) {
    // Unknown currency: best-effort, treat as USD rather than fail the whole search
    return round2(amount * brlPerUsd);
  }
  const amountInUsd = amount / currencyPerUsd;
  return round2(amountInUsd * brlPerUsd);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export { formatBRL } from "@/lib/format";
