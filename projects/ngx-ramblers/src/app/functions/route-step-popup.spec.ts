import { locationPinPopupHtml, mapPinPopupHtml, routeStepPopupHtml } from "./route-step-popup";

describe("map pin popups", () => {
  it("uses the same card markup for a locate pin as for a walk direction step", () => {
    const pin = mapPinPopupHtml({label: "1", colour: "#453C90", instruction: "Meeting point", note: "SU 51648 56529"});
    const step = routeStepPopupHtml(
      {id: "step", latitude: 51, longitude: -1, label: "1", instruction: "Turn left at the gate"},
      undefined,
      "#453C90"
    );
    expect(pin).toContain("route-step-card");
    expect(step).toContain("route-step-card");
    expect(pin).toContain("Meeting point");
    expect(pin).toContain("SU 51648 56529");
    expect(pin).toContain("route-guide-number");
  });

  it("builds a walk pin from the same locate card as a named point", () => {
    const walk = locationPinPopupHtml("#453C90", "Start", ["White Hill car park, Kingsclere", "RG26 5UD", "SU 51648 56529"]);
    const locate = mapPinPopupHtml({colour: "#453C90", instruction: "Start", note: "White Hill car park, Kingsclere\nRG26 5UD\nSU 51648 56529"});
    expect(walk).toBe(locate);
    expect(walk).toContain("route-step-card");
  });
});
