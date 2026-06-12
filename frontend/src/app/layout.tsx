import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

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

// Runs before paint: applies the saved theme (or OS preference) to <html>
// so dark-mode users never see a light flash.
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem("beam_theme");
    var theme = saved === "dark" || saved === "light"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
