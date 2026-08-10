import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Menetekel Apartments — RentTrack",
  description:
    "Rent collection for Menetekel Apartments, Nairobi. 5 floors, 34 units, live balances, Excel and PDF exports.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Menetekel",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <Nav />
        {children}
        <footer className="site">
          <span>
            <b style={{ color: "rgba(200,169,81,0.6)" }}>MENETEKEL APARTMENTS</b>{" "}
            · Nairobi, Kenya · 2026
          </span>
          <span>Managed with RentTrack</span>
        </footer>
      </body>
    </html>
  );
}
