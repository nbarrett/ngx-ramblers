import expect from "expect";
import { describe, it } from "mocha";
import {
  collapseBlankLines,
  dropDataUriImages,
  joinWrappedLines,
  mergeAdjacentEmphasis,
  boldLabelLines,
  pdfTextToMarkdown,
  postProcessConvertedMarkdown,
  promoteMinutesHeadings,
  promotePdfLeadingTitle,
  promoteLeadingBoldLineToHeading,
  promotePdfSectionHeadings,
  promoteSectionBoldLinesToHeadings,
  rejoinBoldAcrossLineBreaks,
  splitAdjacentBoldRunLines,
  stripBoilerplate,
  stripRepeatedPageFurniture,
  suggestedTitleFrom
} from "./markdown-post-processing";

describe("dropDataUriImages", () => {
  it("removes embedded data-uri images", () => {
    expect(dropDataUriImages("before ![](data:image/png;base64,iVBORw0KGgo=) after")).toEqual("before  after");
  });

  it("retains normal images", () => {
    expect(dropDataUriImages("![logo](https://example.com/logo.png)")).toEqual("![logo](https://example.com/logo.png)");
  });
});

describe("mergeAdjacentEmphasis", () => {
  it("merges fragmented adjacent bold runs", () => {
    expect(mergeAdjacentEmphasis("**Membership &** **Social Media stats**")).toEqual("**Membership & Social Media stats**");
  });

  it("merges three fragmented runs", () => {
    expect(mergeAdjacentEmphasis("**a** **b** **c**")).toEqual("**a b c**");
  });

  it("removes empty bold runs", () => {
    expect(mergeAdjacentEmphasis("**** **Chairman Introduction — Chris**")).toEqual("**Chairman Introduction — Chris**");
  });

  it("removes empty bold runs on their own line", () => {
    expect(mergeAdjacentEmphasis("****\n**Walks Co-ordinator — Alex**")).toEqual("\n**Walks Co-ordinator — Alex**");
  });

  it("leaves separated bold runs alone", () => {
    expect(mergeAdjacentEmphasis("**Date:** Wednesday **Location:** Zoom")).toEqual("**Date:** Wednesday **Location:** Zoom");
  });

  it("does not merge bold runs across paragraph breaks", () => {
    expect(mergeAdjacentEmphasis("**first**\n\n**second**")).toEqual("**first**\n\n**second**");
  });
});

describe("splitAdjacentBoldRunLines", () => {
  it("splits a line of adjacent bold headings onto separate lines", () => {
    expect(splitAdjacentBoldRunLines("**Chairman Highlights – Chris** **Treasurer – Sam**")).toEqual("**Chairman Highlights – Chris**\n\n**Treasurer – Sam**");
  });

  it("leaves lines with bold and plain text alone", () => {
    expect(splitAdjacentBoldRunLines("**bold lead.** Plain follow-up text.")).toEqual("**bold lead.** Plain follow-up text.");
  });
});

describe("rejoinBoldAcrossLineBreaks", () => {
  it("closes a bold run whose delimiter fell onto the next line", () => {
    expect(rejoinBoldAcrossLineBreaks("**Apologies for absence\n**")).toEqual("**Apologies for absence**");
  });

  it("leaves well-formed bold alone", () => {
    expect(rejoinBoldAcrossLineBreaks("**Treasurer — Sam**")).toEqual("**Treasurer — Sam**");
  });
});

describe("promoteSectionBoldLinesToHeadings", () => {
  it("promotes lone bold paragraphs to section headings", () => {
    expect(promoteSectionBoldLinesToHeadings("**Treasurer — Sam**")).toEqual("## Treasurer — Sam");
  });

  it("leaves bold label lines with colons alone", () => {
    expect(promoteSectionBoldLinesToHeadings("**Date: Monday 24th Nov 2025, 7:00 pm**")).toEqual("**Date: Monday 24th Nov 2025, 7:00 pm**");
  });

  it("leaves long bold paragraphs alone", () => {
    const longLine = `**${"very long bold paragraph content ".repeat(4)}**`;
    expect(promoteSectionBoldLinesToHeadings(longLine)).toEqual(longLine);
  });

  it("leaves lines with mixed bold and plain text alone", () => {
    expect(promoteSectionBoldLinesToHeadings("**bold start** then plain text")).toEqual("**bold start** then plain text");
  });
});

