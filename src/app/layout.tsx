import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sky Style — AI Weather Stylist",
  description:
    "Hyper-local weather data meets AI-powered outfit recommendations. Dress perfectly for the day.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
