import "./globals.css";
import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "Mirror Engine",
  description:
    "Permission-based website capture, replay, asset inspection, and export for premium web cloning workflows."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
