import expect from "expect";
import { describe, it } from "mocha";
import { snapMetricImperialNumberInputs, walkEditStepNumberValue } from "./walk-edit-number-fields";

describe("walkEditStepNumberValue", () => {
  it("snaps kilometres to the Walks Manager 0.1 step", () => {
    expect(walkEditStepNumberValue("16.09")).toEqual("16.1");
  });

  it("snaps the widget miles conversion to the 0.1 step", () => {
    expect(walkEditStepNumberValue("10.010")).toEqual("10.0");
  });

  it("leaves a blank field blank", () => {
    expect(walkEditStepNumberValue("")).toEqual("");
  });
});

describe("snapMetricImperialNumberInputs", () => {
  it("writes snapped values onto the km and miles inputs without firing the conversion widget", () => {
    const kilometres = {id: "RamledWalkMetricImperial3", value: "16.09", step: "0.1"};
    const miles = {id: "RamledWalkMetricImperial4", value: "10.010", step: "0.1"};
    const documentRef = {
      querySelectorAll: () => [kilometres, miles]
    } as unknown as Document;
    const snapped = snapMetricImperialNumberInputs(documentRef);
    expect(kilometres.value).toEqual("16.1");
    expect(miles.value).toEqual("10.0");
    expect(snapped).toEqual([
      {id: "RamledWalkMetricImperial3", value: "16.1"},
      {id: "RamledWalkMetricImperial4", value: "10.0"}
    ]);
  });
});
