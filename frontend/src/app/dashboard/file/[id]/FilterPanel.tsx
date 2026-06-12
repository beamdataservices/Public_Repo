"use client";

import React from "react";

type FiltersProps = {
  filters: Record<string, string[]>;
  selected: Record<string, string | null>;
  onChange: (key: string, value: string | null) => void;
  onClear: () => void;
  onApply?: () => void;
};

export default function FilterPanel({
  filters,
  selected,
  onChange,
  onClear,
  onApply,
}: FiltersProps) {
  const filterKeys = Object.keys(filters || {});

  if (filterKeys.length === 0) {
    return (
      <div className="text-xs text-[var(--text-muted)] px-2">
        No filters detected in this dataset.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-main)]">Filters</h2>

        <div className="flex items-center gap-2">
          {onApply && (
            <button onClick={onApply} className="btn btn-secondary btn-sm" type="button">
              Apply
            </button>
          )}

          <button onClick={onClear} className="btn btn-ghost btn-sm" type="button">
            Clear All
          </button>
        </div>
      </div>

      {/* Filter Inputs */}
      {filterKeys.map((col) => (
        <div key={col} className="flex flex-col">
          <label className="field-label">{col}</label>

          <select
            className="input px-2 py-1.5"
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

    </div>
  );
}
