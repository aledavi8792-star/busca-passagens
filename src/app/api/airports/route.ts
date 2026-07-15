import { NextRequest, NextResponse } from "next/server";
import { searchAirportsLocal, KNOWN_AIRPORTS } from "@/lib/airports";
import { amadeusConfigured, searchAirportsRemote } from "@/lib/amadeus";
import { COMBINED_ROUTES } from "@/lib/combinedRoutes";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  const local = q ? searchAirportsLocal(q) : KNOWN_AIRPORTS.slice(0, 10);
  let remote: typeof local = [];

  if (q.length >= 2 && amadeusConfigured()) {
    try {
      remote = await searchAirportsRemote(q);
    } catch {
      // Non-fatal: local static list still serves as a working fallback for autocomplete.
    }
  }

  const merged = new Map<string, (typeof local)[number]>();
  for (const a of [...local, ...remote]) merged.set(a.iata, a);

  const combined = Object.values(COMBINED_ROUTES)
    .filter((r) => !q || r.label.toLowerCase().includes(q.toLowerCase()) || r.finalDestinationName.toLowerCase().includes(q.toLowerCase()))
    .map((r) => ({ iata: r.id, name: r.label, city: r.finalDestinationName, country: "Paraguai", isCombined: true }));

  return NextResponse.json({
    airports: Array.from(merged.values()),
    combinedDestinations: combined,
  });
}
