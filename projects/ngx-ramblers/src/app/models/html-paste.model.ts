export interface HtmlPasteRow {
  text?: string;
  imageSource?: string | null;
  alt?: string | null;
}

export interface HtmlPastePreview {
  markdown: string;
  rows: HtmlPasteRow[];
}

export interface HtmlPasteResult {
  firstRow: HtmlPasteRow | null;
  additionalRows: HtmlPasteRow[];
  createNested?: boolean;
}
