"use client";

import dynamic from "next/dynamic";

// Plotly ships no usable prop types, so expose a minimally-typed component
// that accepts the layout/data/config shapes we actually pass.
type PlotProps = {
  data?: unknown[];
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
  style?: React.CSSProperties;
};

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as React.ComponentType<PlotProps>;

export default Plot;
