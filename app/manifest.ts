import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AnchurPOS",
    short_name: "AnchurPOS",
    description: "Sistem manajemen produksi & penjualan Anchur",
    start_url: "/",
    display: "standalone",
    background_color: "#FCABB4",
    theme_color: "#E85D8C",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
