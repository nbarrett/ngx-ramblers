import { TestBed } from "@angular/core/testing";
import { DrivingOriginMode } from "../../models/current-location.model";
import { CurrentLocationService } from "../../services/maps/current-location.service";
import { DrivingOrigin } from "./driving-origin";

describe("DrivingOrigin", () => {
  it("selects the current location radio and emits the new mode", () => {
    TestBed.configureTestingModule({
      imports: [DrivingOrigin],
      providers: [{provide: CurrentLocationService, useValue: {available: () => true}}]
    });
    const fixture = TestBed.createComponent(DrivingOrigin);
    fixture.componentRef.setInput("mode", DrivingOriginMode.POSTCODE);
    fixture.detectChanges();
    const selectedModes: DrivingOriginMode[] = [];
    fixture.componentInstance.modeChange.subscribe(mode => selectedModes.push(mode));
    const currentLocation = fixture.nativeElement.querySelector("#driving-origin-driving-from-here") as HTMLInputElement;
    currentLocation.click();
    fixture.detectChanges();
    expect(selectedModes).toEqual([DrivingOriginMode.MY_LOCATION]);
  });
});
