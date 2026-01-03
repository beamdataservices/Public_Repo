"use client";

import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import React, { useEffect, useRef, useState } from "react";

export default function TopNav() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const env = process.env.NEXT_PUBLIC_ENV?.toUpperCase();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header
      className="w-full flex items-center justify-between px-6 py-4"
      style={{
        background: "var(--navy)",
        borderBottom: "4px solid var(--teal)",
        color: "white",
      }}
    >
      {/* Left: logo + titles */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-md overflow-hidden flex items-center justify-center">
          <Image
            src="/favicon.ico"
            alt="BEAM"
            width={36}
            height={36}
            priority
          />
        </div>

        <div className="leading-tight min-w-0">
          <div className="font-semibold text-[1.1rem] truncate">
            BEAM Analytics
          </div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
            Multi-tenant ingest & insights
          </div>
        </div>

        {env && (
          <span
            className="ml-3 rounded-md px-2 py-1 text-[10px] font-semibold"
            style={{
              border: "1px solid rgba(255,255,255,0.25)",
              color: "white",
              background: "rgba(0,0,0,0.15)",
              flexShrink: 0,
            }}
          >
            {env}
          </span>
        )}
      </div>

      {/* Right: user + settings + logout */}
      <div className="flex items-center gap-4 text-sm">
        {user && (
          <>
            <div className="text-right">
              <div className="font-medium">{user.email}</div>
              <div className="text-xs" style={{ color: "var(--teal)" }}>
                {user.role}
              </div>
            </div>

            {/* Settings */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="rounded-md px-3 py-2 text-xs font-medium"
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "rgba(0,0,0,0.15)",
                  color: "white",
                }}
                aria-label="Settings"
              >
                ⚙
              </button>

              {open && (
                <div
                  className="absolute right-0 mt-2 w-60 rounded-xl p-3 shadow-2xl"
                  style={{
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                >
                  <div className="text-sm font-semibold mb-2">Settings</div>

                  <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    Theme
                  </label>

                  <select
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={{
                      background: "var(--bg-panel-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-main)",
                    }}
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as ThemeMode)}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-3 w-full rounded-md px-3 py-2 text-sm"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--text-main)",
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              className="rounded-md px-3 py-2 text-xs font-medium"
              style={{
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(0,0,0,0.15)",
                color: "white",
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
