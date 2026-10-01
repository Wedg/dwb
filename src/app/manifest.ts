import type { MetadataRoute } from "next";

// Name and icon for "Add to Home Screen" on Android.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dinner with the Bishop",
    short_name: "DwB",
    description: "Live brackets and results, on your phone.",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
