import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCompress, faExpand, faMaximize } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { StoredValue } from "../../../models/ui-actions";
import { UiActionsService } from "../../../services/ui-actions.service";

export interface MaximisableMapState {
  expanded: boolean;
  fullScreen: boolean;
}

@Component({
  selector: "app-maximisable-map",
  standalone: true,
  exportAs: "maximisableMap",
  imports: [FontAwesomeModule, TooltipDirective],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="maximisable-map" [class.position-relative]="!fullScreen" [class.map-full-screen-container]="fullScreen">
      @if (fullScreen) {
        <div class="map-full-screen-bar">
          <div class="map-full-screen-bar-text">
            <div class="map-full-screen-bar-title">{{ title || "Map" }}</div>
            <div class="map-full-screen-bar-hint">Press Escape to leave full screen</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm map-full-screen-exit"
                  (click)="exitFullScreen()"
                  aria-label="Exit full screen map">
            <fa-icon [icon]="faCompress" class="me-1"/>
            Exit full screen
          </button>
        </div>
      } @else if (enabled) {
        <div class="map-expand-controls" [style.top]="offsetTop" [style.right]="offsetRight">
          @if (expanded) {
            <button type="button" class="btn btn-sm btn-light map-expand-btn"
                    (click)="restore()"
                    tooltip="Restore map"
                    placement="left"
                    aria-label="Restore map">
              <fa-icon [icon]="faCompress"></fa-icon>
            </button>
          }
          <button type="button" class="btn btn-sm btn-light map-expand-btn"
                  (click)="cycle()"
                  [tooltip]="cycleTooltip"
                  placement="left"
                  [attr.aria-label]="cycleTooltip">
            <fa-icon [icon]="expanded ? faMaximize : faExpand"></fa-icon>
          </button>
        </div>
      }
      <ng-content/>
    </div>`,
  styles: [`
    app-maximisable-map
      display: block
      width: 100%
    .maximisable-map
      min-width: 0
      width: 100%
    .map-full-screen-container
      position: fixed
      inset: 0
      z-index: 1050
      background: white
      padding: 12px
      display: flex
      flex-direction: column
      gap: 10px
    .map-full-screen-container .map-full-screen-bar
      display: flex
      flex-wrap: wrap
      align-items: center
      justify-content: space-between
      gap: 0.75rem
      flex-shrink: 0
      min-height: 48px
      padding: 0.5rem 0.75rem
      border-radius: 8px
      background: #f4f6f8
      border: 1px solid rgba(29, 53, 87, 0.1)
    .map-full-screen-container .map-full-screen-bar-text
      min-width: 0
      flex: 1 1 auto
    .map-full-screen-container .map-full-screen-bar-title
      font-weight: 600
      font-size: 0.95rem
      line-height: 1.25
      color: #1d3557
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis
    .map-full-screen-container .map-full-screen-bar-hint
      font-size: 0.8rem
      line-height: 1.2
      color: #5c6b7a
      margin-top: 0.15rem
    .map-full-screen-container .map-full-screen-exit
      flex-shrink: 0
      min-height: 40px
      white-space: nowrap
    .map-full-screen-container .maximisable-map-fill
      flex: 1 1 auto
      height: auto !important
      min-height: 0
      margin-top: 0
    .map-full-screen-container .maximisable-map-fill .maximisable-map-fill
      flex: 1 1 auto
      height: 100% !important
      min-height: 0
    .map-expand-controls
      position: absolute
      top: 28px
      right: 25px
      z-index: 1000
      display: flex
      gap: 6px
    .map-expand-controls .map-expand-btn
      position: static
      top: auto
      right: auto
  `]
})
export class MaximisableMapComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private uiActions = inject(UiActionsService);
  private host = inject(ElementRef);
  private fullScreenPlaceholder: Comment | null = null;

  @Input() title = "";
  @Input() allowExpanded = true;
  @Input() syncToUrl = false;
  @Input() enabled = true;
  @Input() offsetTop = "28px";
  @Input() offsetRight = "25px";
  @Output() sizeChange = new EventEmitter<MaximisableMapState>();

  public expanded = false;
  public fullScreen = false;
  protected readonly faCompress = faCompress;
  protected readonly faExpand = faExpand;
  protected readonly faMaximize = faMaximize;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    if (this.syncToUrl) {
      this.subscriptions.push(this.route.queryParamMap.subscribe(paramMap => this.applyFromQuery(paramMap)));
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.restoreFromBody();
  }

  private teleportToBody(): void {
    const element: HTMLElement = this.host.nativeElement;
    if (!this.fullScreenPlaceholder && element?.parentNode) {
      this.fullScreenPlaceholder = document.createComment("maximisable-map-placeholder");
      element.parentNode.insertBefore(this.fullScreenPlaceholder, element);
      document.body.appendChild(element);
    }
  }

  private restoreFromBody(): void {
    const placeholder = this.fullScreenPlaceholder;
    if (placeholder?.parentNode) {
      placeholder.parentNode.insertBefore(this.host.nativeElement, placeholder);
      placeholder.remove();
    }
    this.fullScreenPlaceholder = null;
  }

  private get cycle3(): MaximisableMapState[] {
    return this.allowExpanded
      ? [{expanded: false, fullScreen: false}, {expanded: true, fullScreen: false}, {expanded: false, fullScreen: true}]
      : [{expanded: false, fullScreen: false}, {expanded: false, fullScreen: true}];
  }

  protected get cycleTooltip(): string {
    return this.expanded || !this.allowExpanded ? "Full screen" : "Expand map";
  }

  cycle(): void {
    const currentIndex = this.cycle3.findIndex(state => state.expanded === this.expanded && state.fullScreen === this.fullScreen);
    const next = this.cycle3[(currentIndex + 1) % this.cycle3.length];
    this.applyState(next.expanded, next.fullScreen);
  }

  restore(): void {
    this.applyState(false, false);
  }

  @HostListener("document:keydown.escape")
  exitFullScreen(): void {
    if (this.fullScreen) {
      this.applyState(false, false);
    }
  }

  private applyFromQuery(paramMap: ParamMap): void {
    const maximised = paramMap.get(StoredValue.MAXIMISE) === "true";
    const expanded = !maximised && paramMap.get(StoredValue.EXPANDED) === "true";
    this.applyState(expanded, maximised);
  }

  private applyState(expanded: boolean, fullScreen: boolean): void {
    if (this.expanded !== expanded || this.fullScreen !== fullScreen) {
      this.expanded = expanded;
      this.fullScreen = fullScreen;
      if (this.fullScreen) {
        this.teleportToBody();
      } else {
        this.restoreFromBody();
      }
      if (this.syncToUrl) {
        this.uiActions.updateQueryParameters({
          [StoredValue.EXPANDED]: this.expanded ? "true" : null,
          [StoredValue.MAXIMISE]: this.fullScreen ? "true" : null
        });
      }
      this.sizeChange.emit({expanded: this.expanded, fullScreen: this.fullScreen});
    }
  }
}
