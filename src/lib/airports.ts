export interface AirportInfo {
  iata: string;
  name: string;
  city: string;
  country: string;
}

// Small static seed used for local autocomplete fallback (offline/mock mode)
// and for the "aeroportos próximos" groupings. When Amadeus credentials are
// configured, /api/airports also queries the live Amadeus Locations API and
// merges the results, so this list doesn't need to be exhaustive.
export const KNOWN_AIRPORTS: AirportInfo[] = [
  { iata: "BSB", name: "Brasília – Presidente Juscelino Kubitschek", city: "Brasília", country: "Brasil" },
  { iata: "GRU", name: "São Paulo – Guarulhos", city: "São Paulo", country: "Brasil" },
  { iata: "VCP", name: "Campinas – Viracopos", city: "Campinas", country: "Brasil" },
  { iata: "CGH", name: "São Paulo – Congonhas", city: "São Paulo", country: "Brasil" },
  { iata: "GIG", name: "Rio de Janeiro – Galeão", city: "Rio de Janeiro", country: "Brasil" },
  { iata: "SDU", name: "Rio de Janeiro – Santos Dumont", city: "Rio de Janeiro", country: "Brasil" },
  { iata: "CNF", name: "Belo Horizonte – Confins", city: "Belo Horizonte", country: "Brasil" },
  { iata: "IGU", name: "Foz do Iguaçu", city: "Foz do Iguaçu", country: "Brasil" },
  { iata: "CWB", name: "Curitiba – Afonso Pena", city: "Curitiba", country: "Brasil" },
  { iata: "POA", name: "Porto Alegre – Salgado Filho", city: "Porto Alegre", country: "Brasil" },
  { iata: "SSA", name: "Salvador", city: "Salvador", country: "Brasil" },
  { iata: "REC", name: "Recife – Guararapes", city: "Recife", country: "Brasil" },
  { iata: "FOR", name: "Fortaleza – Pinto Martins", city: "Fortaleza", country: "Brasil" },
  { iata: "AGT", name: "Assunção – Silvio Pettirossi", city: "Assunção", country: "Paraguai" },
  { iata: "EZE", name: "Buenos Aires – Ezeiza", city: "Buenos Aires", country: "Argentina" },
  { iata: "SCL", name: "Santiago", city: "Santiago", country: "Chile" },
  { iata: "MVD", name: "Montevidéu – Carrasco", city: "Montevidéu", country: "Uruguai" },
];

// Groups of airports considered "close enough" to swap when the user enables
// "aeroportos próximos". Keyed by any IATA code in the group.
const NEARBY_GROUPS: string[][] = [
  ["GRU", "VCP", "CGH"], // São Paulo metro area
  ["GIG", "SDU"], // Rio de Janeiro
];

export function nearbyAirports(iata: string): string[] {
  const group = NEARBY_GROUPS.find((g) => g.includes(iata.toUpperCase()));
  return group ? group.filter((code) => code !== iata.toUpperCase()) : [];
}

export function findAirport(iata: string): AirportInfo | undefined {
  return KNOWN_AIRPORTS.find((a) => a.iata === iata.toUpperCase());
}

export function searchAirportsLocal(query: string): AirportInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return KNOWN_AIRPORTS.filter(
    (a) =>
      a.iata.toLowerCase().startsWith(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
  ).slice(0, 10);
}
