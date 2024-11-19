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

export function gridReferenceFrom(eastings: number, northings: number): string {
  const gridCode = gridCodeFrom(eastings, northings);

  // Calculate remainder after subtracting the 100km square offsets
  const localEastings = eastings % 100000;
  const localNorthings = northings % 100000;

  // Pad to ensure 5-digit output
  const paddedEastings = localEastings.toString().padStart(5, "0");
  const paddedNorthings = localNorthings.toString().padStart(5, "0");

  return `${gridCode} ${paddedEastings} ${paddedNorthings}`;
}
