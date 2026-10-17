import { LoggerTestingModule } from "ngx-logger/testing";
import { ClipboardService } from "../../services/clipboard.service";
import { TestBed } from "@angular/core/testing";
import { LocatePointsListComponent } from "./locate-points-list";

describe("Saved point names", () => {
  it("keeps a name edit through blur and subsequent rendering", async () => {
    await TestBed.configureTestingModule({
      imports: [LocatePointsListComponent, LoggerTestingModule],
      providers: [
        {provide: ClipboardService, useValue: {clipboardText: () => null}}
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(LocatePointsListComponent);
    fixture.componentRef.setInput("points", [{id: "point-1", number: 1, name: "Point 1", point: {gridReference10: "TQ3000080000"}}]);
    fixture.componentInstance.rename.subscribe(change => fixture.componentRef.setInput("points", fixture.componentInstance.points.map(point => ({...point, name: change.name}))));
    fixture.detectChanges();
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector("input");
    input.value = "Hillside Park";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    input.dispatchEvent(new Event("blur"));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.points[0].name).toBe("Hillside Park");
    expect(fixture.nativeElement.querySelector("input").value).toBe("Hillside Park");
  });
});
