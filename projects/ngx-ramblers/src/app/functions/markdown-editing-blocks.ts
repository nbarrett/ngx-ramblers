export function separateEditingBlocks(markdown: string): string {
  const prepared = closeTableGaps(withImagesOnTheirOwnLines(markdown));
  const lines = prepared.split("\n");
  const isListLine = (line: string) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
  const isImageLine = (line: string) => /^!\[[^\]]*\]\([^)]+\)$/.test(line.trim()) || /^<img\b/i.test(line.trim());
  const isTableLine = (line: string) => /^\s*\|/.test(line);
  const isQuoteLine = (line: string) => /^\s*>/.test(line);
  return lines.reduce<string[]>((built, line) => {
    const previous = built.length > 0 ? built[built.length - 1] : "";
    const previousHasText = previous.trim().length > 0;
    const lineHasText = line.trim().length > 0;
    const bothIndented = previous.startsWith("  ") && line.startsWith("  ");
    const tableRow = isTableLine(previous) && isTableLine(line);
    const quoteBlock = isQuoteLine(previous) || isQuoteLine(line);
    const betweenProse = previousHasText && lineHasText && !tableRow && !quoteBlock && !isListLine(previous) && !isListLine(line) && !isTableLine(previous) && !isTableLine(line) && !bothIndented;
    const leavesList = previousHasText && lineHasText && isListLine(previous) && !isListLine(line) && !isTableLine(line) && !line.startsWith("  ");
    const aroundImage = previousHasText && lineHasText && !tableRow && (isImageLine(previous) || isImageLine(line));
    const startsTable = previousHasText && isTableLine(line) && !isTableLine(previous);
    return (betweenProse || leavesList || aroundImage || startsTable) ? built.concat(["", line]) : built.concat([line]);
  }, []).join("\n").replace(/\n{3,}/g, "\n\n");
}

export function closeTableGaps(markdown: string): string {
  const lines = (markdown || "").split("\n");
  const isTableLine = (line: string) => /^\s*\|/.test(line);
  return lines.filter((line, index) => {
    if (line.trim() !== "") {
      return true;
    } else {
      const previous = lines.slice(0, index).reverse().find(item => item.trim() !== "") || "";
      const next = lines.slice(index + 1).find(item => item.trim() !== "") || "";
      return !(isTableLine(previous) && isTableLine(next));
    }
  }).join("\n");
}

export function withImagesOnTheirOwnLines(markdown: string): string {
  const image = /!\[[^\]]*\]\([^)\n]+\)|<img\b[^>]*>/gi;
  return (markdown || "").split("\n").flatMap(line => {
    if (line.trim().startsWith("|")) {
      return [line];
    } else {
      const matches = [...line.matchAll(image)];
      if (matches.length === 0) {
        return [line];
      } else {
        const pieces: string[] = [];
        const cursor = {index: 0};
        matches.forEach(match => {
          const before = line.slice(cursor.index, match.index).trim();
          if (before) {
            pieces.push(before, "");
          }
          pieces.push(match[0]);
          cursor.index = (match.index || 0) + match[0].length;
          if (line.slice(cursor.index).trim()) {
            pieces.push("");
          }
        });
        const after = line.slice(cursor.index).trim();
        if (after) {
          pieces.push(after);
        }
        return pieces;
      }
    }
  }).join("\n").replace(/\n{3,}/g, "\n\n");
}
