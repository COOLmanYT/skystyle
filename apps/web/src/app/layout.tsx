import type { Metadata } from "next";
import "./globals.css";
import ThemeController from "@/components/ThemeController";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://skystyle.app"),
  title: "Sky Style — AI Weather Stylist",
  description:
    "Weather-aware outfit advice, a separate shopping workspace, and private preferences. Dress for your day with Sky Style.",
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
