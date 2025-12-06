import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "BEAM Analytics",
  description: "Multi-tenant ingestion & analytics platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50 min-h-screen">
        {/* Theme wrapper - will allow dynamic user themes later */}
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
