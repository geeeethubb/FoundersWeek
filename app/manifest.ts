/** Web app manifest — name, colors (ink ground, Illinois orange) and the × icon. */
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
    background_color: "#0a0f1c",
    theme_color: "#0a0f1c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
