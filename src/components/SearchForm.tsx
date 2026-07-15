"use client";

import { useState } from "react";
import AirportAutocomplete from "@/components/AirportAutocomplete";
import type { SearchQuery } from "@/types/flight";

const TODAY = new Date().toISOString().slice(0, 10);

export interface SearchFormPreset {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  flexDays: number;
}

export default function SearchForm({
  onSearch,
  loading,
  preset,
}: {
  onSearch: (query: SearchQuery) => void;
  loading: boolean;
  preset?: SearchFormPreset;
}) {
  const [origin, setOrigin] = useState(preset?.origin ?? "BSB");
  const [destination, setDestination] = useState(preset?.destination ?? "AGT");
  const [oneWay, setOneWay] = useState(!preset?.returnDate);
  const [departureDate, setDepartureDate] = useState(preset?.departureDate ?? TODAY);
  const [returnDate, setReturnDate] = useState(preset?.returnDate ?? "");
  const [flexDates, setFlexDates] = useState((preset?.flexDays ?? 0) > 0);
  const [flexDays, setFlexDays] = useState(preset?.flexDays || 3);
  const [nearbyAirports, setNearbyAirports] = useState(false);
  const [adults, setAdults] = useState(1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({
      origin,
      destination,
      departureDate,
      returnDate: oneWay ? undefined : returnDate || undefined,
      flexDays: flexDates ? flexDays : 0,
      nearbyAirports,
      adults,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AirportAutocomplete label="Origem" value={origin} onChange={setOrigin} placeholder="BSB - Brasília" />
        <AirportAutocomplete
          label="Destino"
          value={destination}
          onChange={setDestination}
          placeholder="AGT - Assunção, ou 'Ciudad del Este'"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="oneWay"
          type="checkbox"
          checked={oneWay}
          onChange={(e) => setOneWay(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <label htmlFor="oneWay" className="text-sm text-slate-700 dark:text-slate-300">
          Somente ida
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Data de ida
          </label>
          <input
            type="date"
            required
            min={TODAY}
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        {!oneWay && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Data de volta
            </label>
            <input
              type="date"
              required={!oneWay}
              min={departureDate}
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={flexDates}
            onChange={(e) => setFlexDates(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Datas flexíveis (+/- dias)
        </label>

        {flexDates && (
          <select
            value={flexDays}
            onChange={(e) => setFlexDays(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value={1}>+/- 1 dia</option>
            <option value={2}>+/- 2 dias</option>
            <option value={3}>+/- 3 dias</option>
          </select>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={nearbyAirports}
            onChange={(e) => setNearbyAirports(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Aeroportos próximos
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Passageiros
        </label>
        <input
          type="number"
          min={1}
          max={9}
          value={adults}
          onChange={(e) => setAdults(Number(e.target.value))}
          className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Buscando..." : "Buscar passagens"}
      </button>
    </form>
  );
}
