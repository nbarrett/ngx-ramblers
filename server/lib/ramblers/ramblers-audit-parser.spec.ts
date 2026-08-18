import expect from "expect";
import {describe, it} from "mocha";
import * as auditParser from "./ramblers-audit-parser";
import { AuditType, Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

const errorIcons = ["⨯", "✗"];
const successIcons = ["✓", "✓"];
const successInput = "           ✓ nick executes a synchronous script with arguments: [ the chat window ] (7ms)";
const failureInput = "           ✗ nick fails to do something";

describe("auditParser.trimTokensFrom", () => {
  it("should trim tokens from string if they are contained", done => {
    expect(auditParser.trimTokensFrom(successInput, successIcons)).toEqual("nick executes a synchronous script with arguments: [ the chat window ] (7ms)");
    done();
  });

  it("should leave only trim string if tokens not contained", done => {
    expect(auditParser.trimTokensFrom(successInput, errorIcons)).toEqual(successInput.trim());
    done();
  });
});

describe("auditParser.anyMatch", () => {
  it("any match should return if match of any token in string is true", done => {
    expect(auditParser.anyMatch(successInput, successIcons)).toEqual(true);
    expect(auditParser.anyMatch(successInput, errorIcons)).toEqual(false);
    done();
  });
});

describe("auditParser.parseStandardOut", () => {
  it("should parse successInput", () => {
    expect(auditParser.parseStandardOut(successInput)).toEqual([{
      audit: true,
      data: {
        auditTime: expect.any(Number),
        message: "nick executes a synchronous script with arguments: [ the chat window ] (7ms)",
        status: Status.SUCCESS,
        type: AuditType.STEP
      }
    }]);
  });

  it("should parse failureInput", () => {
    expect(auditParser.parseStandardOut(failureInput)).toEqual([{
      audit: true,
      data: {
        auditTime: expect.any(Number),
        message: "nick fails to do something",
        status: Status.ERROR,
        type: AuditType.STEP
      }
    }]);
  });

  it("drops playwright leftover lines", () => {
    const ignored = [{audit: false}];
    expect(auditParser.parseStandardOut("1 failed")).toEqual(ignored);
    expect(auditParser.parseStandardOut("npx playwright show-trace target/site/playwright/os-maps-export.ts-OS-Maps--93009-s-GPX-and-validate-the-file/trace.zip")).toEqual(ignored);
    expect(auditParser.parseStandardOut("Usage:")).toEqual(ignored);
    expect(auditParser.parseStandardOut("attachment #3: trace (application/zip)")).toEqual(ignored);
    expect(auditParser.parseStandardOut("Error Context: target/site/playwright/os-maps-export.ts-OS-Maps--93009-s-GPX-and-validate-the-file/error-context.md")).toEqual(ignored);
    expect(auditParser.parseStandardOut("lib/serenity-js/features/os-maps-export.ts:60:7 › OS Maps GPX export › should login, export Requested OS Maps route (0) as GPX and validate the file")).toEqual(ignored);
    expect(auditParser.parseStandardOut("at /Users/nick/dev/git-personal/ngx-ramblers/server/lib/serenity-js/features/os-maps-export.ts:63:7")).toEqual(ignored);
    expect(auditParser.parseStandardOut("at PerformActivitiesAsPlaywrightSteps.perform (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/playwright-test/src/stage/crew/PlaywrightTestReporter.ts:1:1)")).toEqual(ignored);
    expect(auditParser.parseStandardOut("--------------------------------")).toEqual(ignored);
  });
});

describe("auditParser.parseStandardError", () => {
  it("should return non-audit response for specific strings", done => {
    const nonAudit = [{
      audit: false
    }];
    expect(auditParser.parseStandardError("\n")).toEqual(nonAudit);
    expect(auditParser.parseStandardError("")).toEqual(nonAudit);
    expect(auditParser.parseStandardError("npm")).toEqual(nonAudit);
    done();
  });
});
