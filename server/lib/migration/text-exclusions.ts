import { ExclusionsConfig } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { isArray } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("text-exclusions"));

export function coerceList(value: string[] | string | undefined): string[] {
  if (!value) return []
  if (isArray(value)) return value.filter(Boolean)
  return String(value).split(/\r?\n|,|;/).map(s => s.trim()).filter(Boolean)
}

export function coerceBlocks(value: string | string[] | undefined): string[] {
  if (!value) return []
  if (isArray(value)) return value.filter(Boolean)
  const normalized = String(value).replace(/\r\n/g, "\n")
  return normalized.split(/\n\s*-{3,}\s*\n/).map(s => s.trim()).filter(Boolean)
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function removeTextPatterns(input: string, patterns: string[]): string {
  let out = input
  for (const pattern of patterns) {
    try {
      const re = new RegExp(pattern, "gim")
      out = out.replace(re, "")
    } catch (error) {
      debugLog("removeTextPatterns failed", pattern, error);
    }
  }
  return out
}

export function removeBlockExact(input: string, block: string): string {
  return input.split(block).join("")
}

export function removeBlockWhitespaceTolerant(input: string, block: string): string {
  const escaped = escapeRegExp(block)
    .replace(/\s+/g, "\\s+")
    .replace(/\\\([^)]*\\\)/g, "\\(.*?\\)")
  try {
    return input.replace(new RegExp(escaped, "gim"), "")
  } catch (error) {
    debugLog("removeBlockWhitespaceTolerant failed", block, error);
    return input
  }
}

export function removeBlockLines(input: string, block: string): string {
  let out = input
  block.split(/\n/).map(s => s.trim()).filter(Boolean).forEach(line => {
    const textEsc = escapeRegExp(line).replace(/\s+/g, "\\s+");
    const tolerantText = textEsc.replace(/\\\([^)]*\\\)/g, "\\(.*?\\)");
    const lineAnchored = `^\\s*${tolerantText}\\s*$`;
    const linkWrapped = `^\\s*\\[${textEsc}\\]\\([^)]*\\)\\s*$`;
    try {
      out = out.replace(new RegExp(lineAnchored, "gim"), "");
    } catch (error) {
      debugLog("removeBlockLines failed", line, error);
    }
    try {
      out = out.replace(new RegExp(linkWrapped, "gim"), "");
    } catch (error) {
      debugLog("removeBlockLines link failed", line, error);
    }
  })
  return out
}

export function removeBlockFlexibleSequence(input: string, block: string): string {
  const parts = block.split(/\n/).map(s => s.trim()).filter(Boolean)
  if (parts.length <= 1) return input
  const flexSeq = parts
    .map(p => escapeRegExp(p)
      .replace(/\s+/g, "\\s+")
      .replace(/\\\([^)]*\\\)/g, "\\(.*?\\)"))
    .join("(?:\\s*\\n\\s*)+")
  try {
    return input.replace(new RegExp(flexSeq, "gim"), "")
  } catch (error) {
    debugLog("removeBlockFlexibleSequence failed", block, error);
    return input
  }
}

export function removeMarkdownBlocks(input: string, blocks: string[]): string {
  let out = input
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    out = removeBlockExact(out, trimmed)
    out = removeBlockWhitespaceTolerant(out, trimmed)
    out = removeBlockLines(out, trimmed)
    out = removeBlockFlexibleSequence(out, trimmed)
  }
  return out
}

export function removeExcludedImages(input: string, exImages: string[]): string {
  let out = input
  for (const img of exImages) {
    const esc = escapeRegExp(img)
    try {
      const innerImage = `!\\[[^\\]]*\\]\\((?:${esc}|[^)]*${esc}[^)]*)\\)`
      const linkWrapped = `\\[\\s*${innerImage}\\s*\\]\\([^)]*\\)`
      out = out.replace(new RegExp(linkWrapped, "gim"), "")
      out = out.replace(new RegExp(innerImage, "gim"), "")
    } catch (error) {
      debugLog("removeExcludedImages failed", img, error);
    }
  }
  return out
}

export function collapseExcessBlankLines(input: string): string {
  return input.replace(/\n{3,}/g, "\n\n")
}

