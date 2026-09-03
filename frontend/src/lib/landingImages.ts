/**
 * Marketing photography. Unsplash, free to use, no attribution required;
 * photographers credited below and in the footer. Photo IDs verified to resolve
 * 2026-09. To make the site offline-robust, download these into /public/images
 * and point `src` / `srcSet` at the local files.
 *
 *   hero      Robiul Islam Pailot  — a man checking his phone in an open field, Bangladesh
 *   graduate  Fotos (@fotospk)     — a graduate holding up a diploma certificate, no institution text
 *   street    Niloy Biswas         — a busy Dhaka street, people walking in daylight
 */

const CDN = "https://images.unsplash.com";

function src(id: string, w: number): string {
  return `${CDN}/${id}?auto=format&fit=crop&w=${w}&q=75`;
}

function srcSet(id: string): string {
  return [720, 1080, 1600, 2000]
    .map((w) => `${src(id, w)} ${w}w`)
    .join(", ");
}

interface LandingImage {
  src: string;
  srcSet: string;
  width: number;
  height: number;
  altKey: string;
}

function image(id: string, ratio: number, altKey: string): LandingImage {
  const width = 1600;
  return {
    src: src(id, width),
    srcSet: srcSet(id),
    width,
    height: Math.round(width * ratio),
    altKey,
  };
}

export const landingImages = {
  hero: image("photo-1658839128300-901b7070c97b", 0.72, "landing.hero.imageAlt"),
  graduate: image("photo-1659080928170-b9924d616f04", 1.25, "landing.how.imageAlt"),
  street: image("photo-1583429891508-015ef9cd958e", 0.66, "landing.cta.imageAlt"),
};
