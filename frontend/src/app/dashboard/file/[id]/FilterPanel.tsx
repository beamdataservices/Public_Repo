"use client";

import React from "react";

type FiltersProps = {
  filters: Record<string, string[]>;
  selected: Record<string, string | null>;
  onChange: (key: string, value: string | null) => void;
  onClear: () => void;
  onApply?: () => void;                 // ✅ NEW
  onApplyPreset?: (preset: string) => void;
};

export default function FilterPanel({
  filters,
  selected,
  onChange,
  onClear,
  onApply,
  onApplyPreset,
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
        <h2 className="text-sm font-semibold text-slate-200">Filters</h2>

        <div className="flex items-center gap-2">
          {onApply && (
            <button
              onClick={onApply}
              className="text-xs rounded-md border border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800"
              type="button"
            >
              Apply
            </button>
          )}

          <button
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-slate-200"
            type="button"
          >
            Clear All
          </button>
        </div>
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
            onChange={(e) => onChange(col, e.target.value || null)}
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

      {/* Presets */}
      <div className="border-t border-slate-800 pt-4">
        <h2 className="text-slate-200 text-base font-semibold mb-2">
          Preset Filters
        </h2>

        <p className="text-xs text-slate-400 mb-3">
          (Your team can configure global or saved filters here.)
        </p>

        <div className="space-y-2">
          <button
            className="w-full bg-slate-800 rounded px-3 py-2 text-xs hover:bg-slate-700"
            type="button"
            onClick={() => onApplyPreset?.("high_value")}
          >
            High-Value Records
          </button>

          <button
            className="w-full bg-slate-800 rounded px-3 py-2 text-xs hover:bg-slate-700"
            type="button"
            onClick={() => onApplyPreset?.("missing_data")}
          >
            Missing Data Check
          </button>

          <button
            className="w-full bg-slate-800 rounded px-3 py-2 text-xs hover:bg-slate-700"
            type="button"
            onClick={() => onApplyPreset?.("outliers")}
          >
            Outliers
          </button>
        </div>
      </div>
    </div>
  );
}