export function applyTextExclusions(text: string, cfg: ExclusionsConfig): string {
  const builtIns = [String.raw`^\s*\[Path\s+Problems\]\([^)]*\)\s*$`]
  const patterns = [...coerceList(cfg.excludeTextPatterns), ...builtIns]
  let out = removeTextPatterns(text, patterns)
  out = removeHtmlComments(out)
  out = removeHtmlTagBlocks(out, ["script", "style", "noscript"])
  out = unwrapPresentationalTags(out, ["font", "center", "big", "small", "u", "s", "strike", "tt", "acronym"])
  out = removeMarkdownBlocks(out, coerceBlocks(cfg.excludeMarkdownBlocks))
  out = removeExcludedImages(out, coerceList(cfg.excludeImageUrls))
  out = removeHtmlAttributes(out, ["class", "id", "style", "align", "border", "valign", "bgcolor", "cellpadding", "cellspacing", "hspace", "vspace", "frame", "rules", "width", "height"])
  out = removeEventHandlerAttributes(out)
  out = removeAttributeLists(out)
  out = removeInlineCssRules(out)
  out = collapseExcessBlankLines(out)
  debugLog("applyTextExclusions:text:", text, "cfg:", cfg, "out:", out);
  return out
}

export function firstSentenceFrom(markdown: string): string {
  let s = cleanMarkdown(markdown).trim()
  s = s.replace(/^#+\s+/gm, "")
  s = s.replace(/^[-_=]{3,}\s*$/gm, "")
  s = s.replace(/!\[[^\]]*]\([^)]+\)/g, "");
  s = s.replace(/\[[^\]]+]\([^)]+\)/g, "");
  const lines = s.split(/\n+/).map(x => x.trim()).filter(Boolean)
  let text = ""
  for (const line of lines) {
    const numericCount = line.replace(/[^a-zA-Z0-9]/g, "").length
    const looksLikeHeading = !/[.!?]/.test(line) && numericCount < 25
    const isEmphasisOnly = /^\*\*[\s\S]*\*\*$/.test(line)
    if (looksLikeHeading || isEmphasisOnly) continue;
    text = text ? `${text} ${line}` : line
    if (/[.!?]/.test(line) && numericCount > 20) break
  }
  text = text.replace(/\s+/g, " ").trim()
  const m = text.match(/[^.!?]+[.!?]/)
  return (m ? m[0] : text).trim()
}

export function cleanMarkdown(text: string): string {
  return text
    .replace(/\\\[/g, "[")
    .replace(/\\]/g, "]")
    .replace(/\\n/g, "\n")
    .replace(/\u00a0/g, " ")
}

export function removeHtmlAttributes(input: string, attributes: string[]): string {
  let out = input
  for (const attr of attributes) {
    const re = new RegExp(`\\s${attr}\\s*=\\s*("[^"]*"|'[^']*'|[^\s>]+)`, "gim")
    out = out.replace(re, "")
  }
  return out
}

export function removeInlineCssRules(input: string): string {
  const cssRule = /(^|\s)(?:[.#][a-zA-Z0-9_-]+|body|h[1-6]|p|div|span)\s*\{[^}]*\}/gms
  const stabilize = (current: string): string => {
    const next = current.replace(cssRule, " ")
    return next === current ? current : stabilize(next)
  }
  return stabilize(input)
}

export function removeAttributeLists(input: string): string {
  return input.replace(/\{([^}]*)\}/g, (m, inner) => {
    const s = String(inner)
    const hasMarkers = /(^|\s)(#[A-Za-z0-9_-]+|\.[A-Za-z0-9_-]+)\b/.test(s) || /(\bid\s*=|\bclass\s*=|\bstyle\s*=)/i.test(s)
    return hasMarkers ? "" : m
  })
}

export function removeEventHandlerAttributes(input: string): string {
  return input.replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gim, "")
}

export function removeHtmlComments(input: string): string {
  return input.replace(/<!--[\s\S]*?-->/g, "")
}

export function removeHtmlTagBlocks(input: string, tags: string[]): string {
  let out = input
  for (const tag of tags) {
    try {
      const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gim")
      out = out.replace(re, "")
    } catch (error) {
      debugLog("removeHtmlTagBlocks failed", tag, error)
    }
  }
  return out
}

export function unwrapPresentationalTags(input: string, tags: string[]): string {
  let out = input
  for (const tag of tags) {
    try {
      const re = new RegExp(`</?${tag}[^>]*>`, "gim")
      out = out.replace(re, "")
    } catch (error) {
      debugLog("unwrapPresentationalTags failed", tag, error)
    }
  }
  return out
}
