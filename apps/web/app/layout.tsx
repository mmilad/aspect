import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Projectplaner",
  description: "Graph-first project planning with addressable help-tree nodes."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