describe("promoteLeadingBoldLineToHeading", () => {
  it("promotes a leading lone bold paragraph to a heading", () => {
    expect(promoteLeadingBoldLineToHeading("**February 2026 Committee Meeting Agenda**\n\nbody")).toEqual("# February 2026 Committee Meeting Agenda\n\nbody");
  });

  it("leaves documents starting with body text alone", () => {
    expect(promoteLeadingBoldLineToHeading("plain opening line\n\n**bold later**")).toEqual("plain opening line\n\n**bold later**");
  });

  it("leaves existing headings alone", () => {
    expect(promoteLeadingBoldLineToHeading("# Already a heading\n\nbody")).toEqual("# Already a heading\n\nbody");
  });
});

describe("stripBoilerplate", () => {
  it("drops charity registration lines including scrambled text-box extractions", () => {
    const input = "agenda item\nTheno SC039799) Ramblers' and Association a company is a limited\nnext item";
    expect(stripBoilerplate(input)).toEqual("agenda item\nnext item");
  });

  it("drops contact lines with pipes and domains", () => {
    const input = "body\nAnytown Walking Group | enquiries@anytown-walkers.org.uk | anytown-walkers.org.uk\n| anytown-walkers.org.uk\nmore body";
    expect(stripBoilerplate(input)).toEqual("body\nmore body");
  });

  it("drops page markers", () => {
    expect(stripBoilerplate("content\n-- 1 of 2 --\nmore")).toEqual("content\nmore");
  });

  it("retains markdown tables", () => {
    const input = "| Item | Owner |\n| --- | --- |\n| Treasurer report | Sam |";
    expect(stripBoilerplate(input)).toEqual(input);
  });
});

describe("suggestedTitleFrom", () => {
  it("uses the first heading when present", () => {
    expect(suggestedTitleFrom("intro\n# February 2026 Agenda\nbody")).toEqual("February 2026 Agenda");
  });

  it("falls back to the first non-empty line with emphasis stripped", () => {
    expect(suggestedTitleFrom("\n**February 2026 Committee Meeting**\nbody")).toEqual("February 2026 Committee Meeting");
  });
});

describe("postProcessConvertedMarkdown", () => {
  it("applies the full pipeline, keeping title and subtitle on separate lines", () => {
    const input = "**February 2026 Committee Meeting** **Agenda**\n\n\n\n![](data:image/png;base64,AAAA)\n\n1. Review minutes\n\nRamblers Charity England & Wales No: 1093577 Scotland No: SC039799";
    const result = postProcessConvertedMarkdown(input);
    expect(result.markdown).toEqual("# February 2026 Committee Meeting\n\n## Agenda\n\n1. Review minutes");
    expect(result.suggestedTitle).toEqual("February 2026 Committee Meeting");
  });

  it("keeps adjacent bold headings as separate section headings", () => {
    const input = "intro line.\n\n**Chairman Highlights – Nick Barrett** **Treasurer – Jon Inglett**\n\nReceipts = £60.";
    const result = postProcessConvertedMarkdown(input);
    expect(result.markdown).toEqual("intro line.\n\n## Chairman Highlights – Nick Barrett\n\n## Treasurer – Jon Inglett\n\nReceipts = £60.");
  });

  it("handles empty input", () => {
    const result = postProcessConvertedMarkdown("");
    expect(result.markdown).toEqual("");
    expect(result.suggestedTitle).toEqual("");
  });
});

describe("collapseBlankLines", () => {
  it("collapses three or more newlines to a paragraph break", () => {
    expect(collapseBlankLines("a\n\n\n\nb")).toEqual("a\n\nb");
  });
});

