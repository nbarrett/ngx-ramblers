export const STANDARD_CSV_PARSE_OPTIONS = {
  columns: true as const,
  delimiter: ",",
  escape: "\"",
  skip_empty_lines: true,
  trim: true,
  relax_column_count: true,
  record_delimiter: ["\r\n", "\n", "\r"],
  bom: true
};
