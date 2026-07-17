"use client";

import { useState } from "react";
import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import ResultsTable from "@/components/ResultsTable";
import PriceHeatmap from "@/components/PriceHeatmap";
import SaveAlertForm from "@/components/SaveAlertForm";
import AwardOptions from "@/components/AwardOptions";
import type { SearchQuery, SearchResult } from "@/types/flight";
import type { SearchFormPreset } from "@/components/SearchForm";

const QUICK_PICKS = [
  { label: "Brasília → Assunção (AGT)", origin: "BSB", destination: "AGT" },
  { label: "Brasília → Foz do Iguaçu (IGU)", origin: "BSB", destination: "IGU" },
  { label: "Brasília → Ciudad del Este (combinado)", origin: "BSB", destination: "CDEL" },
];

function buildPreset(origin: string, destination: string): SearchFormPreset {
  const dayMs = 86400000;
  const now = Date.now();
  return {
    origin,
    destination,
    departureDate: new Date(now + 30 * dayMs).toISOString().slice(0, 10),
    returnDate: new Date(now + 37 * dayMs).toISOString().slice(0, 10),
    flexDays: 3,
  };
}

export default function Home() {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickPick, setQuickPick] = useState<SearchFormPreset | null>(null);

  async function handleSearch(query: SearchQuery) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao buscar voos.");
        return;
      }
      setResult(data);
    } catch {
      setError("Não foi possível conectar ao servidor de busca.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">✈️ Busca de Passagens</h1>
          <Link href="/alertas" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            Meus alertas de preço
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap gap-2 text-xs">
          {QUICK_PICKS.map((p) => (
            <button
              key={p.label}
              onClick={() => setQuickPick(buildPreset(p.origin, p.destination))}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {p.label}
            </button>
          ))}
        </div>

        <SearchForm
          key={quickPick ? `${quickPick.origin}-${quickPick.destination}` : "default"}
          loading={loading}
          onSearch={handleSearch}
          preset={quickPick ?? undefined}
        />

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Testando combinações de datas e aeroportos, aguarde...
          </div>
        )}

        {result && !loading && (
          <div className="space-y-6">
            <PriceHeatmap heatmap={result.heatmap} />
            <AwardOptions options={result.awardOptions} note={result.awardOptionsNote} />
            <ResultsTable result={result} />
            {result.offers.length > 0 && (
              <SaveAlertForm
                query={result.query}
                suggestedTargetBrl={result.offers[0]?.priceBRL}
                defaultEmail=""
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
