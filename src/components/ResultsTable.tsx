"use client";

import { useMemo, useState } from "react";
import type { FlightOffer, SearchResult } from "@/types/flight";
import { formatBRL } from "@/lib/format";
import { airlineSiteFor } from "@/lib/bookingLink";

type SortKey = "price" | "duration" | "stops";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function formatOriginalPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ResultsTable({ result }: { result: SearchResult }) {
  const [sortKey, setSortKey] = useState<SortKey>("price");

  const sorted = useMemo(() => {
    const copy = [...result.offers];
    copy.sort((a, b) => {
      if (sortKey === "price") return a.priceBRL - b.priceBRL;
      if (sortKey === "duration") return a.totalDurationMinutes - b.totalDurationMinutes;
      return a.totalStops - b.totalStops;
    });
    return copy;
  }, [result.offers, sortKey]);

  if (result.offers.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {result.warnings.map((w, i) => (
          <p key={i}>{w}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result.usedMockData && (
        <div className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200">
          ⚠️ Exibindo <strong>dados simulados (mock)</strong> — configure <code>AMADEUS_CLIENT_ID</code>/
          <code>AMADEUS_CLIENT_SECRET</code> no <code>.env</code> para preços reais.
        </div>
      )}

      {result.combinedRouteNote && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          🚌✈️ <strong>Rota combinada:</strong> {result.combinedRouteNote}
        </div>
      )}

      {result.warnings.length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <summary className="cursor-pointer font-medium">{result.warnings.length} aviso(s)</summary>
          <ul className="mt-2 list-disc pl-4">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex gap-2 text-sm">
        <span className="self-center text-slate-500 dark:text-slate-400">Ordenar por:</span>
        {(["price", "duration", "stops"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`rounded-full px-3 py-1 ${
              sortKey === key
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {key === "price" ? "Preço" : key === "duration" ? "Duração" : "Conexões"}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {sorted.map((offer) => (
          <OfferCard key={offer.id} offer={offer} isBest={offer.id === result.bestOfferId} />
        ))}
      </div>
    </div>
  );
}

function OfferCard({ offer, isBest }: { offer: FlightOffer; isBest: boolean }) {
  const airlineSite = airlineSiteFor(offer.carrierCodes[0]);

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        isBest
          ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {isBest && (
            <span className="mb-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
              🏆 Menor preço encontrado
            </span>
          )}
          {offer.isMock && (
            <span className="ml-2 inline-block rounded-full bg-purple-600 px-2 py-0.5 text-xs font-semibold text-white">
              MOCK
            </span>
          )}
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatBRL(offer.priceBRL)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatOriginalPrice(offer.priceTotal, offer.priceCurrency)} original · {offer.carrierCodes.join(", ")}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <a
            href={offer.bookingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Ver oferta
          </a>
          {airlineSite && (
            <a
              href={airlineSite}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 underline dark:text-slate-400"
            >
              site da companhia
            </a>
          )}
        </div>
      </div>

      {offer.combinedRoute && (
        <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Voo até <strong>{offer.combinedRoute.arrivalAirport}</strong>, depois {offer.combinedRoute.description}.
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ItineraryBlock title="Ida" itinerary={offer.outbound} />
        {offer.inbound && <ItineraryBlock title="Volta" itinerary={offer.inbound} />}
      </div>

      <p className="mt-2 text-xs text-slate-400">{offer.bookingLinkNote}</p>
    </div>
  );
}

function ItineraryBlock({ title, itinerary }: { title: string; itinerary: FlightOffer["outbound"] }) {
  const first = itinerary.segments[0];
  const last = itinerary.segments[itinerary.segments.length - 1];
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
      <p className="font-medium text-slate-800 dark:text-slate-200">
        {title}: {first.from} → {last.to}
      </p>
      <p className="text-slate-600 dark:text-slate-400">
        {formatTime(first.departureAt)} — {formatTime(last.arrivalAt)}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {formatDuration(itinerary.durationMinutes)} ·{" "}
        {itinerary.stops === 0 ? "Direto" : `${itinerary.stops} conexão(ões)`}
      </p>
    </div>
  );
}
