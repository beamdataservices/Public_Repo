"use client";

import dynamic from "next/dynamic";

// Disable TypeScript checking for props
// because Plotly has no type definitions.
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

export default Plot;
