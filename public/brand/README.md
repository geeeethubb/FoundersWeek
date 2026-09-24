# Brand assets

- `founders-logo-original.png`: the Founders – Illinois Entrepreneurs logo exactly as it was sent to us
  (dark grey and orange #FF9600 on white, with a pale emblem in the background). Keep this file as is.
- `founders-logo.png`: the version the site uses. It's a tight crop of the original with just the mark
  and wordmark. We removed the white background and the pale emblem, and left the colors and proportions
  alone.

We don't use any University of Illinois marks.

To add approved assets:

1. Put the files in this folder, for example:
   - `public/brand/founders-logo.svg`: the Founders – Illinois Entrepreneurs wordmark (SVG is best, or a PNG at least 2× its display size)
   - `public/brand/illinois-mark.svg`: only if the org has permission to use an Illinois mark
2. Point `brand` in `content/site.ts` at them, using each file's **intrinsic** width and height so the
   aspect ratio stays correct:

   ```ts
   brand: {
     foundersLogo: { src: "/brand/founders-logo.svg", width: 480, height: 96, alt: "Founders – Illinois Entrepreneurs" },
     illinoisMark: null,
   },
   ```

The header logo (`components/site/brand.tsx`) picks up the new file on its own and only scales it by
height, so it never gets stretched.

Mentor headshots go in `public/mentors/<mentor-id>.jpg` and are set in `content/mentors.ts`
(`headshot: { src, alt, width, height }`). Only use photos the mentor has approved.
