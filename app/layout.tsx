import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity Lab | Fake News Detector",
  description: "A misinformation analysis app powered by Fireworks and Kimi K2.6."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
