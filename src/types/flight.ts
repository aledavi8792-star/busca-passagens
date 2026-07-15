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
}
