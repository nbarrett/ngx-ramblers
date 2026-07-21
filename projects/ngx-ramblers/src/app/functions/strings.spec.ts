import { booleanOf, endsWithEllipsis, firstLinkHref, firstLinkText, isQuoted, matchesAllowingTruncation, plainText, toKebabCase, toSlug, unescapeMarkdownLinks, unquote } from "./strings";

describe("strings", () => {

  describe("endsWithEllipsis", () => {
    it("detects a trailing unicode ellipsis or three full stops", () => {
      expect(endsWithEllipsis("Circular walk via Biddenden…")).toBe(true);
      expect(endsWithEllipsis("Circular walk via Biddenden...")).toBe(true);
      expect(endsWithEllipsis("Circular walk via Biddenden")).toBe(false);
      expect(endsWithEllipsis(null as unknown as string)).toBe(false);
    });
  });

  describe("matchesAllowingTruncation", () => {
    it("matches identical text ignoring case and whitespace", () => {
      expect(matchesAllowingTruncation("Challock 9 mile circular", "challock  9 MILE circular")).toBe(true);
    });

    it("matches a value truncated with an ellipsis against the full text", () => {
      expect(matchesAllowingTruncation(
        "Evening Walk: New Luckhurst Wood - an evening…",
        "Evening Walk: New Luckhurst Wood - an evening walk round a new forest-to-be")).toBe(true);
    });

    it("matches a value truncated with three full stops", () => {
      expect(matchesAllowingTruncation("Circular walk via Biddenden, Cranbrook and...", "Circular walk via Biddenden, Cranbrook and Sissinghurst Castle")).toBe(true);
    });

    it("does not match a truncated value from different text", () => {
      expect(matchesAllowingTruncation("Circular walk via Biddenden, Cranbrook and…", "Evening Walk: New Luckhurst Wood")).toBe(false);
    });

    it("does not match different text of the same length", () => {
      expect(matchesAllowingTruncation("Grove Ferry 13 mile circular", "Lympne, Pedlinge and Brockhill")).toBe(false);
    });
  });

  describe("toSlug", () => {
    it("should convert title with spaces to slug", () => {
      expect(toSlug("Hello World")).toBe("hello-world");
    });

    it("should remove special characters like forward slashes", () => {
      expect(toSlug("6 miles/10 km")).toBe("6-miles10-km");
    });

    it("should handle the problematic away day slug", () => {
      expect(toSlug("Away Day Whittlesea Straw Bear Festival 6 miles/10 km Leisurely Booking"))
        .toBe("away-day-whittlesea-straw-bear-festival-6-miles10-km-leisurely-booking");
    });

    it("should preserve already valid slugs", () => {
      expect(toSlug("away-day-whittlesea-straw-bear-festival-6-miles10-km-leisurely-booking"))
        .toBe("away-day-whittlesea-straw-bear-festival-6-miles10-km-leisurely-booking");
    });

    it("should handle empty input", () => {
      expect(toSlug("")).toBe("");
      expect(toSlug(null)).toBe("");
      expect(toSlug(undefined)).toBe("");
    });

    it("should collapse multiple hyphens", () => {
      expect(toSlug("hello--world")).toBe("hello-world");
    });

    it("should collapse multiple spaces", () => {
      expect(toSlug("hello   world")).toBe("hello-world");
    });

    it("should remove parentheses and other punctuation", () => {
      expect(toSlug("Walk (5 miles)")).toBe("walk-5-miles");
    });

    it("should handle mixed case", () => {
      expect(toSlug("UPPER lower MiXeD")).toBe("upper-lower-mixed");
    });

    it("should transliterate accented characters rather than deleting them", () => {
      expect(toSlug("Community Café Walk")).toBe("community-cafe-walk");
    });
  });

  describe("toKebabCase", () => {
    it("should convert strings using es-toolkit kebabCase", () => {
      expect(toKebabCase("Hello World")).toBe("hello-world");
    });

    it("should join multiple strings with hyphens", () => {
      expect(toKebabCase("Hello", "World")).toBe("hello-world");
    });

    it("should handle camelCase input", () => {
      expect(toKebabCase("helloWorld")).toBe("hello-world");
    });

    it("should transliterate accented characters to plain ascii", () => {
      expect(toKebabCase("Community Café Walk")).toBe("community-cafe-walk");
      expect(toKebabCase("Community Cafe\u0301 Walk")).toBe("community-cafe-walk");
      expect(toKebabCase("Señor's Zürich Sørensen walk")).toBe("senors-zurich-sorensen-walk");
    });
  });

  describe("booleanOf", () => {
    it("should return true for truthy string values", () => {
      expect(booleanOf("true")).toBe(true);
      expect(booleanOf("1")).toBe(true);
      expect(booleanOf("yes")).toBe(true);
    });

    it("should return false for falsy string values", () => {
      expect(booleanOf("false")).toBe(false);
      expect(booleanOf("0")).toBe(false);
      expect(booleanOf("no")).toBe(false);
    });

    it("should return boolean values as-is", () => {
      expect(booleanOf(true)).toBe(true);
      expect(booleanOf(false)).toBe(false);
    });

    it("should return fallback for unrecognized values", () => {
      expect(booleanOf("unknown")).toBe(false);
      expect(booleanOf("unknown", true)).toBe(true);
    });
  });

  describe("isQuoted", () => {
    it("detects a fully quoted phrase", () => {
      expect(isQuoted("\"solar array\"")).toBe(true);
      expect(isQuoted("  \"solar array\"  ")).toBe(true);
    });

    it("rejects unquoted or partially quoted input", () => {
      expect(isQuoted("solar array")).toBe(false);
      expect(isQuoted("\"solar array")).toBe(false);
      expect(isQuoted("")).toBe(false);
      expect(isQuoted(null as unknown as string)).toBe(false);
    });
  });

  describe("unquote", () => {
    it("strips surrounding quotes from a quoted phrase", () => {
      expect(unquote("\"solar array\"")).toBe("solar array");
    });

    it("trims but otherwise leaves unquoted input unchanged", () => {
      expect(unquote("  solar array  ")).toBe("solar array");
      expect(unquote(null as unknown as string)).toBe("");
    });
  });

  describe("plainText", () => {
    it("strips html tags and markdown emphasis", () => {
      expect(plainText("<p>Hello **world**</p>")).toBe("Hello world");
    });

    it("removes markdown table pipes and delimiter rows", () => {
      expect(plainText("| Role | Officer | |------|---------| | Chairman | Colin |")).toBe("Role Officer Chairman Colin");
    });

    it("preserves single hyphens and em dashes", () => {
      expect(plainText("Officers 2023-24 - Chairman — Colin")).toBe("Officers 2023-24 - Chairman — Colin");
    });

    it("renders link text without the url and decodes entities", () => {
      expect(plainText("See [the map](https://example.com) &amp; more")).toBe("See the map & more");
    });

    it("handles empty input", () => {
      expect(plainText("")).toBe("");
      expect(plainText(null as unknown as string)).toBe("");
    });
  });

  describe("firstLinkHref", () => {
    it("extracts the target of the first markdown link", () => {
      expect(firstLinkHref("[Guide to the Wealdway](publications/the-wealdway)")).toBe("publications/the-wealdway");
    });

    it("ignores image markdown and link titles", () => {
      expect(firstLinkHref("![cover](cover.jpg) then [text](/page \"title\")")).toBe("/page");
    });

    it("returns null when there is no link", () => {
      expect(firstLinkHref("just some text")).toBe(null);
      expect(firstLinkHref("")).toBe(null);
      expect(firstLinkHref(null as unknown as string)).toBe(null);
    });
  });

  describe("unescapeMarkdownLinks", () => {
    it("unescapes turndown-escaped markdown links", () => {
      expect(unescapeMarkdownLinks("pillaging of the \\[Elham Valley Walks Series - Walk 4\\](https://elhamvalleywalkers.co.uk)!"))
        .toBe("pillaging of the [Elham Valley Walks Series - Walk 4](https://elhamvalleywalkers.co.uk)!");
    });

    it("unescapes multiple links in one value", () => {
      expect(unescapeMarkdownLinks("\\[one\\](/first) and \\[two\\](/second)"))
        .toBe("[one](/first) and [two](/second)");
    });

    it("leaves unescaped links and plain text alone", () => {
      expect(unescapeMarkdownLinks("[already fine](/page) and \\[no url follows\\] here"))
        .toBe("[already fine](/page) and \\[no url follows\\] here");
    });

    it("handles null and non-string values", () => {
      expect(unescapeMarkdownLinks(null as unknown as string)).toBe(null);
      expect(unescapeMarkdownLinks(undefined as unknown as string)).toBe(undefined);
    });
  });

  describe("firstLinkText", () => {
    it("extracts the label of the first markdown link", () => {
      expect(firstLinkText("[Guide to the Wealdway](publications/the-wealdway)")).toBe("Guide to the Wealdway");
    });

    it("ignores image markdown", () => {
      expect(firstLinkText("![cover](cover.jpg) [Read more](/page)")).toBe("Read more");
    });

    it("returns null when there is no link", () => {
      expect(firstLinkText("plain text")).toBe(null);
      expect(firstLinkText(null as unknown as string)).toBe(null);
    });
  });
});
