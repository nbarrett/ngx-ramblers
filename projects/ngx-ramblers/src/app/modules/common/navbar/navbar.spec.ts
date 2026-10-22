import { NgClass, NgStyle } from "@angular/common";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { of, Subscription } from "rxjs";
import { classBackgroundDark } from "../../../models/system.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { NavbarComponent } from "./navbar";

describe("shared mobile navigation", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NavbarComponent, LoggerTestingModule],
      providers: [
        {provide: SystemConfigService, useValue: {events: () => of({header: {navBar: {class: classBackgroundDark}}})}},
        {provide: BroadcastService, useValue: {on: vi.fn(() => new Subscription())}},
        {provide: UrlService, useValue: {baseUrl: () => "/"}}
      ]
    }).overrideComponent(NavbarComponent, {
      set: {imports: [NgClass, NgStyle], schemas: [CUSTOM_ELEMENTS_SCHEMA]}
    });
  });

  it("uses the standard hamburger and vertical expanding menu", () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();
    fixture.componentInstance.onResize({target: {innerWidth: 390}});
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector<HTMLButtonElement>("button[aria-label='Toggle navigation']");
    expect(toggle.classList.contains("navbar-toggler")).toBe(true);
    expect(toggle.classList.contains("btn")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(element.querySelector(".navbar-collapse")).toBeNull();
    expect(element.classList.contains("mobile-menu-open")).toBe(false);
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(element.classList.contains("mobile-menu-open")).toBe(true);
    expect(element.querySelector(".navbar-collapse.show app-navbar-content")).not.toBeNull();
    expect(element.querySelector(".dropdown-menu")).toBeNull();
    toggle.click();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(element.querySelector(".navbar-collapse")).toBeNull();
    expect(element.classList.contains("mobile-menu-open")).toBe(false);
  });
});
