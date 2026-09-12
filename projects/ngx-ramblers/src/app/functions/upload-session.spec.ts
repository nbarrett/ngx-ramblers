import { TestBed } from "@angular/core/testing";
import { Settings } from "luxon";
import { LoggerTestingModule } from "ngx-logger/testing";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Status } from "../models/ramblers-upload-audit.model";
import { DateUtilsService } from "../services/date-utils.service";
import { uploadSessionLabel, uploadSessionName, uploadSessionTime, uploadSessionUrlParam } from "./upload-session";

describe("upload session", () => {
  const state: { dateUtils?: DateUtilsService } = {};

  beforeAll(() => {
    Settings.defaultZone = "Europe/London";
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [DateUtilsService]}).compileComponents();
    state.dateUtils = TestBed.inject(DateUtilsService);
  });

  describe("uploadSessionTime", () => {
    it("extracts the time from a walks upload session file name", () => {
      expect(uploadSessionTime("walks-export-12-September-2026-17-39.csv", state.dateUtils))
        .toEqual(state.dateUtils.parseDisplayDateWithFormat("12-September-2026-17-39", "dd-MMMM-yyyy-HH-mm")?.toMillis());
    });

    it("extracts the time from an OS Maps export session file name", () => {
      expect(uploadSessionTime("os-maps-export-20260912-173930.gpx", state.dateUtils))
        .toEqual(state.dateUtils.parseDisplayDateWithFormat("20260912-173930", "yyyyMMdd-HHmmss")?.toMillis());
    });

    it("extracts the time from an OS Maps list session file name", () => {
      expect(uploadSessionTime("os-maps-list-20260912-173930.json", state.dateUtils)).toBeTruthy();
    });

    it("returns null for a file name that does not match a known session format", () => {
      expect(uploadSessionTime("something-else.txt", state.dateUtils)).toBeNull();
    });
  });

  describe("uploadSessionName", () => {
    it("strips the prefix and extension from each session file name format", () => {
      expect(uploadSessionName("walks-export-12-September-2026-17-39.csv")).toEqual("12 September 2026 17 39");
      expect(uploadSessionName("os-maps-export-20260912-173930.gpx")).toEqual("20260912 173930");
      expect(uploadSessionName("")).toEqual("");
    });
  });

  describe("uploadSessionLabel", () => {
    it("includes the session duration when the audit times are known", () => {
      const label = uploadSessionLabel({
        fileName: "os-maps-export-20260912-173930.gpx",
        status: Status.SUCCESS,
        earliestAuditTime: 1000,
        latestAuditTime: 4000
      }, state.dateUtils);
      expect(label).toContain("(3 secs)");
    });

    it("prefers a supplied duration over the audit times", () => {
      const label = uploadSessionLabel({
        fileName: "os-maps-export-20260912-173930.gpx",
        status: Status.SUCCESS,
        earliestAuditTime: 1000,
        latestAuditTime: 4000
      }, state.dateUtils, "2 mins");
      expect(label).toContain("(2 mins)");
    });

    it("falls back to the session name when the file name has no timestamp", () => {
      expect(uploadSessionLabel({fileName: "mystery-file.csv", status: Status.ERROR}, state.dateUtils))
        .toEqual("mystery file");
    });
  });

  describe("uploadSessionUrlParam", () => {
    it("renders a sortable timestamp for a recognised session", () => {
      expect(uploadSessionUrlParam("os-maps-export-20260912-173930.gpx", state.dateUtils)).toEqual("2026-09-12T1739");
    });

    it("falls back to a slug for an unrecognised session", () => {
      expect(uploadSessionUrlParam("mystery file.csv", state.dateUtils)).toEqual("mystery-file");
    });
  });
});
