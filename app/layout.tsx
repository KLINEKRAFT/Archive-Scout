import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Archive Scout — Search the visual past",
  description:
    "A designer’s field guide to the visual past. Explore historical imagery across public archives, search by color, and keep your discoveries.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
