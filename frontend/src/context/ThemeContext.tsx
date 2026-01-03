"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("beam_theme", t);
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  useEffect(() => {
    // Load persisted
    const saved =
      typeof window !== "undefined"
        ? (localStorage.getItem("beam_theme") as ThemeMode | null)
        : null;

    const initial: ThemeMode = saved ?? "dark";
    setThemeState(initial);
  }, []);

  useEffect(() => {
    // Apply to <html>
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
