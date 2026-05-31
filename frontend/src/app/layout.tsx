import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "BEAM Analytics",
  description: "Main Dashboard",
  icons: {
    icon: [
      { url: "/beam-tab-favicon-20260523-bordered.ico", sizes: "any" },
      { url: "/beam-tab-favicon-20260523-bordered.png", type: "image/png" },
    ],
    shortcut: "/beam-tab-favicon-20260523-bordered.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
