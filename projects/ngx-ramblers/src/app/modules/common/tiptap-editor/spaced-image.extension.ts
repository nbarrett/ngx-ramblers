import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";

export enum ImageSpacing {
  None = "none",
  Small = "sm",
  Medium = "md",
  Large = "lg"
}

export enum ImageAlign {
  Left = "left",
  Center = "center",
  Right = "right"
}

export const IMAGE_SPACING_PX: Record<ImageSpacing, number> = {
  [ImageSpacing.None]: 0,
  [ImageSpacing.Small]: 12,
  [ImageSpacing.Medium]: 24,
  [ImageSpacing.Large]: 40
};

function verticalMarginPx(style: string): number | null {
  const explicit = (style || "").match(/margin-top:\s*(\d+)px/i) || (style || "").match(/margin-bottom:\s*(\d+)px/i);
  if (explicit) {
    return parseInt(explicit[1], 10);
  }
  const shorthand = (style || "").match(/margin:\s*(\d+)px/i);
  return shorthand ? parseInt(shorthand[1], 10) : null;
}

function spacingFromStyle(style: string): ImageSpacing {
  const px = verticalMarginPx(style);
  if (px == null) {
    return ImageSpacing.Small;
  }
  if (px === 0) {
    return ImageSpacing.None;
  }
  if (px <= 12) {
    return ImageSpacing.Small;
  }
  if (px <= 24) {
    return ImageSpacing.Medium;
  }
  return ImageSpacing.Large;
}

function widthFromStyle(style: string): number | null {
  const match = (style || "").match(/width:\s*(\d+)px/i);
  return match ? parseInt(match[1], 10) : null;
}

function alignFromStyle(style: string): ImageAlign {
  const marginLeftAuto = /margin-left:\s*auto/i.test(style || "") || /margin:\s*\d+px\s+auto/i.test(style || "");
  const marginRightAuto = /margin-right:\s*auto/i.test(style || "") || /margin:\s*\d+px\s+auto/i.test(style || "");
  if (marginLeftAuto && marginRightAuto) {
    return ImageAlign.Center;
  }
  if (marginLeftAuto) {
    return ImageAlign.Right;
  }
  if (marginRightAuto) {
    return ImageAlign.Left;
  }
  return ImageAlign.Center;
}

export function imageStyle(spacing: ImageSpacing, width: number | null, align: ImageAlign): string {
  const hasCustomSpacing = spacing && spacing !== ImageSpacing.Small;
  const hasExplicitAlign = align === ImageAlign.Left || align === ImageAlign.Right;
  const verticalPx = hasCustomSpacing ? IMAGE_SPACING_PX[spacing] : 12;
  if (!width && !hasCustomSpacing && !hasExplicitAlign) {
    return "";
  }
  const parts = ["display:block", `margin-top:${verticalPx}px`, `margin-bottom:${verticalPx}px`];
  if (width) {
    parts.push(`width:${width}px`);
  }
  if (align === ImageAlign.Left) {
    parts.push("margin-right:auto");
  } else if (align === ImageAlign.Right) {
    parts.push("margin-left:auto");
  } else if (width) {
    parts.push("margin-left:auto", "margin-right:auto");
  }
  return parts.join(";");
}

export const SpacedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      spacing: {
        default: ImageSpacing.Small,
        parseHTML: element => spacingFromStyle(element.getAttribute("style") || ""),
        renderHTML: () => ({})
      },
      width: {
        default: null,
        parseHTML: element => widthFromStyle(element.getAttribute("style") || ""),
        renderHTML: () => ({})
      },
      align: {
        default: ImageAlign.Center,
        parseHTML: element => alignFromStyle(element.getAttribute("style") || ""),
        renderHTML: () => ({})
      }
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const style = imageStyle(node.attrs["spacing"], node.attrs["width"], node.attrs["align"]);
    const attributes = mergeAttributes(this.options["HTMLAttributes"], HTMLAttributes);
    if (style) {
      attributes["style"] = style;
    }
    if (node.attrs["width"]) {
      attributes["data-sized"] = "true";
    }
    return ["img", attributes];
  },
  renderMarkdown(node: { attrs?: Record<string, string | number> }) {
    const src = node.attrs?.["src"] ?? "";
    const alt = node.attrs?.["alt"] ?? "";
    const style = imageStyle(node.attrs?.["spacing"] as ImageSpacing, (node.attrs?.["width"] as number) ?? null, node.attrs?.["align"] as ImageAlign);
    if (!style) {
      return `![${alt}](${src})`;
    }
    return `<img src="${src}" alt="${alt}" style="${style}">`;
  }
});
