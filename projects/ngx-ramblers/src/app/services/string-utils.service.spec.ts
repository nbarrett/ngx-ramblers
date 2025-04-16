import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";

import { StringUtilsService } from "./string-utils.service";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

const memberService = {
  allLimitedFields: () => Promise.resolve({email: "test@example.com"}),
  filterFor: {GROUP_MEMBERS: ""}
};

describe("StringUtilsService", () => {
  let service: StringUtilsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [LoggerTestingModule, RouterTestingModule],
    providers: [
        MemberIdToFullNamePipe,
        FullNamePipe,
        FullNameWithAliasPipe,
        { provide: "MemberService", useValue: memberService },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
    ]
});
    service = TestBed.inject(StringUtilsService);
  });

  describe("left", () => {
    it("should return the left X characters of a string", () => {
      expect(service.left("Hello Mum", 5)).toBe("Hello");
      expect(service.left("the quick brown fox", 10)).toBe("the quick ");
      expect(service.left("short", 10)).toBe("short");
      expect(service.left("", 5)).toBe("");
    });
  });

  describe("right", () => {
    it("should return the right X characters of a string", () => {
      expect(service.right("Hello Mum", 3)).toBe("Mum");
      expect(service.right("the quick brown fox", 9)).toBe("brown fox");
      expect(service.right("short", 10)).toBe("short");
      expect(service.right("", 5)).toBe("");
    });
  });

  describe("stringifyObject", () => {
    it("should return an object with humanised key, values", () => {
      expect(service.stringifyObject({
          hostname: "api.meetup.com",
          protocol: "https:"
        }
      )).toBe("Hostname: api.meetup.com, Protocol: https:");
    });
    it("should not distinguish between undefined, empty and null", () => {
      expect(service.stringifyObject({value: undefined})).toBe("Value: (none)");
      expect(service.stringifyObject({value: null})).toBe("Value: (none)");
      expect(service.stringifyObject({value: ""})).toBe("Value: (none)");
      expect(service.stringifyObject("")).toBe("(none)");
    });
    it("should allow a default value to be supplied for non-present values", () => {
      expect(service.stringifyObject({value: undefined}, "(nowt)")).toBe("Value: (nowt)");
      expect(service.stringifyObject({value: null}, "(nowt)")).toBe("Value: (nowt)");
      expect(service.stringifyObject({value: ""}, "(nowt)")).toBe("Value: (nowt)");
      expect(service.stringifyObject("", "(nowt)")).toBe("(nowt)");
    });
    it("should return an object nested objects each with humanised key, values", () => {
      expect(service.stringifyObject({
        title: "a Brief Description and Start Point",
        config: {
          meetup: {
            announce: true,
            defaultContent: "Prompt to join after 3 walks",
            publishStatus: "published",
            guestLimit: 7
          }
        }
      })).toEqual([
        "Config -> Meetup -> Announce: true",
        "Default Content: Prompt to join after 3 walks",
        "Guest Limit: 7",
        "Publish Status: published",
        "Title: a Brief Description and Start Point",
      ].join(", "));
    });
  });

  describe("noValueFor", () => {

    it("should return true for undefined", () => {
      expect(service.noValueFor(undefined)).toBe(true);
    });

    it("should return true for null", () => {
      expect(service.noValueFor(null)).toBe(true);
    });

    it("should return false for false", () => {
      expect(service.noValueFor(false)).toBe(false);
    });

    it("should return false for true", () => {
      expect(service.noValueFor(true)).toBe(false);
    });

    it("should return true for empty string", () => {
      expect(service.noValueFor("")).toBe(true);
    });

    it("should return true for empty array", () => {
      expect(service.noValueFor([])).toBe(true);
    });

    it("should return true for empty object", () => {
      expect(service.noValueFor({})).toBe(true);
    });

    it("should return false for non-empty string", () => {
      expect(service.noValueFor("value")).toBe(false);
    });

    it("should return false for non-empty array", () => {
      expect(service.noValueFor([1, 2, 3])).toBe(false);
    });

    it("should return false for non-empty object", () => {
      expect(service.noValueFor({key: "value"})).toBe(false);
    });
  });

  describe("left", () => {
    it("should return the left X characters of string regardless of length", () => {
      expect(service.left("Hello Mum", 10)).toBe("Hello Mum");
      expect(service.left("the quick brown fox jumped over the lazy dog", 10)).toBe("the quick ");
    });
  });

  describe("stringify", () => {
    it("Check this - seems odd behaviour: should return just message if supplied object with both title and message (e.g. AlertMessage)", () => {
      expect(service.stringify({title: "who cares", message: "foo"})).toBe("foo");
    });
    it("should return stringified version of field if string", () => {
      expect(service.stringify({message: "foo"})).toBe("Message: foo");
      expect(service.stringify({title: "who cares"})).toBe("Title: who cares");
    });
    it("should return stringified version of message field if object", () => {
      expect(service.stringify({message: {some: {complex: {object: "wohoo"}}}})).toBe("Message -> Some -> Complex -> Object: wohoo");
    });
  });

  describe("replaceAll", () => {
    it("should replace multiple instance of one character with another", () => {
      expect(service.replaceAll("  ", " ", "Hello            Mum")).toBe("Hello Mum");
      expect(service.replaceAll("  ", " ", "Hello      Mum")).toBe("Hello Mum");
    });

    it("should not get stuck in a loop if search and replace are the same", () => {
      expect(service.replaceAll(" ", " ", "Hello            Mum")).toBe("Hello            Mum");
    });

    it("should replace one or more instances of one string with another", () => {
      expect(service.replaceAll("abc", "replaced text", "Test abc test test abc test test test abc test test abc")).toBe("Test replaced text test test replaced text test test test replaced text test test replaced text");
      expect(service.replaceAll(".", "", "$100.00")).toBe("$10000");
      expect(service.replaceAll("e", "o", "there are quite a few instances of the letter e in this text")).toBe("thoro aro quito a fow instancos of tho lottor o in this toxt");
      expect(service.replaceAll("the", "one", "the other the other the other the other ")).toBe("one ooner one ooner one ooner one ooner ");
      expect(service.replaceAll(".", "?", "1233457890.f?g,sfakj\n239870!@£$%^&*([]).{}")).toBe("1233457890?f?g,sfakj\n239870!@£$%^&*([])?{}");
    });

    it("should accept numeric values too!", () => {
      expect(service.replaceAll(9, 1, 909912349.9)).toBe(101112341.1);
    });
  });

  describe("kebabCase", () => {
    it("should convert a single string to kebab-case", () => {
      const result = service.kebabCase("Hello World");
      expect(result).toBe("hello-world");
    });

    it("should convert multiple strings to a single kebab-case string", () => {
      const result = service.kebabCase("Hello", "World");
      expect(result).toBe("hello-world");
    });

    it("should handle empty strings and falsy values", () => {
      const result = service.kebabCase("", null, "Hello World");
      expect(result).toBe("hello-world");
    });

    it("should handle strings with multiple spaces", () => {
      const result = service.kebabCase("Hello   World");
      expect(result).toBe("hello-world");
    });

    it("should handle strings with uppercase characters", () => {
      const result = service.kebabCase("path", "WithUpperCase");
      expect(result).toBe("path-with-upper-case");
    });
  });

  describe("asTitle", () => {
    it("should convert a string to title case", () => {
      const result = service.asTitle("hello world");
      expect(result).toBe("Hello World");
    });
  });

  describe("asWords", () => {
    it("should split a string into words", () => {
      const result = service.asWords("hello world");
      expect(result).toBe("hello world");
    });
  });

  describe("pluraliseWithCount", () => {
    it("should pluralise a word based on count", () => {
      const result = service.pluraliseWithCount(1, "apple");
      expect(result).toBe("1 apple");
      const resultPlural = service.pluraliseWithCount(2, "apple");
      expect(resultPlural).toBe("2 apples");
    });
  });

  describe("arrayFromDelimitedData", () => {
    it("should convert a comma-separated string to an array", () => {
      const result = service.arrayFromDelimitedData("apple, banana, cherry");
      expect(result).toEqual(["apple", "banana", "cherry"]);
    });

    it("should handle an array input", () => {
      const result = service.arrayFromDelimitedData(["apple", "banana", "cherry"]);
      expect(result).toEqual(["apple", "banana", "cherry"]);
    });

    it("should handle empty input", () => {
      const result = service.arrayFromDelimitedData("");
      expect(result).toEqual([]);
    });
  });
});
