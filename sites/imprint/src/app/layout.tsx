import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Imprint — één motor, elke site een eigen gezicht",
  description:
    "Een publicatieplatform voor zelfstandige merk- en productsites, met een visuele studio, versiehistorie en een open contentmodel.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
