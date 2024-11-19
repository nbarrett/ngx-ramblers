export function gridCodeFrom(eastings: number, northings: number): string {
  const gridLetters = [
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

  if (eastings < 0 || eastings >= 700000 || northings < 0 || northings >= 1300000) {
    throw new Error("Coordinates out of bounds for OS grid.");
  }

  const columnIndex = Math.floor(eastings / 100000);
  const rowIndex = Math.floor(northings / 100000);

  if (rowIndex >= gridLetters.length || columnIndex >= gridLetters[0].length) {
    throw new Error("Coordinates map to an undefined grid square.");
  }

  return gridLetters[rowIndex][columnIndex];
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
