import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { isString, kebabCase } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";

export interface SectionToggleTab {
  value: string;
  label: string;
  icon?: IconDefinition;
}

@Component({
  selector: "app-section-toggle",
  standalone: true,
  imports: [FontAwesomeModule],
  host: {
    "[class.full-width-host]": "fullWidth"
  },
  styles: [`
    :host.full-width-host
      display: contents
    .section-toggle
      margin-bottom: 0.75rem
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
    .section-toggle .btn:last-child
      border-right: none
    .section-toggle .btn.btn-outline-ramblers
      color: var(--ramblers-colour-sunset)
      background-color: #fff
    .section-toggle .btn.btn-outline-ramblers:hover,
    .section-toggle .btn.btn-outline-ramblers:focus
      background-color: var(--ramblers-colour-sunrise)
      color: var(--ramblers-colour-black)
  `],
  template: `
    <div class="btn-group section-toggle" [class.full-width]="fullWidth" role="group">
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

  @Input() set tabs(value: (T | SectionToggleTab)[]) {
    this._tabs = value;
    this.syncTabFromQueryParams();
  }

  get tabs(): (T | SectionToggleTab)[] {
    return this._tabs;
  }

  @Input() selectedTab: T;
  @Input() queryParamKey: string | null = null;
  @Input() fullWidth = false;
  @Input() disabled = false;
  @Output() selectedTabChange = new EventEmitter<T>();

  get normalizedTabs(): SectionToggleTab[] {
    return this._tabs.map(tab => {
      if (isString(tab)) {
        return { value: tab, label: tab };
      }
      return tab;
    });
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
    const tabParam = this.latestQueryParams[this.queryParamKey];
    if (tabParam) {
      const matchedTab = this.normalizedTabs.find(tab => kebabCase(tab.value) === tabParam);
      if (matchedTab && this.selectedTab !== matchedTab.value) {
        Promise.resolve().then(() => {
          this.selectedTab = matchedTab.value as T;
          this.selectedTabChange.emit(matchedTab.value as T);
        });
      }
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
        queryParams: { [this.queryParamKey]: kebabCase(tabValue) },
        queryParamsHandling: "merge"
      });
    }
  }
}
