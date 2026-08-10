import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Menetekel Apartments — RentTrack",
    short_name: "Menetekel",
    description:
      "Rent collection for Menetekel Apartments, Nairobi. 5 floors, 34 units, live balances, Excel and PDF exports.",
    start_url: "/",
    display: "standalone",
    background_color: "#060a13",
    theme_color: "#0a0f1a",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
