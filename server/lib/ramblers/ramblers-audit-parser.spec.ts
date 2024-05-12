import { expect } from "chai";
import * as auditParser from "./ramblers-audit-parser";

const errorIcons = ["⨯", "✗"];
const successIcons = ["✓", "✓"];
const successInput = "           ✓ nick executes a synchronous script with arguments: [ the chat window ] (7ms)";
const failureInput = "           ✗ nick fails to do something";

describe("auditParser.trimTokensFrom", () => {
  it("should trim tokens from string if they are contained", done => {
    expect(auditParser.trimTokensFrom(successInput, successIcons)).to.equal("nick executes a synchronous script with arguments: [ the chat window ] (7ms)");
    done();
  });

  it("should leave only trim string if tokens not contained", done => {
    expect(auditParser.trimTokensFrom(successInput, errorIcons)).to.equal(successInput.trim());
    done();
  });
});

describe("auditParser.anyMatch", () => {
  it("any match should return if match of any token in string is true", done => {
    expect(auditParser.anyMatch(successInput, successIcons)).to.equal(true);
    expect(auditParser.anyMatch(successInput, errorIcons)).to.equal(false);
    done();
  });
});

describe("auditParser.parseStandardOut", () => {
  it("should parse successInput", done => {

    expect(auditParser.parseStandardOut(successInput)).to.eql([{
      audit: true,
      type: "step",
      status: "success",
      message: "nick executes a synchronous script with arguments: [ the chat window ] (7ms)"
    }]);
    done();
  });

  it("should parse failureInput", done => {

    expect(auditParser.parseStandardOut(failureInput)).to.eql([{
      audit: true,
      type: "step",
      status: "error",
      message: "nick fails to do something"
    }]);
    done();
  });
});

describe("auditParser.parseStandardError", () => {
  it("should return non-audit response for specific strings", done => {
    const nonAudit = [{
      audit: false
    }];
    expect(auditParser.parseStandardError("\n")).to.eql(nonAudit);
    expect(auditParser.parseStandardError("")).to.eql(nonAudit);
    expect(auditParser.parseStandardError("npm")).to.eql(nonAudit);
    done();
  });
});
