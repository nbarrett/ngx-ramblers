import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { StoredValue } from "../../models/ui-actions";
import { RecentSearchesService } from "../../services/search/recent-searches.service";

@Component({
  selector: "app-recent-searches",
  imports: [AsyncPipe, FontAwesomeModule],
  styleUrls: ["../../modules/common/site-search/site-search-results.sass"],
  template: `
    @if (visible) {
      @if (searches$ | async; as searches) {
        @if (searches.length) {
          <div class="site-search-group-title">Recent searches</div>
          @for (term of searches; track term) {
            <button type="button" class="site-search-result site-search-recent" (click)="searchSelected.emit(term)">
              <fa-icon [icon]="faClockRotateLeft" class="me-2"/>{{ term }}
            </button>
          }
        }
      }
    }
  `
})
export class RecentSearchesComponent {
  private history = inject(RecentSearchesService);
  searches$ = this.history.events();
  @Input() visible = true;
  @Input() set storageKey(key: StoredValue) {
    this.searches$ = this.history.events(key);
  }
  @Output() searchSelected = new EventEmitter<string>();
  protected readonly faClockRotateLeft = faClockRotateLeft;
}
