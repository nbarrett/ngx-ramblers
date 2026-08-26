import { TestBed } from "@angular/core/testing";
import { ResizerComponent } from "./resizer";

describe("ResizerComponent", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [ResizerComponent]
  }).compileComponents());

  it("shows a custom label when one is supplied", () => {
    const fixture = TestBed.createComponent(ResizerComponent);
    fixture.componentInstance.size = 200;
    fixture.componentInstance.label = "auto";
    fixture.detectChanges();
    expect(fixture.componentInstance.displayLabel()).toEqual("auto");
  });

  it("shows the current size in pixels when no custom label is supplied", () => {
    const fixture = TestBed.createComponent(ResizerComponent);
    fixture.componentInstance.size = 240;
    fixture.componentInstance.label = null;
    fixture.detectChanges();
    expect(fixture.componentInstance.displayLabel()).toEqual("240px");
  });

  it("does not show Reset until a height can be cleared", () => {
    const fixture = TestBed.createComponent(ResizerComponent);
    fixture.componentInstance.canClear = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".resizer-clear")).toBeNull();
  });

  it("emits sizeClear when Reset is clicked", () => {
    const fixture = TestBed.createComponent(ResizerComponent);
    const emitted = {called: false};
    fixture.componentInstance.canClear = true;
    fixture.componentInstance.sizeClear.subscribe(() => {
      emitted.called = true;
    });
    fixture.detectChanges();
    fixture.nativeElement.querySelector(".resizer-clear").click();
    expect(emitted.called).toEqual(true);
  });
});
