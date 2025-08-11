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
        auditTime: expect.any(Number), // Allow any timestamp
        message: "nick fails to do something",
        status: Status.ERROR,
        type: AuditType.STEP
      }
    }]);
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
