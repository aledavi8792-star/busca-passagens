"use client";

import type { DateHeatmapEntry } from "@/types/flight";
import { formatBRL } from "@/lib/format";

function colorFor(price: number, min: number, max: number): string {
  if (max === min) return "bg-emerald-500";
  const ratio = (price - min) / (max - min);
  if (ratio < 0.2) return "bg-emerald-500";
  if (ratio < 0.4) return "bg-emerald-300";
  if (ratio < 0.6) return "bg-amber-300";
  if (ratio < 0.8) return "bg-orange-400";
  return "bg-red-500";
}

export default function PriceHeatmap({ heatmap }: { heatmap: DateHeatmapEntry[] }) {
  const withPrice = heatmap.filter((h): h is DateHeatmapEntry & { lowestPriceBRL: number } => h.lowestPriceBRL !== null);
  if (withPrice.length < 2) return null;

  const prices = withPrice.map((h) => h.lowestPriceBRL);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        Calendário de preços (menor preço por data de ida)
      </h3>
      <div className="flex flex-wrap gap-2">
        {withPrice.map((entry) => (
          <div
            key={`${entry.departureDate}-${entry.returnDate ?? ""}`}
            className={`flex w-24 flex-col items-center rounded-lg px-2 py-2 text-white ${colorFor(
              entry.lowestPriceBRL,
              min,
              max
            )}`}
            title={entry.returnDate ? `Ida ${entry.departureDate} / volta ${entry.returnDate}` : entry.departureDate}
          >
            <span className="text-[11px] opacity-90">
              {new Date(entry.departureDate + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
            <span className="text-xs font-bold">{formatBRL(entry.lowestPriceBRL)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Verde = mais barato · Vermelho = mais caro, dentro das datas pesquisadas.
      </p>
    </div>
  );
}
