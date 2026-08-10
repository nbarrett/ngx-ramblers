import { asNumber } from "./numbers";

export function stripePatternSvg(colors: string[], patternId: string): string {
  const stripeWidth = 8;
  const patternHeight = stripeWidth * colors.length;
  const stripes = colors.map((color, index) =>
    `<rect x="0" y="${index * stripeWidth}" width="${patternHeight * 2}" height="${stripeWidth}" fill="${color}"/>`
  ).join("");
  return `
      <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${patternHeight}" height="${patternHeight}" patternTransform="rotate(45)">
        ${stripes}
      </pattern>
    `;
}

export function gradientPatternSvg(colors: string[], patternId: string): string {
  const stops = colors.map((color, index) => {
    const offset = (index / (colors.length - 1)) * 100;
    return `<stop offset="${offset}%" stop-color="${color}"/>`;
  }).join("");
  return `
      <linearGradient id="${patternId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${stops}
      </linearGradient>
    `;
}

export function lightenedFillColor(borderColor: string): string {
  return borderColor.replace(/(\d+)%\)$/, (match, lightness) =>
    `${Math.min(90, asNumber(lightness) + 30)}%)`
  );
}
