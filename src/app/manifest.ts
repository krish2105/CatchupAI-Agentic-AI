import type { MetadataRoute } from "next";

/** Installable app: opens on Mission Control in its own window. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CatchUp AI",
    short_name: "CatchUp",
    description: "Evidence-grounded, feasibility-aware, approval-gated learning recovery.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f2ea",
    theme_color: "#1f3b2e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
