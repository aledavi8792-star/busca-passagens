"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";

interface Alert {
  id: string;
  origin: string;
  destination: string;
  isCombined: boolean;
  departureDate: string;
  returnDate: string | null;
  flexDays: number;
  nearbyAirports: boolean;
  targetPriceBrl: number;
  email: string;
  active: boolean;
  lastCheckedAt: string | null;
  lastBestPrice: number | null;
  createdAt: string;
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/alerts");
    const data = await res.json();
    setAlerts(data.alerts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // load()'s setState calls all happen after its `await`, so this doesn't
    // actually run synchronously during the effect — the lint rule can't see
    // across the function boundary to verify that.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function toggleActive(alert: Alert) {
    await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !alert.active }),
    });
    load();
  }

  async function remove(alert: Alert) {
    await fetch(`/api/alerts/${alert.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">🔔 Meus alertas de preço</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            ← Voltar à busca
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Alertas são checados 1x por dia (cron). Você recebe um email quando o menor preço encontrado cair
          abaixo do valor-alvo definido.
        </p>

        {loading && <p className="text-sm text-slate-500">Carregando...</p>}
        {!loading && alerts.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Nenhum alerta salvo ainda. Faça uma busca e clique em &quot;Salvar alerta&quot;.
          </p>
        )}

        <div className="grid gap-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {alert.origin} → {alert.destination} {alert.isCombined && "(combinado)"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {alert.departureDate}
                    {alert.returnDate ? ` → ${alert.returnDate}` : " (só ida)"} · flex +/-{alert.flexDays}d
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Alvo: {formatBRL(alert.targetPriceBrl)} · Email: {alert.email}
                  </p>
                  <p className="text-xs text-slate-400">
                    {alert.lastBestPrice
                      ? `Última checagem: ${formatBRL(alert.lastBestPrice)}`
                      : "Ainda não verificado"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(alert)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      alert.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {alert.active ? "Ativo" : "Pausado"}
                  </button>
                  <button
                    onClick={() => remove(alert)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
