import { asNumber } from "../../../projects/ngx-ramblers/src/app/functions/numbers";

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

export function parseGridReference(gridRef: string): {eastings: number; northings: number} | null {
  const cleaned = gridRef.toUpperCase().replace(/\s/g, "");
  const match = cleaned.match(/^([A-Z]{2})(\d+)$/);

  if (!match) {
    return null;
  }

  const gridCode = match[1];
  const digits = match[2];

  if (digits.length % 2 !== 0) {
    return null;
  }

  const halfLength = digits.length / 2;
  const eastingPart = digits.substring(0, halfLength);
  const northingPart = digits.substring(halfLength);

  const gridMatch = GRID_LETTERS.reduce<{rowIndex: number; columnIndex: number}>(
    (acc, row, rowIdx) => {
      if (acc.rowIndex !== -1) return acc;
      const colIdx = row.indexOf(gridCode);
      return colIdx !== -1 ? { rowIndex: rowIdx, columnIndex: colIdx } : acc;
    },
    { rowIndex: -1, columnIndex: -1 }
  );
  const rowIndex = gridMatch.rowIndex;
  const columnIndex = gridMatch.columnIndex;

  if (rowIndex === -1 || columnIndex === -1) {
    return null;
  }

  const baseEasting = columnIndex * 100000;
  const baseNorthing = rowIndex * 100000;

  const precision = Math.pow(10, 5 - halfLength);
  const easting = baseEasting + asNumber(eastingPart) * precision;
  const northing = baseNorthing + asNumber(northingPart) * precision;

  return {eastings: easting, northings: northing};
}
