"use client";

import { AuthGuard } from "@/components/AuthGuard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="px-6 py-8 max-w-2xl">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--text-main)]">
            Welcome to BEAM Analytics
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
            BEAM helps you understand the health and quality of your business data
            - without needing a data team.
          </p>
        </div>

        {/* Getting started steps */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-main)] uppercase tracking-wide">
            Getting Started
          </h2>

          {[
            {
              step: "1",
              title: "Upload a file",
              description:
                'Use the "Upload a File" panel on the left to upload a CSV or Excel spreadsheet from your business. This could be a customer list, sales report, policy register, or any other dataset.',
            },
            {
              step: "2",
              title: "View your file overview",
              description:
                "Once uploaded, click your file name in the sidebar. The File Overview tab shows key metrics and charts to help you understand what's in your data.",
            },
            {
              step: "3",
              title: "Check your data health score",
              description:
                'Switch to the "Data Health" tab to see a quality score out of 100, plain-English explanations of any issues found, and a field-by-field breakdown. No data background required.',
            },
          ].map((item) => (
            <div key={item.step} className="card flex gap-4 p-4">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid var(--border)",
                  color: "var(--link)",
                }}
              >
                {item.step}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Supported formats */}
        <div className="card mt-8 p-4">
          <p className="field-label">Supported file types</p>
          <div className="flex gap-2 text-sm">
            <span className="badge badge-neutral">CSV</span>
            <span className="badge badge-neutral">Excel (.xlsx)</span>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Maximum file size: 50 MB
          </p>
        </div>
      </div>
    </AuthGuard>
  );
}
