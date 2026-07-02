import * as crypto from "crypto";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("pdf-styled-extraction"));
debugLog.enabled = false;

interface StyledRun {
  text: string;
  fontName: string;
  size: number;
  x: number;
  width: number;
}

interface StyledLine {
  y: number;
  maxSize: number;
  runs: StyledRun[];
}

export interface ExtractedPdfImage {
  pageNumber: number;
  name: string;
  buffer: Buffer;
  width: number;
  height: number;
}

export interface StyledPdfExtraction {
  markdown: string;
  pageCount: number;
  images: ExtractedPdfImage[];
}

const MINIMUM_IMAGE_DIMENSION = 40;
const IMAGE_FURNITURE_PAGE_RATIO = 0.6;

function contentImages(imageResult: any, pageCount: number): ExtractedPdfImage[] {
  const extracted: ExtractedPdfImage[] = (imageResult?.pages || []).flatMap((page: any) => (page.images || [])
    .filter((image: any) => image?.data && image.width >= MINIMUM_IMAGE_DIMENSION && image.height >= MINIMUM_IMAGE_DIMENSION)
    .map((image: any) => ({
      pageNumber: page.num ?? page.pageNumber,
      name: image.name,
      buffer: Buffer.from(image.data),
      width: image.width,
      height: image.height
    })));
  const hashCounts = extracted.reduce((counts, image) => {
    const hash = crypto.createHash("md5").update(image.buffer.toString("base64")).digest("hex");
    counts.set(hash, (counts.get(hash) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const furnitureThreshold = Math.max(2, Math.ceil(pageCount * IMAGE_FURNITURE_PAGE_RATIO));
  return pageCount < 2 ? extracted : extracted.filter(image => {
    const hash = crypto.createHash("md5").update(image.buffer.toString("base64")).digest("hex");
    return (hashCounts.get(hash) || 0) < furnitureThreshold;
  });
}

const LINE_Y_TOLERANCE = 2;
const CELL_GAP = 12;
const TABLE_LINE_MINIMUM_CELLS = 3;
const TABLE_PAGE_LINE_RATIO = 0.12;
const TABLE_PAGE_MINIMUM_LINES = 3;
const RUN_GAP_FOR_SPACE = 1;
const TITLE_SIZE_RATIO = 1.6;
const HEADING_SIZE_RATIO = 1.2;
const EMPHASIS_SIZE_RATIO_MIN = 0.9;
const EMPHASIS_SIZE_RATIO_MAX = 1.15;

function linesFromTextContent(items: any[]): StyledLine[] {
  const lines = items
    .filter(item => item.str?.trim().length > 0)
    .reduce((accumulated: StyledLine[], item: any) => {
      const y = item.transform[5];
      const run: StyledRun = {
        text: item.str,
        fontName: item.fontName,
        size: item.height || Math.abs(item.transform[3]),
        x: item.transform[4],
        width: item.width || 0
      };
      const line = accumulated.find(existing => Math.abs(existing.y - y) <= Math.max(LINE_Y_TOLERANCE, 0.4 * Math.max(run.size, existing.maxSize)));
      if (line) {
        line.runs.push(run);
        line.maxSize = Math.max(line.maxSize, run.size);
      } else {
        accumulated.push({y, maxSize: run.size, runs: [run]});
      }
      return accumulated;
    }, []);
  return lines
    .map(line => ({...line, runs: line.runs.sort((first, second) => first.x - second.x)}))
    .sort((first, second) => second.y - first.y);
}

function dominantBodyStyle(lines: StyledLine[][]): { fontName: string; size: number } {
  const characterCounts = new Map<string, number>();
  lines.flat().forEach(line => line.runs.forEach(run => {
    const key = `${run.fontName}|${Math.round(run.size * 2) / 2}`;
    characterCounts.set(key, (characterCounts.get(key) || 0) + run.text.length);
  }));
  const dominant = Array.from(characterCounts.entries()).sort((first, second) => second[1] - first[1])[0];
  if (dominant) {
    const [fontName, size] = dominant[0].split("|");
    return {fontName, size: Number(size)};
  } else {
    return {fontName: "", size: 0};
  }
}

const SUPERSCRIPT_SIZE_RATIO = 0.8;

function lineText(line: StyledLine, isEmphasis: (run: StyledRun) => boolean, bodySize = 0): string {
  const segments = line.runs.reduce((accumulated: { text: string; emphasis: boolean; endX: number }[], run) => {
    const previous = accumulated.length > 0 ? accumulated[accumulated.length - 1] : null;
    const gap = previous ? run.x - previous.endX : 0;
    const spacer = previous && gap > RUN_GAP_FOR_SPACE && !previous.text.endsWith(" ") && !run.text.startsWith(" ") ? " " : "";
    const superscript = bodySize > 0 && run.size < bodySize * SUPERSCRIPT_SIZE_RATIO;
    const emphasis = superscript && previous ? previous.emphasis : isEmphasis(run);
    if (previous && previous.emphasis === emphasis) {
      previous.text = `${previous.text}${spacer}${run.text}`;
      previous.endX = run.x + run.width;
      return accumulated;
    } else {
      return [...accumulated, {text: `${spacer}${run.text}`, emphasis, endX: run.x + run.width}];
    }
  }, []);
  return segments
    .map(segment => {
      const trimmed = segment.text.trim();
      const leading = segment.text.startsWith(" ") ? " " : "";
      const trailing = segment.text.endsWith(" ") ? " " : "";
      const punctuationOnly = /^[(),.;:|\-\s]*$/.test(trimmed);
      return segment.emphasis && trimmed.length > 0 && !punctuationOnly ? `${leading}**${trimmed}**${trailing}` : segment.text;
    })
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}

function cellCount(line: StyledLine): number {
  return line.runs.reduce((accumulated: { cells: number; lastEnd: number }, run) => ({
    cells: accumulated.cells + (run.x - accumulated.lastEnd > CELL_GAP ? 1 : 0),
    lastEnd: run.x + run.width
  }), {cells: 1, lastEnd: line.runs[0] ? line.runs[0].x + line.runs[0].width : 0}).cells;
}

function isTablePage(lines: StyledLine[]): boolean {
  const tableLines = lines.filter(line => cellCount(line) >= TABLE_LINE_MINIMUM_CELLS).length;
  return tableLines >= TABLE_PAGE_MINIMUM_LINES && lines.length > 0 && tableLines / lines.length >= TABLE_PAGE_LINE_RATIO;
}

export async function extractStyledPdfMarkdown(buffer: Buffer): Promise<StyledPdfExtraction> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)});
  try {
    await parser.getInfo();
    const pdfDocument = (parser as any).doc;
    const pageNumbers = Array.from({length: pdfDocument.numPages}, (item, index) => index + 1);
    const pageLines: StyledLine[][] = [];
    for (const pageNumber of pageNumbers) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pageLines.push(linesFromTextContent(textContent.items));
    }
    const imageResult: any = await parser.getImage({imageBuffer: true}).catch(error => {
      debugLog("image extraction failed:", error);
      return null;
    });
    const images = contentImages(imageResult, pdfDocument.numPages);
    const tablePageNumbers = pageLines
      .map((lines, index) => ({lines, pageNumber: index + 1}))
      .filter(page => isTablePage(page.lines))
      .map(page => page.pageNumber);
    if (tablePageNumbers.length > 0) {
      const screenshots: any = await parser.getScreenshot({partial: tablePageNumbers, scale: 2, imageBuffer: true}).catch(error => {
        debugLog("table page screenshot failed:", error);
        return null;
      });
      (screenshots?.pages || []).forEach((page: any) => {
        const pageNumber = page.num ?? page.pageNumber;
        const data = page.images?.[0]?.data || page.data;
        if (data) {
          images.push({pageNumber, name: `table-page-${pageNumber}`, buffer: Buffer.from(data), width: 0, height: 0});
        }
      });
    }
    const body = dominantBodyStyle(pageLines);
    debugLog("dominant body style:", body);
    const isEmphasis = (run: StyledRun) => run.fontName !== body.fontName
      && run.size >= body.size * EMPHASIS_SIZE_RATIO_MIN
      && run.size <= body.size * EMPHASIS_SIZE_RATIO_MAX;
    const headingSizes = pageLines.flat()
      .map(line => line.maxSize)
      .filter(size => body.size > 0 && size >= body.size * HEADING_SIZE_RATIO);
    const titleSize = headingSizes.length > 0 ? Math.max(...headingSizes) : 0;
    const markdown = pageLines
      .map((lines, pageIndex) => {
        if (tablePageNumbers.includes(pageIndex + 1)) {
          return `![](pdf-image:table-page-${pageIndex + 1})`;
        }
        const pageText = lines
          .map(line => {
            const plain = lineText(line, () => false);
            if (titleSize > 0 && line.maxSize >= titleSize * 0.92 && titleSize >= body.size * TITLE_SIZE_RATIO) {
              return `# ${plain}`;
            } else if (body.size > 0 && line.maxSize >= body.size * HEADING_SIZE_RATIO) {
              return `## ${plain}`;
            } else {
              return lineText(line, isEmphasis, body.size);
            }
          })
          .join("\n");
        const pageImages = images
          .filter(image => image.pageNumber === pageIndex + 1)
          .map(image => `![](pdf-image:${image.name})`)
          .join("\n");
        return pageImages.length > 0 ? `${pageText}\n${pageImages}` : pageText;
      })
      .join("\n");
    const placedImages = images.filter(image => !tablePageNumbers.includes(image.pageNumber) || image.name.startsWith("table-page-"));
    return {markdown, pageCount: pdfDocument.numPages, images: placedImages};
  } finally {
    await parser.destroy();
  }
}
