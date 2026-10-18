import { Directive, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { outputToObservable } from "@angular/core/rxjs-interop";
import { NgSelectComponent } from "@ng-select/ng-select";
import { Subscription } from "rxjs";
import { StoredValue } from "../../models/ui-actions";
import { RecentSearchesService } from "../../services/search/recent-searches.service";

@Directive({selector: "ng-select[appSearchHistory]", exportAs: "appSearchHistory"})
export class SearchHistoryDirective implements OnInit, OnDestroy {
  @Input() searchHistoryKey = StoredValue.SITE_SEARCH_RECENT;
  private select = inject(NgSelectComponent);
  private history = inject(RecentSearchesService);
  private typedQuery = "";
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(
      outputToObservable(this.select.searchEvent).subscribe(event => this.typedQuery = event.term),
      outputToObservable(this.select.changeEvent).subscribe(selection => {
        if (selection && this.typedQuery) {
          this.history.addRecentSearch(this.typedQuery, this.searchHistoryKey);
          this.typedQuery = "";
        }
      })
    );
  }

  applyRecent(query: string): void {
    this.select.focus();
    this.select.filter(query);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
