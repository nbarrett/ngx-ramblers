import TurndownService from "turndown";

export function contentBlockHtmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
  turndownService.escape = value => value;
  const tokens: string[] = [];
  const protectedHtml = (html ?? "").replace(/\{\{[^}]+\}\}/g, match => {
    tokens.push(match);
    return `xTOKENx${tokens.length - 1}x`;
  });
  const markdown = turndownService.turndown(protectedHtml);
  return markdown.replace(/xTOKENx(\d+)x/g, (_full, index) => tokens[Number(index)]).trim();
}
