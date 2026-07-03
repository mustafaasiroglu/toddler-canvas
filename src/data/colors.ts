export const DEFAULT_COLORS: string[] = [
  "#ff5a5f",
  "#ff9f43",
  "#ffd93d",
  "#4cd964",
  "#4aa3ff",
  "#a66bff",
  "#333333",
  "#ffffff",
];

/** Perceived luminance check so light swatches get a visible border. */
export function isLight(hex: string): boolean {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 205;
}
