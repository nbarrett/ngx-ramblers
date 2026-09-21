import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { AppShellService } from "../../services/maps/app-shell.service";
import { RouterHistoryService } from "../../services/router-history.service";
import { StandaloneNavigationComponent } from "./standalone-navigation";

describe("StandaloneNavigationComponent", () => {
  const state = {installed: false};
  const history = {appBackDestination: vi.fn(), navigateBackWithinApp: vi.fn()};
  const router = {navigate: vi.fn()};

  beforeEach(() => {
    state.installed = false;
    history.appBackDestination.mockReturnValue("/app");
    history.navigateBackWithinApp.mockClear();
    router.navigate.mockClear();
    TestBed.configureTestingModule({
      imports: [StandaloneNavigationComponent],
      providers: [
        {provide: AppShellService, useValue: {installed: () => state.installed}},
        {provide: RouterHistoryService, useValue: history},
        {provide: Router, useValue: router}
      ]
    });
  });

  it("does not duplicate browser navigation controls in a normal tab", () => {
    const fixture = TestBed.createComponent(StandaloneNavigationComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("nav")).toBeNull();
  });

  it("provides Back and Walks in an installed app", () => {
    state.installed = true;
    const fixture = TestBed.createComponent(StandaloneNavigationComponent);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll("button") as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute("aria-label")).toBe("Back to walks");
    buttons[0].click();
    buttons[1].click();
    expect(history.navigateBackWithinApp).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(["/app"]);
  });
});
