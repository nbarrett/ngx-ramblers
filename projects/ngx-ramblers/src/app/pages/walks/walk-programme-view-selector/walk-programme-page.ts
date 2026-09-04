import { AfterViewInit, booleanAttribute, Component, ElementRef, inject, Input, NgZone, OnDestroy, signal, ViewChild } from "@angular/core";
import { PageComponent } from "../../../page/page.component";
import { WalkProgrammeViewSelector } from "./walk-programme-view-selector";

@Component({
  selector: "app-walk-programme-page",
  imports: [PageComponent, WalkProgrammeViewSelector],
  template: `
    <app-page [autoTitle]="autoTitle" [showTitle]="showTitle">
      <ng-content select="[pageStart]"/>
      @if (showSelector) {
        <div #stickySentinel class="sticky-sentinel"></div>
        <div class="programme-chrome" [class.sticky-toolbar]="sticky" [class.condensed]="condensed()">
          <app-walk-programme-view-selector class="sticky-collapsible">
            <ng-content select="[programmeChrome]"/>
          </app-walk-programme-view-selector>
          <ng-content select="[programmeSticky]"/>
        </div>
      }
      <ng-content/>
    </app-page>
  `,
  styles: [`
    :host
      display: block
    .sticky-sentinel
      height: 0
    .programme-chrome.sticky-toolbar
      top: 0
    @media (max-width: 768px)
      .programme-chrome.sticky-toolbar
        position: static
  `]
})
export class WalkProgrammePageComponent implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private observer: IntersectionObserver | null = null;
  protected readonly condensed = signal(false);
  @ViewChild("stickySentinel") private stickySentinel: ElementRef<HTMLElement>;
  @Input({transform: booleanAttribute}) autoTitle = true;
  @Input({transform: booleanAttribute}) showTitle = true;
  @Input({transform: booleanAttribute}) showSelector = true;
  @Input({transform: booleanAttribute}) sticky = false;

  ngAfterViewInit(): void {
    if (this.sticky && this.stickySentinel) {
      this.observer = new IntersectionObserver(entries => {
        const scrolledPastChrome = entries.some(entry => !entry.isIntersecting && entry.boundingClientRect.top < 0);
        this.zone.run(() => this.condensed.set(scrolledPastChrome));
      });
      this.observer.observe(this.stickySentinel.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
