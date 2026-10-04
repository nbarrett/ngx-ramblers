import { describe, expect, it } from "vitest";
import { osMapsExportProgressFromMessage, osMapsExportProgressMessage } from "./os-maps-export.model";

describe("OS Maps cumulative progress", () => {
  it("reads totals from the summary step without counting browser interactions", () => {
    const progress = {converted: 7, total: 50, failed: 1};
    expect(osMapsExportProgressFromMessage(osMapsExportProgressMessage(progress))).toEqual(progress);
  });

  it("ignores ordinary browser steps and invalid totals", () => {
    expect(osMapsExportProgressFromMessage("Alex waits for the route to load")).toBeNull();
    expect(osMapsExportProgressFromMessage("OS Maps conversion: 8 of 5 routes converted; 1 failed")).toBeNull();
  });
});
