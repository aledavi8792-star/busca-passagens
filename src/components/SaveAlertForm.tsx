"use client";

import { useState } from "react";
import type { SearchQuery } from "@/types/flight";

export default function SaveAlertForm({
  query,
  suggestedTargetBrl,
  defaultEmail,
}: {
  query: SearchQuery;
  suggestedTargetBrl?: number;
  defaultEmail: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [targetPriceBrl, setTargetPriceBrl] = useState(
    suggestedTargetBrl ? Math.round(suggestedTargetBrl * 0.9) : 500
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: query.origin,
          destination: query.destination,
          isCombined: query.destination.length > 0 && !/^[A-Z]{3}$/.test(query.destination),
          departureDate: query.departureDate,
          returnDate: query.returnDate,
          flexDays: query.flexDays || 3,
          adults: query.adults,
          nearbyAirports: query.nearbyAirports,
          targetPriceBrl,
          email,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        🔔 Salvar como alerta de preço (fase 2)
      </h3>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Rodamos essa busca 1x por dia e avisamos por email quando o menor preço cair abaixo do valor definido.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Avisar quando preço &le;
          </label>
          <input
            type="number"
            value={targetPriceBrl}
            onChange={(e) => setTargetPriceBrl(Number(e.target.value))}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving" || !email}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {status === "saving" ? "Salvando..." : status === "saved" ? "Salvo ✓" : "Salvar alerta"}
        </button>
        {status === "error" && <span className="text-xs text-red-600">Falha ao salvar. Tente novamente.</span>}
      </div>
    </div>
  );
}
