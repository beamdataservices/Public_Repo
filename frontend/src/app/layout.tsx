import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "BEAM Analytics",
  description: "Main Dashboard",
  icons: {
    icon: "/favicon.ico",
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
