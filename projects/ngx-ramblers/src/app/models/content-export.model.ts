export enum ContentExportFormat {
  JSON = "json",
  HTML = "html",
  MARKDOWN = "markdown"
}

export interface ContentExport {
  id: string;
  title: string;
  path: string;
  contentMarkdown: string;
  contentHtml: string;
}

export interface PageSeoDescriptor {
  title: string;
  description: string;
  contentHtml: string;
  exportablePath?: string;
}
