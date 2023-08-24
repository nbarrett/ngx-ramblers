import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";

import { StringUtilsService } from "./string-utils.service";

const memberService = {
  allLimitedFields: () => Promise.resolve({email: "test@example.com"}),
  filterFor: {GROUP_MEMBERS: ""}
};

describe("StringUtilsService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule, RouterTestingModule],
    providers: [
      MemberIdToFullNamePipe,
      FullNamePipe,
      FullNameWithAliasPipe,
      {provide: "MemberService", useValue: memberService}]
  }));

  describe("stringifyObject", () => {
    it("should return an object with humanised key, values", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.stringifyObject({
          hostname: "api.meetup.com",
          protocol: "https:"
        }
      )).toBe("Hostname: api.meetup.com, Protocol: https:");
    });
    it("should not distinguish between undefined, empty and null", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.stringifyObject({value: undefined})).toBe("Value: (none)");
      expect(service.stringifyObject({value: null})).toBe("Value: (none)");
      expect(service.stringifyObject({value: ""})).toBe("Value: (none)");
      expect(service.stringifyObject("")).toBe("(none)");
    });
    it("should allow a default value to be supplied for non-present values", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.stringifyObject({value: undefined}, "(nowt)")).toBe("Value: (nowt)");
      expect(service.stringifyObject({value: null}, "(nowt)")).toBe("Value: (nowt)");
      expect(service.stringifyObject({value: ""}, "(nowt)")).toBe("Value: (nowt)");
      expect(service.stringifyObject("", "(nowt)")).toBe("(nowt)");
    });
    it("should return an object nested objects each with humanised key, values", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
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

  describe("left", () => {
    it("should return the left X characters of string regardless of length", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.left("Hello Mum", 10)).toBe("Hello Mum");
      expect(service.left("the quick brown fox jumped over the lazy dog", 10)).toBe("the quick ");
    });
  });

  describe("stringify", () => {
    it("Check this - seems odd behaviour: should return just message if supplied object with both title and message (e.g. AlertMessage)", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.stringify({title: "who cares", message: "foo"})).toBe("foo");
    });
    it("should return stringified version of field if string", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.stringify({message: "foo"})).toBe("Message: foo");
      expect(service.stringify({title: "who cares"})).toBe("Title: who cares");
    });
    it("should return stringified version of message field if object", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.stringify({message: {some: {complex: {object: "wohoo"}}}})).toBe("Message -> Some -> Complex -> Object: wohoo");
    });
  });

  describe("replaceAll", () => {
    it("should replace multiple instance of one character with another", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.replaceAll("  ", " ", "Hello            Mum")).toBe("Hello Mum");
      expect(service.replaceAll("  ", " ", "Hello      Mum")).toBe("Hello Mum");
    });

    it("should not get stuck in a loop if search and replace are the same", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.replaceAll(" ", " ", "Hello            Mum")).toBe("Hello            Mum");
    });

    it("should replace one or more instances of one string with another", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.replaceAll("abc", "replaced text", "Test abc test test abc test test test abc test test abc")).toBe("Test replaced text test test replaced text test test test replaced text test test replaced text");
      expect(service.replaceAll(".", "", "$100.00")).toBe("$10000");
      expect(service.replaceAll("e", "o", "there are quite a few instances of the letter e in this text")).toBe("thoro aro quito a fow instancos of tho lottor o in this toxt");
      expect(service.replaceAll("the", "one", "the other the other the other the other ")).toBe("one ooner one ooner one ooner one ooner ");
      expect(service.replaceAll(".", "?", "1233457890.f?g,sfakj\n239870!@£$%^&*([]).{}")).toBe("1233457890?f?g,sfakj\n239870!@£$%^&*([])?{}");
    });

    it("should accept numeric values too!", () => {
      const service: StringUtilsService = TestBed.inject(StringUtilsService);
      expect(service.replaceAll(9, 1, 909912349.9)).toBe(101112341.1);
    });

  });

});
