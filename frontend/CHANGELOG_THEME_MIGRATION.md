# Theme Token Migration Overview

## Scope and constraints
- Goal: migrate hard-coded Tailwind slate colors to CSS theme tokens for consistent light/dark mode.
- No logic changes (state, handlers, fetching, routing).
- Keep layout/spacing/typography classnames intact unless they were color-specific.
- Ensure TopNav is full width across dashboard and file insights.
- Make Plotly charts theme-aware (background, gridlines, font).
- Remove or avoid nonstandard @theme at-rules (none were present).

## What was analyzed
- Theme tokens and global styles in `src/app/globals.css`.
- Header/nav placement and styling via `src/components/TopNav.tsx` and `src/app/dashboard/layout.tsx`.
- Theme state management in `src/context/ThemeContext.tsx` (for Plotly updates).
- Slate color usage across `src/**/*.{ts,tsx}`.
- Plotly rendering in `src/app/dashboard/file/[id]/page.tsx`.

## Changes applied

### 1) Theme tokens updated
- Added missing brand text tokens in `:root` to support consistent light/dark text usage:
  - `--light-text`
  - `--dark-text`
- Kept existing light and dark theme palettes and body color usage intact.

### 2) Slate classes migrated to theme tokens
- Replaced slate background/text/border classes with CSS variable-based classes:
  - `bg-slate-950` -> `bg-[var(--bg-main)]`
  - `bg-slate-900*` -> `bg-[color:var(--bg-panel)]`
  - `bg-slate-800` -> `bg-[color:var(--bg-panel-2)]`
  - `text-slate-50/100/200/300` -> `text-[var(--text-main)]`
  - `text-slate-400/500/600` -> `text-[var(--text-muted)]`
  - `border-slate-700/800` -> `border-[var(--border)]`
  - `ring-slate-700/800` -> `ring-[var(--border)]`
  - `from-slate-*` and `to-slate-*` -> `from-[color:var(--bg-panel)]` and `to-[color:var(--bg-panel-2)]`
- Corrected a few accidental class replacements (e.g., `text-[var(--text-main)]0`) created by automated swaps.

### 3) Header consistency
- Ensured TopNav spans full width by adding `w-full` to its header wrapper.

### 4) Plotly theme awareness
- Implemented a `plotTheme` derived from CSS variables and theme state:
  - Uses `--text-main` for font color.
  - Sets `gridcolor` and `zerolinecolor` based on light/dark theme.
- Preserved existing Plotly layout data while layering in theme-aware overrides.

## Files touched
- `src/app/globals.css`
- `src/components/TopNav.tsx`
- `src/components/AuthGuard.tsx`
- `src/app/page.tsx`
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/dashboard/Sidebar.tsx`
- `src/components/dashboard/SidebarContent.tsx`
- `src/components/dashboard/SidebarFiles.tsx`
- `src/app/dashboard/file/[id]/AIWidget.tsx`
- `src/app/dashboard/file/[id]/AIInsights.tsx`
- `src/app/dashboard/file/[id]/FilterPanel.tsx`
- `src/app/dashboard/file/[id]/page.tsx`

## Key notes for follow-up
- No app logic was changed; edits were limited to styling and theme usage.
- If you want, accent colors (cyan/sky) can also be migrated to token-based equivalents for full brand consistency.
