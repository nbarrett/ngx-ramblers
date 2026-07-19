import { Component, HostBinding, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { faCompress, faExpand } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { SiteLogoComponent } from "../site-logo/site-logo";
import { StoredValue } from "../../../models/ui-actions";
import { DOCUMENT } from "@angular/common";

@Component({
  selector: "app-maximisable-panel",
  standalone: true,
  exportAs: "maximisablePanel",
  imports: [FontAwesomeModule, TooltipDirective, SiteLogoComponent],
  styles: [`
    :host
      display: block
    :host.maximised
      position: fixed
      inset: 0
      z-index: 1056
      background: #fff
      display: flex
      flex-direction: column
      overflow: hidden
    .maximisable-content
      display: contents
    :host.maximised .maximisable-content
      display: block
      flex: 1 1 auto
      min-height: 0
      overflow: auto
      padding: 0.75rem 1rem
    :host.maximised.inbox-scroll-contained .maximisable-content
      display: flex
      flex-direction: column
      overflow: hidden
    .maximisable-bar
      display: flex
      align-items: center
      gap: 0.5rem
      margin-bottom: 0.75rem
    :host.inbox-scroll-contained .maximisable-bar
      margin-bottom: 0.5rem
    .maximisable-bar-controls
      display: flex
      align-items: center
      gap: 0.5rem
      flex: 1 1 auto
      min-width: 0
    .maximisable-toggle
      flex-shrink: 0
    @media (max-width: 767.98px)
      .maximisable-logo, .maximisable-toggle
        display: none
  `],
  template: `
    <div class="maximisable-content">
      @if (showHeader) {
        <div class="maximisable-bar">
          @if (maximised) {
            <app-site-logo [height]="logoHeight" class="flex-shrink-0 maximisable-logo"/>
          }
          <div class="maximisable-bar-controls">
            <ng-content select="[panelControls]"/>
          </div>
          @if (showMaximise && showToggleButton) {
            <button type="button" class="btn btn-quiet btn-sm text-nowrap maximisable-toggle" (click)="toggle()"
                    [tooltip]="maximised ? restoreTooltip : maximiseTooltip">
              <fa-icon [icon]="maximised ? faCompress : faExpand" class="me-1"/>
              {{ maximised ? "Restore" : "Maximise" }}
            </button>
          }
        </div>
      }
      <ng-content/>
    </div>`
})
export class MaximisablePanelComponent implements OnInit, OnDestroy {

  @Input() showHeader = true;
  @Input() showMaximise = true;
  @Input() showToggleButton = true;
  @Input() logoHeight = 44;
  @Input() maximiseTooltip = "Maximise to fill the screen";
  @Input() restoreTooltip = "Restore";
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private document = inject(DOCUMENT);
  @HostBinding("class.maximised") maximised = this.route.snapshot.queryParamMap.get(StoredValue.MAXIMISE) === "true";
  protected readonly faCompress = faCompress;
  protected readonly faExpand = faExpand;
  private subscriptions: Subscription[] = [];
  private documentOverflow: string | null = null;
  private bodyOverflow: string | null = null;

  ngOnInit(): void {
    this.subscriptions.push(this.route.queryParamMap.subscribe((paramMap: ParamMap) => {
      this.setMaximised(paramMap.get(StoredValue.MAXIMISE) === "true");
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.updateDocumentScrolling(false);
  }

  toggle(): void {
    this.setMaximised(!this.maximised);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.MAXIMISE]: this.maximised ? "true" : null},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  private setMaximised(value: boolean): void {
    const target = this.showMaximise && value;
    if (target === this.maximised) {
      this.updateDocumentScrolling(target);
      return;
    }
    this.maximised = target;
    this.updateDocumentScrolling(target);
  }

  private updateDocumentScrolling(maximised: boolean): void {
    if (maximised && this.documentOverflow === null && this.bodyOverflow === null) {
      this.documentOverflow = this.document.documentElement.style.overflow;
      this.bodyOverflow = this.document.body.style.overflow;
      this.document.documentElement.style.overflow = "hidden";
      this.document.body.style.overflow = "hidden";
    } else if (!maximised && this.documentOverflow !== null && this.bodyOverflow !== null) {
      this.document.documentElement.style.overflow = this.documentOverflow;
      this.document.body.style.overflow = this.bodyOverflow;
      this.documentOverflow = null;
      this.bodyOverflow = null;
    }
  }
}
