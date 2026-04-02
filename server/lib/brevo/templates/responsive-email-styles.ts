export const RESPONSIVE_EMAIL_CSS = `<style type="text/css">
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
img { -ms-interpolation-mode: bicubic; max-width: 100%; height: auto; }
@media only screen and (max-width: 620px) {
  table[width="600"], td[width="600"] { width: 100% !important; max-width: 100% !important; }
  table[style*="width:600px"], td[style*="width:600px"], table[style*="width: 600px"], td[style*="width: 600px"] { width: 100% !important; max-width: 100% !important; }
  table[style*="max-width: 600px"] { width: 100% !important; }
  img[width="600"] { width: 100% !important; height: auto !important; }
  td[style*="padding: 0 9px"], td[style*="padding: 0px 9px"] { padding: 0px 12px !important; }
  td[style*="padding: 9px"] { padding: 9px 12px !important; }
  img { max-width: 100% !important; height: auto !important; }
  h3, h4 { word-wrap: break-word !important; }
  a { word-break: break-all !important; }
}
</style>`;

const VIEWPORT_META = `<meta name="viewport" content="width=device-width, initial-scale=1.0">`;
const CHARSET_META = `<meta charset="utf-8">`;
const XHTML_CHARSET_META = `<meta charset="utf-8" />`;
const XHTML_VIEWPORT_META = `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`;

export function injectResponsiveStyles(html: string): string {
  if (html.includes("@media") && html.includes("max-width")) {
    return html;
  }
  const isXhtml = html.includes("XHTML");
  const charset = isXhtml ? XHTML_CHARSET_META : CHARSET_META;
  const viewport = isXhtml ? XHTML_VIEWPORT_META : VIEWPORT_META;
  const headInjection = `${charset}${viewport}`;
  const bodyStyle = ` style="margin: 0; padding: 0; width: 100%;"`;

  let result = html;
  if (!result.includes("viewport")) {
    result = result.replace(/<head>/, `<head>${headInjection}`);
  }
  if (!result.includes(RESPONSIVE_EMAIL_CSS.slice(0, 30))) {
    result = result.replace(/<\/head>/, `${RESPONSIVE_EMAIL_CSS}</head>`);
  }
  if (!result.includes("margin: 0") || !result.match(/<body[^>]*style/)) {
    result = result.replace(/<body(?!\s[^>]*style)([^>]*)>/, `<body$1${bodyStyle}>`);
  }
  return result;
}
