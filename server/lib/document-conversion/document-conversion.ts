import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { JSDOM } from "jsdom";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { htmlToMarkdown } from "../migration/turndown-service-factory";
import { pdfTextToMarkdown, postProcessConvertedMarkdown, promotePdfLeadingTitle, suggestedTitleFrom } from "./markdown-post-processing";
import { ExtractedPdfImage, extractStyledPdfMarkdown, StyledPdfExtraction } from "./pdf-styled-extraction";
import { DocumentConversionResponse } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

export type PdfImageUploader = (image: ExtractedPdfImage) => Promise<string | null>;

export function replacePdfImagePlaceholders(markdown: string, imagePaths: Map<string, string | null>): string {
  return markdown
    .split("\n")
    .map(line => {
      const placeholder = line.trim().match(/^!\[\]\(pdf-image:([^)]+)\)$/);
      if (placeholder) {
        const uploadedPath = imagePaths.get(placeholder[1]);
        return uploadedPath ? `![](${uploadedPath})` : null;
      } else {
        return line;
      }
    })
    .filter(line => line !== null)
    .join("\n");
}

const debugLog = debug(envConfig.logNamespace("document-conversion"));
debugLog.enabled = false;

function fileExtension(fileName: string): string {
  const parts = (fileName || "").split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function normaliseTables(html: string): string {
  const dom = new JSDOM(html);
  const ownerDocument = dom.window.document;
  const tables = Array.from(ownerDocument.querySelectorAll("table"));
  tables.forEach(table => {
    Array.from(table.querySelectorAll("tr"))
      .filter(row => (row.textContent || "").trim().length === 0)
      .forEach(row => row.remove());
    Array.from(table.querySelectorAll("td, th")).forEach(cell => {
      cell.innerHTML = cell.innerHTML.replace(/<br\s*\/?>/gi, " ");
      const blocks = Array.from(cell.children).filter(child => /^(P|DIV|UL|OL|H[1-6]|TABLE|BLOCKQUOTE)$/.test(child.tagName));
      if (blocks.length > 0) {
        cell.innerHTML = Array.from(cell.children)
          .map(child => child.innerHTML || child.textContent || "")
          .filter(content => content.trim().length > 0)
          .join(" ");
      }
    });
    const rows = Array.from(table.querySelectorAll("tr"));
    const occupied = new Map<string, boolean>();
    const nextFreeColumn = (rowIndex: number, column: number): number =>
      occupied.get(`${rowIndex}|${column}`) ? nextFreeColumn(rowIndex, column + 1) : column;
    rows.forEach((row, rowIndex) => {
      const finalColumn = Array.from(row.children).reduce((columnIndex, cell) => {
        const startColumn = nextFreeColumn(rowIndex, columnIndex);
        Array.from({length: startColumn - columnIndex}, () => null).forEach(() => {
          row.insertBefore(ownerDocument.createElement(cell.tagName.toLowerCase()), cell);
        });
        const colspan = Number(cell.getAttribute("colspan") || "1");
        const rowspan = Number(cell.getAttribute("rowspan") || "1");
        cell.removeAttribute("colspan");
        cell.removeAttribute("rowspan");
        Array.from({length: rowspan - 1}, (ignored, offset) => offset + 1).forEach(rowOffset => {
          Array.from({length: colspan}, (ignored, columnOffset) => columnOffset).forEach(columnOffset => {
            occupied.set(`${rowIndex + rowOffset}|${startColumn + columnOffset}`, true);
          });
        });
        Array.from({length: colspan - 1}, () => null).forEach(() => {
          row.insertBefore(ownerDocument.createElement(cell.tagName.toLowerCase()), cell.nextSibling);
        });
        return startColumn + colspan;
      }, 0);
      Array.from({length: nextFreeColumn(rowIndex, finalColumn) - finalColumn}, () => null).forEach(() => {
        row.appendChild(ownerDocument.createElement("td"));
      });
    });
    const maxColumns = Math.max(...rows.map(row => row.children.length), 0);
    rows.forEach(row => {
      Array.from({length: maxColumns - row.children.length}, () => null).forEach(() => {
        row.appendChild(ownerDocument.createElement("td"));
      });
    });
    const emptyColumns = Array.from({length: maxColumns}, (ignored, columnIndex) => columnIndex)
      .filter(columnIndex => rows.every(row => ((row.children[columnIndex] as HTMLElement)?.textContent || "").trim().length === 0));
    rows.forEach(row => {
      emptyColumns
        .slice()
        .reverse()
        .forEach(columnIndex => row.children[columnIndex]?.remove());
    });
    const cellText = (row: Element, columnIndex: number) => ((row.children[columnIndex] as HTMLElement)?.textContent || "").trim();
    const mergeSplitColumnsOnce = (): boolean => {
      const columnCount = Math.max(...rows.map(row => row.children.length), 0);
      const mergeIndex = Array.from({length: Math.max(columnCount - 1, 0)}, (ignored, index) => index)
        .find(columnIndex => {
          const leftPopulated = rows.some(row => cellText(row, columnIndex).length > 0);
          const rightPopulated = rows.some(row => cellText(row, columnIndex + 1).length > 0);
          const neverBoth = rows.every(row => cellText(row, columnIndex).length === 0 || cellText(row, columnIndex + 1).length === 0);
          return leftPopulated && rightPopulated && neverBoth;
        });
      if (mergeIndex === undefined) {
        return false;
      }
      rows.forEach(row => {
        const left = row.children[mergeIndex] as HTMLElement;
        const right = row.children[mergeIndex + 1] as HTMLElement;
        if (left && right) {
          if ((right.textContent || "").trim().length > 0) {
            left.innerHTML = right.innerHTML;
          }
          right.remove();
        }
      });
      return true;
    };
    const mergeSplitColumns = (): void => {
      if (mergeSplitColumnsOnce()) {
        mergeSplitColumns();
      }
    };
    mergeSplitColumns();
    const headerColumnCount = rows[0]?.children.length || 0;
    rows.slice(1).forEach(row => {
      const mergeOverflowIntoLastColumn = (): void => {
        if (headerColumnCount > 0 && row.children.length > headerColumnCount) {
          const overflow = row.children[row.children.length - 1] as HTMLElement;
          const lastKept = row.children[headerColumnCount - 1] as HTMLElement;
          if ((overflow.textContent || "").trim().length > 0) {
            lastKept.innerHTML = `${lastKept.innerHTML} ${overflow.innerHTML}`.trim();
          }
          overflow.remove();
          mergeOverflowIntoLastColumn();
        }
      };
      mergeOverflowIntoLastColumn();
      Array.from({length: headerColumnCount - row.children.length}, () => null).forEach(() => {
        row.appendChild(ownerDocument.createElement("td"));
      });
    });
    if (!table.querySelector("th")) {
      const firstRow = table.querySelector("tr");
      if (firstRow) {
        Array.from(firstRow.querySelectorAll("td")).forEach(cell => {
          const heading = ownerDocument.createElement("th");
          heading.innerHTML = cell.innerHTML;
          cell.replaceWith(heading);
        });
        const head = ownerDocument.createElement("thead");
        head.appendChild(firstRow);
        table.insertBefore(head, table.firstChild);
      }
    }
  });
  return ownerDocument.body.innerHTML;
}

async function convertDocx(buffer: Buffer): Promise<DocumentConversionResponse> {
  const result = await mammoth.convertToHtml({buffer});
  debugLog("mammoth messages:", result.messages);
  const markdown = htmlToMarkdown(normaliseTables(result.value), undefined, true);
  return postProcessConvertedMarkdown(markdown);
}

function pdfResponseFrom(text: string, pageCount: number): DocumentConversionResponse {
  const processed = postProcessConvertedMarkdown(pdfTextToMarkdown(text, pageCount));
  const markdown = promotePdfLeadingTitle(processed.markdown);
  return {markdown, suggestedTitle: suggestedTitleFrom(markdown)};
}

async function uploadedImagePaths(images: ExtractedPdfImage[], imageUploader?: PdfImageUploader): Promise<Map<string, string | null>> {
  const paths = new Map<string, string | null>();
  for (const image of images) {
    const uploadedPath = imageUploader ? await imageUploader(image).catch(error => {
      debugLog("image upload failed for", image.name, error);
      return null;
    }) : null;
    paths.set(image.name, uploadedPath);
  }
  return paths;
}

async function convertPdf(buffer: Buffer, imageUploader?: PdfImageUploader): Promise<DocumentConversionResponse> {
  const styled: StyledPdfExtraction = await extractStyledPdfMarkdown(buffer).catch(error => {
    debugLog("styled extraction failed, falling back to plain text extraction:", error);
    return null;
  });
  if (styled?.markdown?.trim()) {
    const imagePaths = await uploadedImagePaths(styled.images, imageUploader);
    const response = pdfResponseFrom(styled.markdown, styled.pageCount);
    return {...response, markdown: replacePdfImagePlaceholders(response.markdown, imagePaths)};
  } else {
    const parser = new PDFParse({data: buffer});
    try {
      const result = await parser.getText({parseHyperlinks: true});
      debugLog("pdf-parse extracted", result.text?.length || 0, "characters from", result.total, "pages");
      if (!result.text?.trim()) {
        throw new Error("No text could be extracted from this PDF - it may be a scanned document made of images");
      }
      return pdfResponseFrom(result.text, result.total);
    } finally {
      await parser.destroy();
    }
  }
}

export async function convertBufferToMarkdown(buffer: Buffer, fileName: string, imageUploader?: PdfImageUploader): Promise<DocumentConversionResponse> {
  const extension = fileExtension(fileName);
  debugLog("converting", fileName, "with extension", extension, "size", buffer.length);
  if (extension === "docx") {
    return convertDocx(buffer);
  } else if (extension === "pdf") {
    return convertPdf(buffer, imageUploader);
  } else if (extension === "doc") {
    throw new Error("Old binary .doc files are not supported - please save the file as .docx and try again");
  } else {
    throw new Error(`Unsupported file type .${extension} - only .docx and .pdf files can be converted`);
  }
}
