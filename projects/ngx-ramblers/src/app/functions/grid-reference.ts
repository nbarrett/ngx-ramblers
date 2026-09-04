import { asNumber } from "./numbers";

const GRID_LETTERS = [
  ["SV", "SW", "SX", "SY", "SZ", "TV", "TW"],
  ["SQ", "SR", "SS", "ST", "SU", "TQ", "TR"],
  ["SL", "SM", "SN", "SO", "SP", "TL", "TM"],
  ["SF", "SG", "SH", "SJ", "SK", "TF", "TG"],
  ["SA", "SB", "SC", "SD", "SE", "TA", "TB"],
  ["NV", "NW", "NX", "NY", "NZ", "OV", "OW"],
  ["NQ", "NR", "NS", "NT", "NU", "OQ", "OR"],
  ["NL", "NM", "NN", "NO", "NP", "OL", "OM"],
  ["NF", "NG", "NH", "NJ", "NK", "OF", "OG"],
  ["NA", "NB", "NC", "ND", "NE", "OA", "OB"],
];

export function gridCodeFrom(eastings: number, northings: number): string {

  if (eastings < 0 || eastings >= 700000 || northings < 0 || northings >= 1300000) {
    throw new Error("Coordinates out of bounds for OS grid.");
  }

  const columnIndex = Math.floor(eastings / 100000);
  const rowIndex = Math.floor(northings / 100000);

  if (rowIndex >= GRID_LETTERS.length || columnIndex >= GRID_LETTERS[0].length) {
    throw new Error("Coordinates map to an undefined grid square.");
  }

  return GRID_LETTERS[rowIndex][columnIndex];
}

export function gridReferenceFrom(eastings: number, northings: number, digits: number = 10): string {
  if (isNaN(eastings) || isNaN(northings)) {
    throw new Error("Invalid eastings or northings value");
  }

  const eastingStr = eastings.toString().padStart(6, "0");
  const northingStr = northings.toString().padStart(6, "0");
  const gridCode = gridCodeFrom(eastings, northings);

  if (!gridCode) {
    throw new Error("Grid code not found for the given coordinates");
  }

  const eastingPart = eastingStr.substring(1, 1 + digits / 2);
  const northingPart = northingStr.substring(1, 1 + digits / 2);

  return `${gridCode}${eastingPart}${northingPart}`;
}

export function gridReference6From(eastings: number, northings: number): string {
  return gridReferenceFrom(eastings, northings, 6);
}

export function gridReference8From(eastings: number, northings: number): string {
  return gridReferenceFrom(eastings, northings, 8);
}

export function gridReference10From(eastings: number, northings: number): string {
  return gridReferenceFrom(eastings, northings, 10);
}

export function formatGridReference(gridReference: string, digits = 10, spaced = true): string {
  const cleaned = (gridReference || "").toUpperCase().replace(/\s/g, "");
  const match = cleaned.match(/^([A-Z]{2})(\d+)$/);
  const half = match ? match[2].length / 2 : 0;
  const keep = Math.min(Math.max(Math.floor(digits / 2), 1), half);
  if (!match || match[2].length % 2 !== 0) {
    return gridReference;
  } else {
    const parts = [match[1], match[2].substring(0, keep), match[2].substring(half, half + keep)];
    return spaced ? parts.join(" ") : parts.join("");
  }
}

export function parseGridReference(gridRef: string): {eastings: number; northings: number} | null {
  const cleaned = (gridRef || "").toUpperCase().replace(/\s/g, "");
  const match = cleaned.match(/^([A-Z]{2})(\d+)$/);
  const gridCode = match ? match[1] : "";
  const digits = match ? match[2] : "";
  const halfLength = digits.length / 2;
  const square = GRID_LETTERS.map((row, rowIndex) => ({rowIndex, columnIndex: row.indexOf(gridCode)})).find(item => item.columnIndex !== -1) || null;
  if (!match || digits.length % 2 !== 0 || !square) {
    return null;
  } else {
    const precision = Math.pow(10, 5 - halfLength);
    return {
      eastings: square.columnIndex * 100000 + asNumber(digits.substring(0, halfLength)) * precision,
      northings: square.rowIndex * 100000 + asNumber(digits.substring(halfLength)) * precision
    };
  }
}