describe("stripRepeatedPageFurniture", () => {
  it("drops short lines repeated on most pages such as per-page headers", () => {
    const input = "Anytown Walking Group\nAttendees\nbody text one.\nAnytown Walking Group\nbody text two.\nAnytown Walking Group\nbody text three.";
    expect(stripRepeatedPageFurniture(input, 3)).toEqual("Attendees\nbody text one.\nbody text two.\nbody text three.");
  });

  it("keeps lines repeated fewer times than the page threshold", () => {
    const input = "Any Other Business\nbody.\nAny Other Business\nmore body.";
    expect(stripRepeatedPageFurniture(input, 7)).toEqual(input);
  });

  it("leaves single page documents untouched", () => {
    expect(stripRepeatedPageFurniture("Heading\nHeading\nHeading", 1)).toEqual("Heading\nHeading\nHeading");
  });

  it("never drops repeated sentences ending with punctuation", () => {
    const input = "None raised.\nbody.\nNone raised.\nNone raised.";
    expect(stripRepeatedPageFurniture(input, 3)).toEqual(input);
  });
});

describe("joinWrappedLines", () => {
  it("rejoins a sentence wrapped across visual lines into one paragraph", () => {
    const input = "It was noted that the group has taken on the suggestion of offering to change walk\ndays if that helps walk leaders.";
    expect(joinWrappedLines(input)).toEqual("It was noted that the group has taken on the suggestion of offering to change walk days if that helps walk leaders.");
  });

  it("keeps heading-like lines as separate paragraphs", () => {
    const input = "Treasurer — Sam\nWe have £321.03 in the bank.";
    expect(joinWrappedLines(input)).toEqual("Treasurer — Sam\n\nWe have £321.03 in the bank.");
  });

  it("joins a wrapped line starting with a currency amount", () => {
    const input = "We have money in the bank and\n£65.50 came from Ramblers.";
    expect(joinWrappedLines(input)).toEqual("We have money in the bank and £65.50 came from Ramblers.");
  });

  it("converts unicode bullets to markdown list items and keeps them separate", () => {
    const input = "Upcoming events\n• Mar 5 - Fire Walk at Aylesford\n• Apr 2 - Quiz Night";
    expect(joinWrappedLines(input)).toEqual("Upcoming events\n\n- Mar 5 - Fire Walk at Aylesford\n\n- Apr 2 - Quiz Night");
  });

  it("rejoins a wrapped continuation onto a list item", () => {
    const input = "- Images can be imported from Walks Manager if they are on Ramblers but not local site (Peter Dixon\nwalk for example)";
    expect(joinWrappedLines(input)).toEqual("- Images can be imported from Walks Manager if they are on Ramblers but not local site (Peter Dixon walk for example)");
  });

  it("does not join numbered agenda lines together", () => {
    const input = "1. Review minutes\n2. Treasurer report";
    expect(joinWrappedLines(input)).toEqual("1. Review minutes\n\n2. Treasurer report");
  });

  it("normalises tabs and repeated spaces", () => {
    expect(joinWrappedLines("Date: \tThursday 19th Feb 2026, 7:00 pm")).toEqual("Date: Thursday 19th Feb 2026, 7:00 pm");
  });
});

describe("promotePdfSectionHeadings", () => {
  it("promotes short section-and-owner lines with a dash to headings", () => {
    expect(promotePdfSectionHeadings("Treasurer — Sam Smith")).toEqual("## Treasurer — Sam Smith");
    expect(promotePdfSectionHeadings("Previous Actions — All")).toEqual("## Previous Actions — All");
  });

  it("leaves sentences containing dashes alone", () => {
    expect(promotePdfSectionHeadings("Receipts were £60 plus £50 — thanks to all who helped.")).toEqual("Receipts were £60 plus £50 — thanks to all who helped.");
  });

  it("leaves stat lines ending with brackets alone", () => {
    expect(promotePdfSectionHeadings("Facebook – 1067 followers (1053 at the last meeting)")).toEqual("Facebook – 1067 followers (1053 at the last meeting)");
  });

  it("leaves list items alone", () => {
    expect(promotePdfSectionHeadings("- Jan 3 – Booster shot Mexican & Panto")).toEqual("- Jan 3 – Booster shot Mexican & Panto");
  });
});

describe("boldLabelLines", () => {
  it("bolds short label lines such as Date and Location", () => {
    expect(boldLabelLines("Date: Thursday 29th May 2025, 7:30 pm")).toEqual("**Date:** Thursday 29th May 2025, 7:30 pm");
    expect(boldLabelLines("Zoom Link: https://zoom.us/j/123")).toEqual("**Zoom Link:** https://zoom.us/j/123");
  });

  it("leaves sentences containing colons later in the line alone", () => {
    expect(boldLabelLines("The agreed outcome of the meeting was that everyone: agreed")).toEqual("The agreed outcome of the meeting was that everyone: agreed");
  });
});

