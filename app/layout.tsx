import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/figtree";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Menetekel Apartments — RentTrack",
  description:
    "Rent collection for Menetekel Apartments, Nairobi. 5 floors, 34 units, M-Pesa prompts, a payments ledger, and monthly and cumulative reports.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Menetekel" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2f9" },
    { media: "(prefers-color-scheme: dark)", color: "#14112a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Apply a saved Light/Dark choice before first paint, so the page never flashes the wrong theme.
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('menetekel:theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('menetekel:calm')==='1')document.documentElement.setAttribute('data-calm','')}catch(e){}",
          }}
        />
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
