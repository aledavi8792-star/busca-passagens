export interface FlightSegment {
  carrierCode: string;
  carrierName: string;
  flightNumber: string;
  from: string;
  to: string;
  departureAt: string; // ISO datetime, local to departure airport (as returned by provider)
  arrivalAt: string; // ISO datetime, local to arrival airport
  durationMinutes: number;
}

export interface FlightItinerary {
  segments: FlightSegment[];
  durationMinutes: number;
  stops: number;
}

export interface GroundTransferInfo {
  arrivalAirport: string;
  mode: string;
  distanceKm: number;
  durationMinutes: number;
  description: string;
}

export interface SplitLegInfo {
  bookingLink: string;
  priceTotal: number;
  priceCurrency: string;
  priceBRL: number;
}

export interface FlightOffer {
  id: string;
  source: "amadeus" | "mock";
  priceTotal: number;
  priceCurrency: string;
  priceBRL: number;
  departureDate: string;
  returnDate?: string;
  outbound: FlightItinerary;
  inbound?: FlightItinerary;
  carrierCodes: string[];
  totalStops: number; // max stops across itineraries — the number shown/sorted on in the UI
  totalDurationMinutes: number; // outbound + inbound
  bookingLink: string;
  bookingLinkNote: string;
  isMock: boolean;
  combinedRoute?: GroundTransferInfo;
  originRequested: string;
  destinationRequested: string;
  originActual: string;
  destinationActual: string;
  // Two separate one-way tickets (often different carriers/dates) priced
  // lower than any single round-trip bundle found. See searchSplitOption in
  // searchFlights.ts.
  isSplit?: boolean;
  splitOutboundLeg?: SplitLegInfo;
  splitInboundLeg?: SplitLegInfo;
}

export interface AwardOption {
  program: string; // loyalty program / alliance name, e.g. "Smiles", "LATAM Pass"
  origin: string;
  destination: string;
  date: string;
  cabin: string; // economy | premium | business | first
  miles: number;
  taxesFeesUSD: number;
  direct: boolean;
  seatsAvailable: number;
}

export interface SearchQuery {
  origin: string;
  destination: string; // may be a combined-route pseudo-code
  departureDate: string;
  returnDate?: string;
  flexDays: number;
  nearbyAirports: boolean;
  adults: number;
}

export interface DateHeatmapEntry {
  departureDate: string;
  returnDate?: string;
  lowestPriceBRL: number | null;
}

export interface SearchResult {
  query: SearchQuery;
  offers: FlightOffer[];
  heatmap: DateHeatmapEntry[];
  bestOfferId: string | null;
  usedMockData: boolean;
  warnings: string[];
  combinedRouteNote?: string;
  awardOptions?: AwardOption[];
  awardOptionsNote?: string;
}
