import { TestBed } from "@angular/core/testing";
import { BsModalService } from "ngx-bootstrap/modal";
import { NativeCompassService } from "../../services/maps/native-compass.service";
import { CompassCalibrationHelpComponent } from "./compass-calibration-help";

describe("compass calibration help", () => {
  const hide = vi.fn();
  const show = vi.fn(() => ({hide}));

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [CompassCalibrationHelpComponent],
      providers: [
        {provide: BsModalService, useValue: {show}},
        {provide: NativeCompassService, useValue: {calibrationRecommended: () => false}}
      ]
    });
  });

  it("opens once in a fullscreen modal and closes when its input changes", () => {
    const fixture = TestBed.createComponent(CompassCalibrationHelpComponent);
    fixture.detectChanges();
    expect(show).not.toHaveBeenCalled();
    fixture.componentRef.setInput("open", true);
    fixture.detectChanges();
    expect(show).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      class: "modal-fullscreen",
      ariaLabelledBy: "compass-help-title"
    }));
    fixture.componentInstance.open = true;
    expect(show).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput("open", false);
    fixture.detectChanges();
    expect(hide).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it("supports opening immediately and removes the modal when navigating away", () => {
    const fixture = TestBed.createComponent(CompassCalibrationHelpComponent);
    fixture.componentRef.setInput("open", true);
    fixture.detectChanges();
    expect(show).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it("uses the supplied back label", () => {
    const fixture = TestBed.createComponent(CompassCalibrationHelpComponent);
    fixture.componentRef.setInput("open", true);
    fixture.componentRef.setInput("backLabel", "Back to settings");
    fixture.detectChanges();
    expect(fixture.componentInstance.backLabel).toBe("Back to settings");
  });
});
