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
      const replaced = line.replace(/!\[([^\]]*)\]\(pdf-image:([^)]+)\)/g, (match, alt, name) => {
        const uploadedPath = imagePaths.get(name);
        return uploadedPath ? `![${alt}](${uploadedPath})` : "";
      });
      return replaced.trim().length > 0 ? replaced : null;
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

export async function normaliseTables(html: string): Promise<string> {
  const { JSDOM } = await import("jsdom");
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
      } else {
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
      }
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

async function convertDocx(buffer: Buffer, imageUploader?: PdfImageUploader): Promise<DocumentConversionResponse> {
  const { default: mammoth } = await import("mammoth");
  const { default: sharp } = await import("sharp");
  const imageNumber = {value: 0};
  const imageFailure = {message: ""};
  const result = await mammoth.convertToHtml({buffer}, {
    convertImage: mammoth.images.imgElement(async image => {
      imageNumber.value += 1;
      try {
        const imageBuffer = await sharp(Buffer.from(await image.readAsArrayBuffer())).png().toBuffer();
        const name = `docx-image-${imageNumber.value}`;
        const src = imageUploader ? await imageUploader({name, buffer: imageBuffer, pageNumber: 0, width: 0, height: 0}) : null;
        if (imageUploader && !src) {
          imageFailure.message = `Could not upload embedded image ${imageNumber.value}`;
        }
        return {src: src || ""};
      } catch (error) {
        imageFailure.message = `Could not convert embedded image ${imageNumber.value}: ${error.message}`;
        return {src: ""};
      }
    })
  });
  if (imageFailure.message) {
    throw new Error(imageFailure.message);
  }
  debugLog("mammoth messages:", result.messages);
  return convertHtmlToMarkdown(result.value);
}

export async function convertHtmlToMarkdown(html: string): Promise<DocumentConversionResponse> {
  const markdown = htmlToMarkdown(await normaliseTables(html), undefined, true);
  return postProcessConvertedMarkdown(markdown);
}

export async function convertWordClipboardHtml(html: string): Promise<DocumentConversionResponse> {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const paragraphs = Array.from(document.body.querySelectorAll("p"));
  const lists = {current: null as HTMLElement | null};
  paragraphs.forEach(paragraph => {
    const parent = paragraph.parentElement;
    const label = paragraph.textContent || "";
    const listMarker = label.match(/^\s*(\d+[.)]|[·•])\s*/);
    const wordList = /mso-list\s*:/i.test(paragraph.getAttribute("style") || "") || !!listMarker;
    const heading = /\bMsoTitle\b/i.test(paragraph.className) ? "h1" : /\bMsoSubtitle\b/i.test(paragraph.className) ? "h2" : null;
    if (wordList && listMarker && parent) {
      const listType = /^\d/.test(listMarker[1]) ? "ol" : "ul";
      const adjacent = lists.current && lists.current.tagName.toLowerCase() === listType && lists.current === paragraph.previousElementSibling;
      const list = adjacent ? lists.current : document.createElement(listType);
      if (!adjacent) {
        if (listType === "ol") {
          list.setAttribute("start", listMarker[1].match(/^\d+/)?.[0] || "1");
        }
        parent.insertBefore(list, paragraph);
      }
      const markerLength = listMarker[0].length;
      const remaining = {count: markerLength};
      const walker = document.createTreeWalker(paragraph, dom.window.NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      const collectTextNodes = (): void => {
        if (walker.nextNode()) {
          textNodes.push(walker.currentNode as Text);
          collectTextNodes();
        }
      };
      collectTextNodes();
      textNodes.forEach(node => {
        if (remaining.count > 0) {
          const removed = Math.min(remaining.count, node.data.length);
          node.data = node.data.slice(removed);
          remaining.count -= removed;
        }
      });
      const item = document.createElement("li");
      item.replaceChildren(...Array.from(paragraph.childNodes));
      list.appendChild(item);
      lists.current = list;
      paragraph.remove();
    } else if (heading && parent) {
      const element = document.createElement(heading);
      element.replaceChildren(...Array.from(paragraph.childNodes));
      parent.replaceChild(element, paragraph);
      lists.current = null;
    } else {
      lists.current = null;
    }
  });
  Array.from(document.body.querySelectorAll("p img")).forEach(image => {
    const paragraph = image.closest("p");
    if (paragraph?.parentElement) {
      const imageParagraph = document.createElement("p");
      imageParagraph.appendChild(image);
      paragraph.after(imageParagraph);
    }
  });
  return convertHtmlToMarkdown(document.body.innerHTML);
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
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)});
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
    return convertDocx(buffer, imageUploader);
  } else if (extension === "pdf") {
    return convertPdf(buffer, imageUploader);
  } else if (extension === "doc") {
    throw new Error("Old binary .doc files are not supported - please save the file as .docx and try again");
  } else {
    throw new Error(`Unsupported file type .${extension} - only .docx and .pdf files can be converted`);
  }
}
