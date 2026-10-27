import expect from "expect";
import { describe, it } from "mocha";
import { JSDOM } from "jsdom";
import { normaliseUnbrandedEmailContent } from "./unbranded-email-layout";
import { RAMBLERS_EMAIL_TOKENS } from "./ramblers-design-tokens";

function normalisedDocument(html: string): Document {
  return new JSDOM(normaliseUnbrandedEmailContent(html)).window.document;
}

describe("unbranded mail application typography", () => {
  it("replaces Outlook fonts, sizes and spacing, including nested spans and legacy font tags", () => {
    const document = normalisedDocument(`<html><head><style>span { font-family: Courier !important; }</style></head><body style="font-family:Times New Roman"><p style="font-family:Times New Roman;font-size:28pt;line-height:90%;color:red"><span style='font-family:Comic Sans MS !important;font-size:9pt'>Hello</span><font face="Courier" size="7" color="blue"> there</font></p></body></html>`);
    expect(document.querySelector("style")).toBe(null);
    document.querySelectorAll<HTMLElement>("p, span, font").forEach(element => {
      expect(element.style.fontFamily).toBe(RAMBLERS_EMAIL_TOKENS.fontFamily);
      expect(element.style.fontSize).toBe(RAMBLERS_EMAIL_TOKENS.bodyFontSize);
      expect(element.style.lineHeight).toBe(RAMBLERS_EMAIL_TOKENS.bodyLineHeight);
      expect(element.style.getPropertyPriority("font-family")).toBe("");
    });
    expect(document.querySelector("font").hasAttribute("face")).toBe(false);
    expect(document.querySelector("font").hasAttribute("size")).toBe(false);
    expect(document.body.textContent).toBe("Hello there");
  });

  it("applies NGX link styling to the anchor and text nested inside it", () => {
    const document = normalisedDocument(`<p><a href="https://group.example.org.uk/walks" style="color:blue;text-decoration:none;font-family:Courier"><span style="color:purple !important;text-decoration:none;font-size:36pt">Walk details</span></a></p>`);
    document.querySelectorAll<HTMLElement>("a, span").forEach(element => {
      expect(element.style.fontFamily).toBe(RAMBLERS_EMAIL_TOKENS.fontFamily);
      expect(element.style.fontSize).toBe(RAMBLERS_EMAIL_TOKENS.bodyFontSize);
      expect(element.style.color).toBe("rgb(192, 87, 17)");
      expect(element.style.textDecoration).toBe("underline");
    });
    expect(document.querySelector("a").getAttribute("href")).toBe("https://group.example.org.uk/walks");
  });

  it("preserves emphasis and heading hierarchy while replacing shorthand font declarations", () => {
    const document = normalisedDocument(`<h2><span style="font-size:8pt">Meeting</span></h2><p><strong>Bold</strong> <em>Italic</em> <u>Underlined</u><span style="font:italic bold 30px Courier;mso-fareast-font-family:serif">Emphasised</span></p><ul><li>First item</li></ul>`);
    expect(document.querySelector<HTMLElement>("h2 span").style.fontSize).toBe(RAMBLERS_EMAIL_TOKENS.h3Size);
    expect(document.querySelector("strong").textContent).toBe("Bold");
    expect(document.querySelector("em").textContent).toBe("Italic");
    expect(document.querySelector("u").textContent).toBe("Underlined");
    expect(document.querySelector("ul li").textContent).toBe("First item");
    const emphasis = document.querySelector<HTMLElement>("p span");
    expect(emphasis.style.fontWeight).toBe("bold");
    expect(emphasis.style.fontStyle).toBe("italic");
    expect(emphasis.style.fontSize).toBe(RAMBLERS_EMAIL_TOKENS.bodyFontSize);
    expect(emphasis.getAttribute("style")).not.toContain("Courier");
    expect(emphasis.getAttribute("style")).not.toContain("mso-");
  });
});
