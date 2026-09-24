# Brand assets

No official Founders or University of Illinois brand assets were supplied, so the site uses a
typographic lockup ("Founders × Founders Week") and no logos. Nothing here is synthesized.

To add approved assets:

1. Put the files in this folder, e.g.
   - `public/brand/founders-logo.svg` — Founders – Illinois Entrepreneurs wordmark (SVG preferred, or PNG ≥ 2× display size)
   - `public/brand/illinois-mark.svg` — only if the org is permitted to use an Illinois mark
2. Reference them in `content/site.ts` → `brand`, with the file's **intrinsic** width and height so the
   aspect ratio is preserved:

   ```ts
   brand: {
     foundersLogo: { src: "/brand/founders-logo.svg", width: 480, height: 96, alt: "Founders – Illinois Entrepreneurs" },
     illinoisMark: null,
   },
   ```

The header lockup (`components/site/brand.tsx`) switches to the logo automatically and scales it by
height only.

Mentor headshots go in `public/mentors/<mentor-id>.jpg` and are referenced from `content/mentors.ts`
(`headshot: { src, alt, width, height }`). Use only photos the mentor has approved.
