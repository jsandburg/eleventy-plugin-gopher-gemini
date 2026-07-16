// Gopher item-type codes for binary/media selectors (RFC 1436 + the common
// Gopher+ image extensions almost every modern client, e.g. Lagrange,
// recognizes). Gopher menus are plain text, so there's no way to inline an
// image the way HTML does -- an image is always a separate selector line
// that the client fetches (and displays or downloads) on its own.

const IMAGE_TYPES = {
  gif: "g",
  jpg: "I",
  jpeg: "I",
  png: "I",
  webp: "I",
  bmp: "I",
  tif: "I",
  tiff: "I",
};

const BINARY_EXTENSIONS = new Set([
  "pdf", "zip", "tar", "gz", "mp3", "wav", "ogg", "mp4", "mov",
]);

// type: 0 text file, 1 directory/menu, g GIF, I image, 9 generic binary,
// h web link (served as a "URL:..." selector by the gopherLink shortcode)
export function gopherItemType(pathOrUrl) {
  const clean = String(pathOrUrl).split(/[?#]/)[0];
  if (/^(?:https?:\/\/|URL:)/i.test(clean)) return "h";
  if (clean.endsWith("/")) return "1";
  const ext = clean.split(".").pop().toLowerCase();
  if (IMAGE_TYPES[ext]) return IMAGE_TYPES[ext];
  if (BINARY_EXTENSIONS.has(ext)) return "9";
  return "0";
}
