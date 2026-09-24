/** Web app manifest — name, description and the Founders brand colors (white ground). */
import type { MetadataRoute } from "next";
import { getSite } from "@/content";

export default function manifest(): MetadataRoute.Manifest {
  const site = getSite();
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
