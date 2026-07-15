// "Combined" (voo + trecho terrestre) destinations: places with no direct
// commercial air link, reached by flying into a nearby airport and finishing
// the trip overland. Modeled as a pseudo-destination the user can pick in the
// UI, which fans out into one search per real airport option.

export interface GroundTransfer {
  mode: string;
  distanceKm: number;
  durationMinutes: number;
  description: string;
}

export interface CombinedRouteOption {
  arrivalAirport: string; // IATA of the real flight destination
  groundTransfer: GroundTransfer;
}

export interface CombinedRoute {
  id: string; // pseudo IATA-like code used in the UI/search params
  label: string;
  finalDestinationName: string;
  note: string;
  options: CombinedRouteOption[];
}

export const COMBINED_ROUTES: Record<string, CombinedRoute> = {
  CDEL: {
    id: "CDEL",
    label: "Ciudad del Este (Paraguai) — via voo + trecho terrestre",
    finalDestinationName: "Ciudad del Este, Paraguai",
    note:
      "Não existe voo comercial direto regular para Ciudad del Este. As opções reais " +
      "são voar até Assunção (AGT) e seguir de ônibus/carro (~5-6h), ou voar até Foz " +
      "do Iguaçu (IGU) e atravessar a fronteira por terra (~20-30 min).",
    options: [
      {
        arrivalAirport: "AGT",
        groundTransfer: {
          mode: "ônibus/carro",
          distanceKm: 327,
          durationMinutes: 330,
          description: "~5-6h de ônibus ou carro de Assunção até Ciudad del Este",
        },
      },
      {
        arrivalAirport: "IGU",
        groundTransfer: {
          mode: "carro/ônibus (travessia de fronteira)",
          distanceKm: 15,
          durationMinutes: 25,
          description: "~20-30 min atravessando a Ponte da Amizade até Ciudad del Este",
        },
      },
    ],
  },
};

export function isCombinedDestination(code: string): boolean {
  return code.toUpperCase() in COMBINED_ROUTES;
}

export function getCombinedRoute(code: string): CombinedRoute | undefined {
  return COMBINED_ROUTES[code.toUpperCase()];
}
