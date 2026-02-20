import { TestBed } from "@angular/core/testing";
import { keys } from "es-toolkit/compat";
import { UiActionsService } from "./ui-actions.service";
import { LoggerFactory } from "./logger-factory.service";
import { StoredValue } from "../models/ui-actions";

describe("UiActionsService", () => {
  let service: UiActionsService;
  const storage: Record<string, string> = {};
  const loggerSpy = {
    createLogger: () => ({
      debug: jasmine.createSpy("debug"),
      info: jasmine.createSpy("info"),
      warn: jasmine.createSpy("warn"),
      error: jasmine.createSpy("error")
    })
  };

  beforeEach(() => {
    keys(storage).forEach(key => delete storage[key]);
    spyOn(window.localStorage, "getItem").and.callFake((key: string) => storage[key] ?? null);
    spyOn(window.localStorage, "setItem").and.callFake((key: string, value: string) => {
      storage[key] = value;
    });
    spyOn(window.localStorage, "removeItem").and.callFake((key: string) => {
      delete storage[key];
    });

    TestBed.configureTestingModule({
      providers: [
        UiActionsService,
        {provide: LoggerFactory, useValue: loggerSpy}
      ]
    });
    service = TestBed.inject(UiActionsService);
  });

  it("returns stored values when present", () => {
    storage["test-key"] = "stored";
    expect(service.initialValueFor("test-key", "default")).toEqual("stored");
  });

  it("falls back to defaults when no stored value exists", () => {
    expect(service.initialValueFor("missing-key", "fallback")).toEqual("fallback");
  });

  it("parses stored JSON objects", () => {
    storage["object-key"] = JSON.stringify({foo: "bar"});
    expect(service.initialObjectValueFor<{foo: string}>("object-key")).toEqual({foo: "bar"});
  });

  it("calculates boolean defaults using booleanOf", () => {
    storage["bool-key"] = "true";
    expect(service.initialBooleanValueFor("bool-key")).toBeTrue();
    expect(service.initialBooleanValueFor("missing-bool", "false")).toBeFalse();
  });

  it("saves values and removes them", () => {
    service.saveValueFor(StoredValue.SEARCH, "needle");
    expect(storage[StoredValue.SEARCH]).toEqual("needle");

    service.removeItemFor(StoredValue.SEARCH);
    expect(storage[StoredValue.SEARCH]).toBeUndefined();
  });

  it("detects stored items", () => {
    expect(service.itemExistsFor("unknown")).toBeFalse();
    storage["known"] = "value";
    expect(service.itemExistsFor("known")).toBeTrue();
  });

  it("removes stored value when the flag is true", () => {
    storage[StoredValue.SEARCH] = "true";
    service.removeStoredValueIfTrue(StoredValue.SEARCH);
    expect(storage[StoredValue.SEARCH]).toBeUndefined();
  });

  describe("booleanOf", () => {
    it("returns exact boolean values", () => {
      expect(service.booleanOf(true)).toBeTrue();
      expect(service.booleanOf(false)).toBeFalse();
    });

    it("parses numeric values", () => {
      expect(service.booleanOf(1)).toBeTrue();
      expect(service.booleanOf(0)).toBeFalse();
    });

    it("parses string variations", () => {
      expect(service.booleanOf("true")).toBeTrue();
      expect(service.booleanOf("FALSE")).toBeFalse();
      expect(service.booleanOf("yes")).toBeTrue();
      expect(service.booleanOf("No")).toBeFalse();
      expect(service.booleanOf("1")).toBeTrue();
      expect(service.booleanOf("0")).toBeFalse();
      expect(service.booleanOf("false", true)).toBeFalse();
    });

    it("defaults to false for unknown values", () => {
      expect(service.booleanOf("unknown")).toBeFalse();
      expect(service.booleanOf(undefined)).toBeFalse();
      expect(service.booleanOf(null)).toBeFalse();
    });

    it("respects provided fallbacks", () => {
      expect(service.booleanOf("unknown", true)).toBeTrue();
      expect(service.booleanOf(undefined, true)).toBeTrue();
      expect(service.booleanOf(null, true)).toBeTrue();
    });
  });
});
