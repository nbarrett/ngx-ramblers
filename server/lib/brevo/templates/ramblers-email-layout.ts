import { RAMBLERS_EMAIL_TOKENS as T } from "./ramblers-design-tokens";

const W = T.maxWidth;

function responsiveStyles(): string {
  return `<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: ${T.pageBg}; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { color: ${T.linkColor}; text-decoration: underline; }
  h1 { font-family: ${T.fontFamily}; font-size: ${T.h1Size}; font-weight: bold; color: ${T.bodyColor}; line-height: 125%; margin: 0 0 16px; text-align: center; }
  h2 { font-family: ${T.fontFamily}; font-size: ${T.h2Size}; font-weight: bold; color: ${T.bodyColor}; line-height: 125%; margin: 0 0 12px; text-align: left; }
  h3 { font-family: ${T.fontFamily}; font-size: ${T.h3Size}; font-weight: bold; color: ${T.h3Color}; line-height: 150%; margin: 0 0 8px; text-align: left; }
  h4 { font-family: ${T.h4Font}; font-size: ${T.h4Size}; font-weight: bold; font-style: normal; color: ${T.h4Color}; line-height: 150%; margin: 0 0 8px; text-align: left; }
  p { margin: 0 0 12px; }
  @media only screen and (max-width: 768px) {
    .email-container { width: 100% !important; max-width: 100% !important; }
    .banner-img { width: 100% !important; height: auto !important; }
  }
  @media only screen and (max-width: 480px) {
    .email-body { padding: 20px 16px !important; }
    .email-footer-inner { padding: 20px 16px !important; }
    h1 { font-size: 28px !important; }
    h2 { font-size: 24px !important; }
    h3 { font-size: 20px !important; }
  }
</style>`;
}

function preHeader(): string {
  return `<tr>
  <td align="center" style="padding: 20px 0 10px 0; background-color: ${T.pageBg};">
    <a href="{{ mirror }}" style="color: #757575; font-family: ${T.fontFamily}; font-size: 12px; text-decoration: underline;">View this email in your browser</a>
  </td>
</tr>`;
}

function banner(): string {
  return `<tr>
  <td align="center" style="padding: 0;">
    <a href="{{params.systemMergeFields.APP_URL}}" target="_blank">
      <img src="{{params.messageMergeFields.BANNER_IMAGE_SOURCE}}" alt="{{params.systemMergeFields.APP_SHORTNAME}} Logo" width="${W}" class="banner-img" style="display: block; width: ${W}px; max-width: 100%; height: auto; border: 0; outline: none; -ms-interpolation-mode: bicubic;">
    </a>
  </td>
</tr>`;
}

function accentDivider(): string {
  return `<tr>
  <td style="padding: 22px 30px 12px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; width: 100%;">
      <tr>
        <td style="border-top: ${T.dividerThickness} solid {{params.messageMergeFields.ACCENT_COLOR}};">&nbsp;</td>
      </tr>
    </table>
  </td>
</tr>`;
}

function bodySection(bodyContent: string): string {
  return `<tr>
  <td class="email-body" style="padding: 30px; font-family: ${T.fontFamily}; font-size: ${T.bodyFontSize}; line-height: ${T.bodyLineHeight}; color: ${T.bodyColor};">
    ${bodyContent}
  </td>
</tr>`;
}

function socialIcons(): string {
  return `<td align="center" style="padding: 20px 0;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="border-collapse: collapse; margin: 0 auto;">
      <tr>
        {% if params.systemMergeFields.FACEBOOK_URL %}
        <td style="padding: 0 5px;">
          <a href="{{params.systemMergeFields.FACEBOOK_URL}}" target="_blank" style="display: block;">
            <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/color-facebook-48.png" alt="Facebook" width="24" height="24" style="display: block; border: 0;">
          </a>
        </td>
        {% endif %}
        {% if params.systemMergeFields.TWITTER_URL %}
        <td style="padding: 0 5px;">
          <a href="{{params.systemMergeFields.TWITTER_URL}}" target="_blank" style="display: block;">
            <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/color-twitter-48.png" alt="Twitter" width="24" height="24" style="display: block; border: 0;">
          </a>
        </td>
        {% endif %}
        {% if params.systemMergeFields.INSTAGRAM_URL %}
        <td style="padding: 0 5px;">
          <a href="{{params.systemMergeFields.INSTAGRAM_URL}}" target="_blank" style="display: block;">
            <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/color-instagram-48.png" alt="Instagram" width="24" height="24" style="display: block; border: 0;">
          </a>
        </td>
        {% endif %}
        {% if params.systemMergeFields.APP_URL %}
        <td style="padding: 0 5px;">
          <a href="{{params.systemMergeFields.APP_URL}}" target="_blank" style="display: block;">
            <img src="https://cdn-images.mailchimp.com/icons/social-block-v2/color-link-48.png" alt="Website" width="24" height="24" style="display: block; border: 0;">
          </a>
        </td>
        {% endif %}
      </tr>
    </table>
  </td>`;
}

function footer(): string {
  return `<tr>
  <td align="center" style="background-color: ${T.footerBg};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        ${socialIcons()}
      </tr>
      <tr>
        <td class="email-footer-inner" align="center" style="padding: 0 20px 30px; color: ${T.footerTextColor}; font-family: ${T.fontFamily}; font-size: ${T.footerFontSize}; line-height: 1.6;">
          {{params.systemMergeFields.APP_LONGNAME}}<br>
          Ramblers Charity England &amp; Wales No: 1093577 Scotland No: SC039799<br><br>
          You can <a href="{{params.systemMergeFields.APP_URL}}/admin/email-subscriptions" style="color: ${T.footerTextColor}; text-decoration: underline;" target="_blank">update your email subscriptions</a>.<br><br>
          {{params.accountMergeFields.STREET}}, {{params.accountMergeFields.POSTCODE}}, {{params.accountMergeFields.TOWN}}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function postFooter(): string {
  return `<tr>
  <td align="center" style="padding: 20px; background-color: ${T.pageBg};">
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="color: #606060; font-family: ${T.fontFamily}; font-size: 11px; line-height: 1.5; text-align: center;">
          Sent to <a href="mailto:{{params.memberMergeFields.EMAIL}}" style="color: #404040;">{{params.memberMergeFields.EMAIL}}</a><br>
          <a href="{{ unsubscribe }}" style="color: #404040; text-decoration: underline;">Unsubscribe</a><br>
          {{params.systemMergeFields.APP_LONGNAME}} · {{params.accountMergeFields.STREET}} · {{params.accountMergeFields.TOWN}}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

export function ramblersEmailLayout(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>{{params.messageMergeFields.subject}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  ${responsiveStyles()}
</head>
<body style="margin: 0; padding: 0; background-color: ${T.pageBg};">
  <center style="width: 100%; background-color: ${T.pageBg};">
    <!--[if mso]>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" width="${W}">
      <tr>
        <td>
    <![endif]-->
    <table role="presentation" class="email-container" align="center" cellpadding="0" cellspacing="0" width="${W}" style="max-width: ${W}px; margin: 0 auto; background-color: ${T.contentBg};">
      ${preHeader()}
      ${banner()}
      ${accentDivider()}
      ${bodySection(bodyContent)}
      ${accentDivider()}
      ${footer()}
      ${postFooter()}
    </table>
    <!--[if mso]>
        </td>
      </tr>
    </table>
    <![endif]-->
  </center>
</body>
</html>`;
}
