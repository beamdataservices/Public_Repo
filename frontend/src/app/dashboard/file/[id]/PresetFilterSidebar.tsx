"use client";

export default function PresetFilterSidebar() {
  return (
    <div>
      <h2 className="text-slate-200 text-base font-semibold mb-3">
        Preset Filters
      </h2>

      <p className="text-xs text-slate-400 mb-3">
        (Your team can configure global or saved filters here.)
      </p>

      <div className="space-y-3">

        <button className="w-full bg-slate-800 rounded px-3 py-2 text-xs hover:bg-slate-700">
          High-Value Records
        </button>

        <button className="w-full bg-slate-800 rounded px-3 py-2 text-xs hover:bg-slate-700">
          Missing Data Check
        </button>

        <button className="w-full bg-slate-800 rounded px-3 py-2 text-xs hover:bg-slate-700">
          Outliers
        </button>

      </div>
    </div>
  );
}
