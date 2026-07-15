// Split out from currency.ts so client components can format BRL without
// pulling in the exchange-rate fetch/env logic (server-only) into the bundle.
export function formatBRL(amount: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}
