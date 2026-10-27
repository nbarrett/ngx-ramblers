import { RAMBLERS_EMAIL_TOKENS as T } from "./ramblers-design-tokens";
import { JSDOM } from "jsdom";

export function normaliseUnbrandedEmailContent(html: string): string {
  const document = new JSDOM(html).window.document;
  document.querySelectorAll("style, link[rel=stylesheet]").forEach(element => element.remove());
  const headingSizes = new Map([
    ["H1", T.h2Size],
    ["H2", T.h3Size],
    ["H3", T.h4Size],
    ["H4", T.h4Size],
    ["H5", T.bodyFontSize],
    ["H6", T.bodyFontSize]
  ]);
  document.body.querySelectorAll<HTMLElement>("*").forEach(element => {
    const weight = element.style.fontWeight;
    const emphasis = element.style.fontStyle;
    const heading = element.closest("h1,h2,h3,h4,h5,h6");
    const link = element.closest("a");
    Array.from(element.style).filter(property => property === "font" || property.startsWith("mso-") || property === "letter-spacing")
      .forEach(property => element.style.removeProperty(property));
    ["face", "size", "color"].forEach(attribute => element.removeAttribute(attribute));
    element.style.setProperty("font-family", T.fontFamily);
    element.style.setProperty("font-size", headingSizes.get(heading?.tagName) ?? T.bodyFontSize);
    element.style.setProperty("line-height", heading ? "130%" : T.bodyLineHeight);
    element.style.setProperty("color", link ? T.linkColor : T.bodyColor);
    if (weight) {
      element.style.setProperty("font-weight", weight);
    }
    if (emphasis) {
      element.style.setProperty("font-style", emphasis);
    }
    if (link) {
      element.style.setProperty("text-decoration", "underline");
    }
  });
  return document.body.innerHTML;
}

function unbrandedStyles(): string {
  return `<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #ffffff; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  .unbranded-body img { max-width: 100%; height: auto; }
  a { color: ${T.linkColor}; text-decoration: underline; }
  h1, h2, h3, h4 { font-family: ${T.fontFamily}; color: ${T.bodyColor}; line-height: 130%; margin: 0 0 12px; }
  h1 { font-size: ${T.h2Size}; font-weight: bold; }
  h2 { font-size: ${T.h3Size}; font-weight: bold; }
  h3 { font-size: ${T.h4Size}; font-weight: bold; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 12px; padding-left: 24px; }
  blockquote { margin: 0 0 12px; padding-left: 12px; border-left: 3px solid #d6d6d6; color: #555555; }
  @media only screen and (max-width: 600px) {
    .unbranded-body { padding: 16px !important; }
  }
</style>`;
}

export function unbrandedEmailLayout(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{params.messageMergeFields.subject}}</title>
  ${unbrandedStyles()}
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; background-color: #ffffff;">
    <tr>
      <td class="unbranded-body" style="padding: 24px; font-family: ${T.fontFamily}; font-size: ${T.bodyFontSize}; line-height: ${T.bodyLineHeight}; color: ${T.bodyColor}; word-break: break-word; overflow-wrap: anywhere;">
        ${bodyContent}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
