import expect from "expect";
import { describe, it } from "mocha";
import { escapeSlugForRegex, identifierCanBeConvertedToSlug, identifierMatchesSlugFormat, slugRegexFor } from "./extended-group-event";

const slugFormatCases: { value: string; isSlug: boolean; convertible: boolean; description: string }[] = [
  {value: "aldington", isSlug: true, convertible: true, description: "simple lowercase word"},
  {value: "aldington-walk", isSlug: true, convertible: true, description: "kebab-case slug"},
  {value: "aldington2023", isSlug: true, convertible: true, description: "letters and digits"},
  {value: "ramblers-long-weekend-1", isSlug: true, convertible: true, description: "multi-word slug with number suffix"},
  {value: "507f1f77bcf86cd799439011", isSlug: false, convertible: false, description: "mongo object id lowercase"},
  {value: "507F1F77BCF86CD799439011", isSlug: false, convertible: false, description: "mongo object id uppercase"},
  {value: "123456789", isSlug: false, convertible: false, description: "numeric identifier"},
  {value: "123456789012345678901234", isSlug: false, convertible: false, description: "long numeric identifier"},
  {value: "Aldington Sunday Walk", isSlug: false, convertible: true, description: "title with spaces and uppercase"},
  {value: "Walk Title 2023", isSlug: false, convertible: true, description: "title with space and digits"},
  {value: "Walk_Title", isSlug: false, convertible: true, description: "contains underscore"},
  {value: " ramblers-event ", isSlug: true, convertible: true, description: "slug with whitespace padding"},
  {value: "Aldington (Sunday) Walk", isSlug: false, convertible: true, description: "title with parentheses"},
  {value: "Aldington – Picnic & Walk?", isSlug: false, convertible: true, description: "title with dash and punctuation"},
  {value: "Aldington {Trail}", isSlug: false, convertible: true, description: "title with braces"},
  {value: "Aldington [Loop] Walk", isSlug: false, convertible: true, description: "title with square brackets"}
];

describe("identifierMatchesSlugFormat", () => {
  slugFormatCases.forEach(testCase => {
    it(`returns ${testCase.isSlug} for ${testCase.description}`, () => {
      expect(identifierMatchesSlugFormat(testCase.value)).toBe(testCase.isSlug);
    });
  });
});

describe("identifierCanBeConvertedToSlug", () => {
  slugFormatCases.forEach(testCase => {
    it(`returns ${testCase.convertible} for ${testCase.description}`, () => {
      expect(identifierCanBeConvertedToSlug(testCase.value)).toBe(testCase.convertible);
    });
  });
});

describe("escapeSlugForRegex", () => {
  const cases: { value: string; escaped: string; description: string }[] = [
    {value: "walk+event", escaped: "walk\\+event", description: "plus character"},
    {value: "walk.event", escaped: "walk\\.event", description: "dot character"},
    {value: "walk(event)", escaped: "walk\\(event\\)", description: "parentheses"},
    {value: "walk?event", escaped: "walk\\?event", description: "question mark"},
    {value: "walk*event", escaped: "walk\\*event", description: "asterisk"},
    {value: "walk|event", escaped: "walk\\|event", description: "pipe"},
    {value: "walk[event]", escaped: "walk\\[event\\]", description: "square brackets"},
    {value: "walk^event$", escaped: "walk\\^event\\$", description: "anchors"},
    {value: "walk\\event", escaped: "walk\\\\event", description: "backslash"},
    {value: "", escaped: "", description: "empty string"},
    {value: "aldington", escaped: "aldington", description: "simple lowercase word input"},
    {value: "aldington-walk", escaped: "aldington-walk", description: "kebab-case slug input"},
    {value: "aldington2023", escaped: "aldington2023", description: "letters and digits input"},
    {value: "ramblers-long-weekend-1", escaped: "ramblers-long-weekend-1", description: "multi-word slug with number suffix input"},
    {value: "507f1f77bcf86cd799439011", escaped: "507f1f77bcf86cd799439011", description: "mongo object id lowercase input"},
    {value: "507F1F77BCF86CD799439011", escaped: "507F1F77BCF86CD799439011", description: "mongo object id uppercase input"},
    {value: "123456789", escaped: "123456789", description: "numeric identifier input"},
    {value: "123456789012345678901234", escaped: "123456789012345678901234", description: "long numeric identifier input"},
    {value: "Aldington Sunday Walk", escaped: "Aldington Sunday Walk", description: "title with spaces and uppercase input"},
    {value: "Walk Title 2023", escaped: "Walk Title 2023", description: "title with space and digits input"},
    {value: "Walk_Title", escaped: "Walk_Title", description: "contains underscore input"},
    {value: " ramblers-event ", escaped: " ramblers-event ", description: "slug with whitespace padding input"},
    {value: "Aldington (Sunday) Walk", escaped: "Aldington \\(Sunday\\) Walk", description: "title with parentheses input"},
    {value: "Aldington – Picnic & Walk?", escaped: "Aldington – Picnic & Walk\\?", description: "title with dash and punctuation input"},
    {value: "Aldington {Trail}", escaped: "Aldington \\{Trail\\}", description: "title with braces input"},
    {value: "Aldington [Loop] Walk", escaped: "Aldington \\[Loop\\] Walk", description: "title with square brackets input"}
  ];

  cases.forEach(testCase => {
    it(`escapes ${testCase.description}`, () => {
      expect(escapeSlugForRegex(testCase.value)).toBe(testCase.escaped);
    });
  });
});

describe("slugRegexFor", () => {
  it("matches plain slug values", () => {
    const regex = slugRegexFor("bromley-green-walk-4");
    expect(regex.test("bromley-green-walk-4")).toBe(true);
  });

  it("matches URLs ending with the slug", () => {
    const regex = slugRegexFor("bromley-green-walk-4");
    expect(regex.test("https://www.ramblers.org.uk/go-walking/group-walks/bromley-green-walk-4")).toBe(true);
  });

  it("does not match other slugs", () => {
    const regex = slugRegexFor("bromley-green-walk-4");
    expect(regex.test("https://www.ramblers.org.uk/go-walking/group-walks/other-walk")).toBe(false);
  });
});
