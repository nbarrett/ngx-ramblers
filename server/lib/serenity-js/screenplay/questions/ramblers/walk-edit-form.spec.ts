import expect from "expect";
import { describe, it } from "mocha";
import { walkEditDrupalErrorText, walkEditFormExpired, walkEditPageNavigatedDuringScript } from "./walk-edit-form";

describe("walkEditPageNavigatedDuringScript", () => {
  it("recognises a Playwright evaluate that died because the page navigated", () => {
    expect(walkEditPageNavigatedDuringScript(new Error("frame.evaluate: Execution context was destroyed, most likely because of a navigation"))).toEqual(true);
  });

  it("leaves other errors to throw", () => {
    expect(walkEditPageNavigatedDuringScript(new Error("selector not found"))).toEqual(false);
  });
});

describe("walkEditFormExpired", () => {
  it("recognises Walks Manager cancelling a form that was open too long", () => {
    expect(walkEditFormExpired(new Error("Walks Manager error: Error message The changes were cancelled because the form was open for too long."))).toEqual(true);
  });
});

describe("walkEditDrupalErrorText", () => {
  it("reads the Walks Manager error banner", () => {
    const documentRef = {
      querySelector: () => ({textContent: "  Error message  The changes were cancelled because the form was open for too long.  "})
    } as unknown as Document;
    expect(walkEditDrupalErrorText(documentRef)).toEqual("Error message The changes were cancelled because the form was open for too long.");
  });
});
