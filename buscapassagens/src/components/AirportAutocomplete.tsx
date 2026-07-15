"use client";

import { useEffect, useRef, useState } from "react";

export interface AirportOption {
  iata: string;
  name: string;
  city: string;
  country: string;
  isCombined?: boolean;
}

export default function AirportAutocomplete({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<AirportOption[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/airports?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setOptions([...(data.combinedDestinations ?? []), ...(data.airports ?? [])]);
      } catch {
        // ignore aborted/failed lookups; the user can keep typing
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const visibleOptions = query.length < 2 ? [] : options;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      {open && visibleOptions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {visibleOptions.map((opt) => (
            <li key={opt.iata}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-slate-700"
                onClick={() => {
                  onChange(opt.iata);
                  setQuery(opt.isCombined ? opt.name : `${opt.iata} - ${opt.city}`);
                  setOpen(false);
                }}
              >
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {opt.isCombined ? "🚌✈️ " : ""}
                  {opt.iata} — {opt.city}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {opt.name}, {opt.country}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
