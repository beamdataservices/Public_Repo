"use client";

type SettingsToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

export default function SettingsToggle({ checked, disabled, label, onChange }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-10 cursor-pointer rounded-full border transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "border-cyan-400 bg-cyan-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.16)]" : "border-slate-500/60 bg-slate-600/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)]"}`}
    >
      <span className={`absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out ${checked ? "translate-x-[21px]" : "translate-x-[3px]"}`} />
    </button>
  );
}
