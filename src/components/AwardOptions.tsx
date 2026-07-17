"use client";

import type { AwardOption } from "@/types/flight";

const CABIN_LABELS: Record<string, string> = {
  economy: "Econômica",
  premium: "Premium",
  business: "Executiva",
  first: "Primeira",
};

export default function AwardOptions({
  options,
  note,
}: {
  options?: AwardOption[];
  note?: string;
}) {
  if (!options && !note) return null;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-900 dark:bg-indigo-950">
      <h3 className="mb-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
        ✨ Opções com milhas (seats.aero)
      </h3>

      {note && <p className="text-sm text-indigo-800 dark:text-indigo-300">{note}</p>}

      {options && options.length > 0 && (
        <>
          <div className="grid gap-2">
            {options
              .slice()
              .sort((a, b) => a.miles - b.miles)
              .slice(0, 8)
              .map((opt, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-indigo-900/40"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {opt.origin} → {opt.destination}
                    </span>{" "}
                    <span className="text-slate-500 dark:text-slate-400">
                      {opt.date} · {CABIN_LABELS[opt.cabin] ?? opt.cabin} ·{" "}
                      {opt.direct ? "direto" : "com conexão"}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-700 dark:text-indigo-300">
                      {opt.miles.toLocaleString("pt-BR")} milhas
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      + US$ {opt.taxesFeesUSD.toFixed(2)} taxas · {opt.program} · {opt.seatsAvailable} assento(s)
                    </p>
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-400">
            Disponibilidade e milhagem mudam com frequência — confirme no site do programa antes de resgatar.
          </p>
        </>
      )}
    </div>
  );
}
