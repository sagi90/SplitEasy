import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SplitEasy — מחלקים הוצאות בלי כאב ראש",
    short_name: "SplitEasy",
    description: "שיתוף הוצאות בקבוצה בלי הרשמה",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f8fa",
    theme_color: "#17b890",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
