import { RAMBLERS_EMAIL_TOKENS as T } from "./ramblers-design-tokens";

function unbrandedStyles(): string {
  return `<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #ffffff; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
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
