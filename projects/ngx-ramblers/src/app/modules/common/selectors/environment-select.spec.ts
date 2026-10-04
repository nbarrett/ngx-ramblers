import { TestBed } from "@angular/core/testing";
import { EnvironmentSelectComponent } from "./environment-select";
import { HumanisePipe } from "../../../pipes/humanise.pipe";

describe("environment selector search", () => {
  it("finds a website by its abbreviation, full name and address", () => {
    TestBed.configureTestingModule({providers: [HumanisePipe]});
    const component = TestBed.runInInjectionContext(() => new EnvironmentSelectComponent());
    component.items = [{name: "hpwg", displayName: "Hillside Park Walking Group", description: "https://group.example.org.uk", appName: "", hasMongoConfig: false}];
    const item = component.displayItems[0];
    expect(component.environmentSearch("hpwg", item)).toBe(true);
    expect(component.environmentSearch("HILLSIDE walking", item)).toBe(true);
    expect(component.environmentSearch("group.example.org.uk", item)).toBe(true);
    expect(component.environmentSearch("  hillside  park  ", item)).toBe(true);
    expect(component.environmentSearch("unrelated", item)).toBe(false);
  });
});
