import { booleanAttribute, Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { isString, kebabCase } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { StoredValue } from "../../models/ui-actions";
import { SectionToggleTab } from "../../models/section-toggle.model";

@Component({
  selector: "app-section-toggle",
  imports: [FontAwesomeModule],
  host: {
    "[class.full-width-host]": "fullWidth"
  },
  styles: [`
    :host.full-width-host
      display: contents
    .section-toggle
      border: 2px solid var(--ramblers-colour-sunrise)
      border-radius: 0.375rem
      overflow: hidden
      display: inline-flex
    .section-toggle.full-width
      flex: 1
      width: 100%
    .section-toggle.full-width .btn
      flex: 1
    .section-toggle .btn
      border: none
      border-radius: 0
      border-right: 2px solid var(--ramblers-colour-sunrise)
      white-space: nowrap
    .section-toggle .btn:last-child
      border-right: none
    .section-toggle-swatch
      width: 12px
      height: 12px
      border-radius: 3px
      display: inline-block
      margin-right: 0.35rem
      vertical-align: middle
    @media (max-width: 768px)
      .section-toggle.stack-on-mobile
        display: flex
        flex-direction: column
        width: 100%
      .section-toggle.stack-on-mobile .btn
        width: 100%
        border-right: none
        border-bottom: 2px solid var(--ramblers-colour-sunrise)
        justify-content: center
      .section-toggle.stack-on-mobile .btn:last-child
        border-bottom: none
  `],
  template: `
    <div class="btn-group section-toggle" [class.full-width]="fullWidth"
         [class.stack-on-mobile]="stackOnMobile" role="group">
      @for (tab of normalizedTabs; track tab.value) {
        <button type="button"
          class="btn"
          [class.btn-primary]="selectedTab === tab.value"
          [class.btn-outline-ramblers]="selectedTab !== tab.value"
          [disabled]="disabled"
          (click)="selectTab(tab.value)">
          @if (tab.icon) {
            <fa-icon [icon]="tab.icon" class="me-1"></fa-icon>
          }
          @if (tab.swatchColour) {
            <span class="section-toggle-swatch" [style.background-color]="tab.swatchColour"></span>
          }
          {{ tab.label }}
        </button>
      }
    </div>
  `
})
export class SectionToggle<T extends string> implements OnInit, OnDestroy {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];
  private latestQueryParams: Record<string, string> = {};
  private _tabs: (T | SectionToggleTab)[] = [];
  private _normalizedTabs: SectionToggleTab[] = [];
  private tabsSignature = "";

  @Input() set tabs(value: (T | SectionToggleTab)[]) {
    const next = value || [];
    const nextSignature = next.map(tab => isString(tab) ? tab : tab.value).join("|");
    if (nextSignature === this.tabsSignature) {
      return;
    }
    this.tabsSignature = nextSignature;
    this._tabs = next;
    this._normalizedTabs = next.map(tab => {
      if (isString(tab)) {
        return {value: tab, label: tab};
      }
      return tab;
    });
    this.syncTabFromQueryParams();
  }

  get tabs(): (T | SectionToggleTab)[] {
    return this._tabs;
  }

  @Input() selectedTab: T;
  @Input() queryParamKey: StoredValue | null = null;
  @Input({transform: booleanAttribute}) fullWidth = false;
  @Input({transform: booleanAttribute}) stackOnMobile = false;
  @Input({transform: booleanAttribute}) disabled = false;
  @Output() selectedTabChange = new EventEmitter<T>();

  get normalizedTabs(): SectionToggleTab[] {
    return this._normalizedTabs;
  }

  ngOnInit() {
    if (this.queryParamKey) {
      this.subscriptions.push(
        this.activatedRoute.queryParams.subscribe(params => {
          this.latestQueryParams = params;
          this.syncTabFromQueryParams();
        })
      );
    }
  }

  private syncTabFromQueryParams() {
    if (!this.queryParamKey) {
      return;
    }
    const queryKey = String(this.queryParamKey);
    const tabParam = this.latestQueryParams[queryKey];
    if (!tabParam) {
      return;
    }
    const matchedTab = this.normalizedTabs.find(tab => {
      const aliases = (tab.aliases ?? []).map(alias => kebabCase(alias));
      return kebabCase(tab.value) === tabParam || aliases.includes(tabParam);
    });
    if (!matchedTab) {
      return;
    }
    const canonical = kebabCase(matchedTab.value);
    if (this.selectedTab === matchedTab.value && canonical === tabParam) {
      return;
    }
    if (this.selectedTab !== matchedTab.value) {
      this.selectedTab = matchedTab.value as T;
      this.selectedTabChange.emit(matchedTab.value as T);
    }
    if (canonical !== tabParam) {
      this.router.navigate([], {
        queryParams: {[queryKey]: canonical},
        queryParamsHandling: "merge",
        replaceUrl: true
      });
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  selectTab(tabValue: string) {
    this.selectedTab = tabValue as T;
    this.selectedTabChange.emit(tabValue as T);
    if (this.queryParamKey) {
      this.router.navigate([], {
        queryParams: {[String(this.queryParamKey)]: kebabCase(tabValue)},
        queryParamsHandling: "merge",
        replaceUrl: true
      });
    }
  }
}
