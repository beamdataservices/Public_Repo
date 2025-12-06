"use client";

import React from "react";

type FiltersProps = {
  filters: Record<string, string[]>;
  selected: Record<string, string | null>;
  onChange: (key: string, value: string | null) => void;
  onClear: () => void;
};

export default function FilterPanel({
  filters,
  selected,
  onChange,
  onClear,
}: FiltersProps) {
  const filterKeys = Object.keys(filters || {});

  if (filterKeys.length === 0) {
    return (
      <div className="text-xs text-slate-500 px-2">
        No filters detected in this dataset.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          Filters
        </h2>
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          Clear All
        </button>
      </div>

      {/* Filter Inputs */}
      {filterKeys.map((col) => (
        <div key={col} className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            {col}
          </label>

          <select
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={selected[col] ?? ""}
            onChange={(e) =>
              onChange(col, e.target.value || null)
            }
          >
            <option value="">All</option>
            {filters[col].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
