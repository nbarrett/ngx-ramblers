import { TestBed } from "@angular/core/testing";
import { keys } from "es-toolkit/compat";
import { vi } from "vitest";
import { UiActionsService } from "./ui-actions.service";
import { LoggerFactory } from "./logger-factory.service";
import { StoredValue } from "../models/ui-actions";

describe("UiActionsService", () => {
    let service: UiActionsService;
    const storage: Record<string, string> = {};
    const loggerSpy = {
        createLogger: () => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        })
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        keys(storage).forEach(key => delete storage[key]);
        vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => storage[key] ?? null);
        vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
            storage[key] = value;
        });
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key: string) => {
            delete storage[key];
        });

        TestBed.configureTestingModule({
            providers: [
                UiActionsService,
                { provide: LoggerFactory, useValue: loggerSpy }
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
        storage["object-key"] = JSON.stringify({ foo: "bar" });
        expect(service.initialObjectValueFor<{
            foo: string;
        }>("object-key")).toEqual({ foo: "bar" });
    });

    it("calculates boolean defaults using booleanOf", () => {
        storage["bool-key"] = "true";
        expect(service.initialBooleanValueFor("bool-key")).toBe(true);
        expect(service.initialBooleanValueFor("missing-bool", "false")).toBe(false);
    });

    it("saves values and removes them", () => {
        service.saveValueFor(StoredValue.SEARCH, "needle");
        expect(storage[StoredValue.SEARCH]).toEqual("needle");

        service.removeItemFor(StoredValue.SEARCH);
        expect(storage[StoredValue.SEARCH]).toBeUndefined();
    });

    it("detects stored items", () => {
        expect(service.itemExistsFor("unknown")).toBe(false);
        storage["known"] = "value";
        expect(service.itemExistsFor("known")).toBe(true);
    });

    it("removes stored value when the flag is true", () => {
        storage[StoredValue.SEARCH] = "true";
        service.removeStoredValueIfTrue(StoredValue.SEARCH);
        expect(storage[StoredValue.SEARCH]).toBeUndefined();
    });

    describe("booleanOf", () => {
        it("returns exact boolean values", () => {
            expect(service.booleanOf(true)).toBe(true);
            expect(service.booleanOf(false)).toBe(false);
        });

        it("parses numeric values", () => {
            expect(service.booleanOf(1)).toBe(true);
            expect(service.booleanOf(0)).toBe(false);
        });

        it("parses string variations", () => {
            expect(service.booleanOf("true")).toBe(true);
            expect(service.booleanOf("FALSE")).toBe(false);
            expect(service.booleanOf("yes")).toBe(true);
            expect(service.booleanOf("No")).toBe(false);
            expect(service.booleanOf("1")).toBe(true);
            expect(service.booleanOf("0")).toBe(false);
            expect(service.booleanOf("false", true)).toBe(false);
        });

        it("defaults to false for unknown values", () => {
            expect(service.booleanOf("unknown")).toBe(false);
            expect(service.booleanOf(undefined)).toBe(false);
            expect(service.booleanOf(null)).toBe(false);
        });

        it("respects provided fallbacks", () => {
            expect(service.booleanOf("unknown", true)).toBe(true);
            expect(service.booleanOf(undefined, true)).toBe(true);
            expect(service.booleanOf(null, true)).toBe(true);
        });
    });
});