describe("promoteMinutesHeadings", () => {
  it("promotes well-known minutes section names to headings", () => {
    expect(promoteMinutesHeadings("Attendees")).toEqual("## Attendees");
    expect(promoteMinutesHeadings("Apologies for absence")).toEqual("## Apologies for absence");
    expect(promoteMinutesHeadings("Previous Actions — All")).toEqual("## Previous Actions — All");
    expect(promoteMinutesHeadings("Next Meeting 21st May 19:00")).toEqual("## Next Meeting 21st May 19:00");
  });

  it("leaves sentences mentioning those words alone", () => {
    expect(promoteMinutesHeadings("The attendees all agreed the next steps in the meeting.")).toEqual("The attendees all agreed the next steps in the meeting.");
  });
});

describe("promotePdfLeadingTitle", () => {
  it("promotes a short leading line to the document title", () => {
    expect(promotePdfLeadingTitle("May 29th 2025 Committee Meeting\n\n## Draft Minutes")).toEqual("# May 29th 2025 Committee Meeting\n\n## Draft Minutes");
  });

  it("leaves long opening paragraphs alone", () => {
    const paragraph = "This opening paragraph is far too long to be a document title because it just keeps going and going.";
    expect(promotePdfLeadingTitle(paragraph)).toEqual(paragraph);
  });
});

describe("joinWrappedLines heading interaction", () => {
  it("never joins a heading into a preceding unpunctuated line", () => {
    const input = "Nick Barrett, Tim Weston, Andrew Goh, Kerry O Grady, Jon Inglett\n## Apologies for absence";
    expect(joinWrappedLines(input)).toEqual("Nick Barrett, Tim Weston, Andrew Goh, Kerry O Grady, Jon Inglett\n\n## Apologies for absence");
  });

  it("joins a wrapped continuation starting with a capitalised name onto a long line", () => {
    const input = "It was agreed that a voucher should be provided to the new walk leaders despite\nDeborah being an old group member.";
    expect(joinWrappedLines(input)).toEqual("It was agreed that a voucher should be provided to the new walk leaders despite Deborah being an old group member.");
  });

  it("keeps short complete lines separate from following capitalised lines", () => {
    expect(joinWrappedLines("Closing balance = £419.05\nNB, JI and KOG can authorise expenses.")).toEqual("Closing balance = £419.05\n\nNB, JI and KOG can authorise expenses.");
  });
});

describe("link preservation through the pipeline", () => {
  it("passes markdown links through the full post-processing pipeline unchanged", () => {
    const input = "intro line.\n\nSee [Customising Email Wording](https://example.org/how-to/customising-email-wording) for details.";
    expect(postProcessConvertedMarkdown(input).markdown).toContain("[Customising Email Wording](https://example.org/how-to/customising-email-wording)");
  });

  it("keeps a markdown link inside a bold lead-in intact", () => {
    const input = "**Zoom Link:** [Join the meeting](https://us06web.zoom.us/j/3706479967)\n\nbody.";
    expect(postProcessConvertedMarkdown(input).markdown).toContain("**Zoom Link:** [Join the meeting](https://us06web.zoom.us/j/3706479967)");
  });

  it("keeps bare URLs intact when joining wrapped PDF lines", () => {
    const input = "Onboarding https://www.northwestkent.ngx-ramblers.org.uk/\nAutomated facility to migrate sites.";
    expect(pdfTextToMarkdown(input, 1)).toContain("https://www.northwestkent.ngx-ramblers.org.uk/");
  });
});

describe("pdfTextToMarkdown", () => {
  it("strips page furniture then joins wrapped lines", () => {
    const input = "Anytown Walking Group\nFebruary 2026 Committee\nDraft Minutes\nBody line one that wraps onto\nanother line.\nAnytown Walking Group\nMore content here.\nAnytown Walking Group\nFinal words.";
    expect(pdfTextToMarkdown(input, 3)).toEqual("February 2026 Committee\n\n## Draft Minutes\n\nBody line one that wraps onto another line.\n\nMore content here.\n\nFinal words.");
  });
});
