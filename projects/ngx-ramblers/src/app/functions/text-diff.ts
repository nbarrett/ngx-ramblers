import { DiffSegment, DiffSegmentKind } from "../models/text-diff.model";
import { decodeHtmlEntities } from "./strings";

function tokens(text: string): string[] {
  return (text || "").split(/(\s+|[.,;:!?…]+(?=\s|$)|\*{1,3}|_{2,3}|`+)/).filter(token => token.length > 0);
}

function longestCommonSubsequenceTable(before: string[], after: string[]): number[][] {
  const table: number[][] = Array.from({length: before.length + 1}, () => Array.from({length: after.length + 1}, () => 0));
  before.forEach((beforeToken, i) => {
    after.forEach((afterToken, j) => {
      table[i + 1][j + 1] = beforeToken === afterToken ? table[i][j] + 1 : Math.max(table[i][j + 1], table[i + 1][j]);
    });
  });
  return table;
}

function mergeAdjacent(segments: DiffSegment[]): DiffSegment[] {
  return segments.reduce((merged, segment) => {
    const last = merged[merged.length - 1];
    if (last && last.kind === segment.kind) {
      return [...merged.slice(0, -1), {kind: last.kind, text: last.text + segment.text}];
    } else {
      return [...merged, segment];
    }
  }, [] as DiffSegment[]);
}

export function wordDiff(before: string, after: string): DiffSegment[] {
  const beforeTokens = tokens(before);
  const afterTokens = tokens(after);
  const table = longestCommonSubsequenceTable(beforeTokens, afterTokens);
  const walk = (i: number, j: number, acc: DiffSegment[]): DiffSegment[] => {
    if (i === 0 && j === 0) {
      return acc;
    } else if (i > 0 && j > 0 && beforeTokens[i - 1] === afterTokens[j - 1]) {
      return walk(i - 1, j - 1, [{kind: DiffSegmentKind.SAME, text: beforeTokens[i - 1]}, ...acc]);
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      return walk(i, j - 1, [{kind: DiffSegmentKind.ADDED, text: afterTokens[j - 1]}, ...acc]);
    } else {
      return walk(i - 1, j, [{kind: DiffSegmentKind.REMOVED, text: beforeTokens[i - 1]}, ...acc]);
    }
  };
  return mergeAdjacent(walk(beforeTokens.length, afterTokens.length, []));
}

export function escapeHtml(text: string): string {
  return (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const DIFF_REMOVED_CLASS = "text-danger text-decoration-line-through";
export const DIFF_ADDED_CLASS = "text-success";

export function wordDiffHtml(before: string, after: string): string {
  const collapse = (text: string) => (text || "").replace(/\s+/g, " ").trim();
  return wordDiff(collapse(before), collapse(after)).map(segment => {
    if (segment.kind === DiffSegmentKind.REMOVED) {
      return `<span class="${DIFF_REMOVED_CLASS}">${escapeHtml(segment.text)}</span>`;
    } else if (segment.kind === DiffSegmentKind.ADDED) {
      return `<span class="${DIFF_ADDED_CLASS}">${escapeHtml(segment.text)}</span>`;
    } else {
      return escapeHtml(segment.text);
    }
  }).join("");
}

export function textFingerprint(text: string): string {
  const normalised = decodeHtmlEntities(text || "").replace(/\s+/g, " ").trim();
  return [...normalised].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 2147483647, 7).toString(36);
}
