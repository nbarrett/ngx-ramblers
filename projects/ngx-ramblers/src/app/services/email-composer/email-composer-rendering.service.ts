import { inject, Injectable } from "@angular/core";
import { Marked } from "marked";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import {
  ArticleBlock,
  ArticleBlockImageAlignment,
  ArticleBlockPosition,
  dividerHtml,
  SectionDividerStyle
} from "../../models/email-composer.model";
import { UrlService } from "../url.service";

const localMarked = new Marked({
  extensions: [
    {
      name: "underline",
      level: "inline",
      renderer(token: any) {
        const inner = token.tokens ? (this as any).parser.parseInline(token.tokens) : (token.text ?? "");
        return `<u>${inner}</u>`;
      }
    }
  ]
});

@Injectable({ providedIn: "root" })
export class EmailComposerRenderingService {

  private logger: Logger = inject(LoggerFactory).createLogger("EmailComposerRenderingService", NgxLoggerLevel.ERROR);
  private urlService = inject(UrlService);

  markdownToHtml(markdown: string): string {
    if (!markdown) return "";
    try {
      const rendered = localMarked.parse(markdown, { async: false }) as string;
      this.logger.off("markdownToHtml input length:", markdown.length, "output length:", rendered.length);
      return this.constrainInlineImages(rendered);
    } catch (error) {
      this.logger.error("markdownToHtml failed:", error, "input:", markdown);
      const escaped = markdown
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre>${escaped}</pre>`;
    }
  }

  private constrainInlineImages(html: string): string {
    return html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      if (/style\s*=/.test(attrs)) {
        return match.replace(/style\s*=\s*"([^"]*)"/i, (_styleMatch, existing) => {
          const trimmed = (existing as string).trim();
          const sep = trimmed.endsWith(";") || trimmed === "" ? "" : ";";
          return `style="${trimmed}${sep}max-width:100%;height:auto;"`;
        });
      }
      return `<img${attrs} style="max-width:100%;height:auto;">`;
    });
  }

  renderArticleBlock(block: ArticleBlock): string {
    const titleHtml = block.title
      ? `<h3 style="font-family:Arial,sans-serif;color:#202124;margin:18px 0 8px 0;">${this.escapeHtml(block.title)}</h3>`
      : "";
    const bodyHtml = this.markdownToHtml(block.markdown);
    const buttonHtml = this.ctaButtonHtml(block);
    const contentHtml = titleHtml + bodyHtml + buttonHtml;
    const image = block.image;
    if (!image?.src) {
      return this.tableSection(contentHtml);
    }
    const altAttr = image.alt ? this.escapeHtml(image.alt) : "";
    const widthAttr = image.width ? ` width="${image.width}"` : ` width="100%"`;
    const cleanedSrc = this.urlService.isRemoteUrl(image.src) ? image.src : image.src.replace(/^\/+/, "");
    const resolvedSrc = this.urlService.imageSource(cleanedSrc, true) ?? cleanedSrc;
    const imgTag = `<img src="${this.escapeAttr(resolvedSrc)}" alt="${altAttr}"${widthAttr} style="max-width:100%;height:auto;border:0;display:block;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;vertical-align:bottom"/>`;
    if (image.alignment === ArticleBlockImageAlignment.LEFT) {
      return this.tableSectionWithSideImage(imgTag, contentHtml, "left");
    }
    if (image.alignment === ArticleBlockImageAlignment.RIGHT) {
      return this.tableSectionWithSideImage(imgTag, contentHtml, "right");
    }
    return this.tableSectionWithBannerImage(imgTag, contentHtml);
  }

  private ctaButtonHtml(block: ArticleBlock): string {
    const text = block.buttonText?.trim();
    const url = block.buttonUrl?.trim();
    if (!text || !url) return "";
    const safeText = this.escapeHtml(text);
    const safeUrl = this.escapeAttr(this.urlService.absoluteUrlFor(url));
    return `<table align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;width:100%;" width="100%"><tbody><tr><td align="center" style="padding-top: 0;padding-bottom: 18px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;" valign="top"><table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate !important;border-radius: 0px;background-color: #F9B104;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;" width="100%"><tbody><tr><td align="center" style="font-family: Arial;font-size: 16px;padding: 12px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;" valign="middle"><a target="_blank" style="font-weight:bold;letter-spacing:normal;line-height:100%;text-align:center;text-decoration:none;color:#222222;mso-line-height-rule:exactly;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;display:block;" title="${safeText}" href="${safeUrl}">${safeText}</a></td></tr></tbody></table></td></tr></tbody></table>`;
  }

  private tableSection(innerHtml: string): string {
    return `<table align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;" width="100%"><tbody><tr><td valign="top" style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:150%;color:#222222;word-break:break-word;">${innerHtml}</td></tr></tbody></table>`;
  }

  private tableSectionWithBannerImage(imgTag: string, contentHtml: string): string {
    return `<table align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;" width="100%"><tbody><tr><td align="center" valign="top">${imgTag}</td></tr><tr><td valign="top" style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:150%;color:#222222;word-break:break-word;padding-top:12px;">${contentHtml}</td></tr></tbody></table>`;
  }

  private tableSectionWithSideImage(imgTag: string, contentHtml: string, side: "left" | "right"): string {
    const imageCell = `<td valign="top" width="40%" style="padding:${side === "left" ? "0 16px 0 0" : "0 0 0 16px"};">${imgTag}</td>`;
    const textCell = `<td valign="top" style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:150%;color:#222222;word-break:break-word;">${contentHtml}</td>`;
    const cells = side === "left" ? imageCell + textCell : textCell + imageCell;
    return `<table align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;" width="100%"><tbody><tr>${cells}</tr></tbody></table>`;
  }

  renderArticleBlocks(blocks: ArticleBlock[], position: ArticleBlockPosition): string {
    if (!blocks || blocks.length === 0) return "";
    const positioned = blocks.filter(block => block.position === position).sort((a, b) => a.order - b.order);
    return positioned.map(block => this.renderArticleBlock(block)).join("\n");
  }

  renderArticleBlocksAsList(blocks: ArticleBlock[], position: ArticleBlockPosition): string[] {
    if (!blocks || blocks.length === 0) return [];
    return blocks
      .filter(block => block.position === position)
      .sort((a, b) => a.order - b.order)
      .map(block => this.renderArticleBlock(block));
  }

  joinSectionsWithDividers(sections: string[], style: SectionDividerStyle): string {
    const filtered = sections.filter(part => !!part && part.trim().length > 0);
    if (filtered.length === 0) return "";
    const divider = dividerHtml(style);
    if (!divider || filtered.length === 1) return filtered.join("\n");
    return filtered.join(`\n${divider}\n`);
  }

  joinSectionsWithPerSectionDividers(sections: { content: string; dividerAfter: SectionDividerStyle }[], appendTrailing = false): string {
    const filtered = sections.filter(s => !!s.content && s.content.trim().length > 0);
    if (filtered.length === 0) return "";
    return filtered.map((section, idx) => {
      if (idx === filtered.length - 1 && !appendTrailing) return section.content;
      const divider = dividerHtml(section.dividerAfter);
      return divider ? `${section.content}\n${divider}` : section.content;
    }).join("\n");
  }

  composeBodyHtml(introMarkdown: string, articleBlocks: ArticleBlock[], existingBodyHtml?: string): string {
    const above = this.renderArticleBlocks(articleBlocks, ArticleBlockPosition.ABOVE_EVENTS);
    const intro = this.markdownToHtml(introMarkdown);
    const middle = existingBodyHtml ?? "";
    const below = this.renderArticleBlocks(articleBlocks, ArticleBlockPosition.BELOW_EVENTS);
    return [above, intro, middle, below].filter(part => part).join("\n");
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private escapeAttr(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }
}
