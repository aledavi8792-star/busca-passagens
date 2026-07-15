// Neither Amadeus Flight Offers Search nor a mock offer carries a real
// checkout deep-link (that requires a booking-capable API like Kiwi Tequila's
// `deep_link` field, or Duffel's own checkout). To still give the user a
// one-click way to act on a result, we build a prefilled Google Flights
// search URL (a normal, documented URL scheme — not scraping) and, when we
// recognize the carrier, a link to that airline's site as a second option.

const AIRLINE_SITES: Record<string, string> = {
  LA: "https://www.latamairlines.com/br/pt",
  G3: "https://www.voegol.com.br",
  AD: "https://www.voeazul.com.br",
  AV: "https://www.avianca.com/br/pt",
  CM: "https://www.copaair.com/pt",
  PZ: "https://www.paranair.com",
  Z8: "https://amaszonas.com",
  AR: "https://www.aerolineas.com.ar",
};

export interface BookingLinkParams {
  carrierCodes: string[];
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
}

export function buildBookingLink(params: BookingLinkParams): string {
  const query = params.returnDate
    ? `Voos de ${params.origin} para ${params.destination} em ${params.departureDate} voltando ${params.returnDate}`
    : `Voos de ${params.origin} para ${params.destination} em ${params.departureDate}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

export function airlineSiteFor(carrierCode: string): string | undefined {
  return AIRLINE_SITES[carrierCode];
}
