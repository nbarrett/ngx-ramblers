import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { kebabCase } from "es-toolkit/compat";

@Component({
  selector: "app-section-toggle",
  standalone: true,
  styles: [`
    .section-toggle
      margin-bottom: 0.75rem
      border: 2px solid var(--ramblers-colour-sunrise)
      border-radius: 0.375rem
      overflow: hidden
      display: inline-flex
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
    <div class="btn-group section-toggle" role="group">
      @for (tab of tabs; track tab) {
        <button type="button"
          class="btn"
          [class.btn-primary]="selectedTab === tab"
          [class.btn-outline-ramblers]="selectedTab !== tab"
          (click)="selectTab(tab)">
          {{ tab }}
        </button>
      }
    </div>
  `
})
export class SectionToggle<T extends string> implements OnInit, OnDestroy {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];

  @Input() tabs: T[] = [];
  @Input() selectedTab: T;
  @Input() queryParamKey: string | null = null;
  @Output() selectedTabChange = new EventEmitter<T>();

  ngOnInit() {
    if (this.queryParamKey) {
      this.subscriptions.push(
        this.activatedRoute.queryParams.subscribe(params => {
          const tabParam = params[this.queryParamKey];
          if (tabParam) {
            const matchedTab = this.tabs.find(tab => kebabCase(tab) === tabParam);
            if (matchedTab) {
              this.selectedTab = matchedTab;
              this.selectedTabChange.emit(matchedTab);
            }
          }
        })
      );
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  selectTab(tab: T) {
    this.selectedTab = tab;
    this.selectedTabChange.emit(tab);
    if (this.queryParamKey) {
      this.router.navigate([], {
        queryParams: { [this.queryParamKey]: kebabCase(tab) },
        queryParamsHandling: "merge"
      });
    }
  }
}
