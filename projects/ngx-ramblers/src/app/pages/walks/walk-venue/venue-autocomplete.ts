import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { Observable, of, Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, map, startWith, switchMap, tap } from "rxjs/operators";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { VenueService } from "../../../services/venue/venue.service";
import { VenueWithUsageStats } from "../../../models/event-venue.model";
import { VenueIconPipe } from "../../../pipes/venue-icon.pipe";

@Component({
  selector: "app-venue-autocomplete",
  standalone: true,
  imports: [FormsModule, NgSelectComponent, NgOptionTemplateDirective, AsyncPipe, FontAwesomeModule, VenueIconPipe],
  template: `
    <ng-select
      [items]="venueSuggestions$ | async"
      [typeahead]="venueInput$"
      [loading]="venueLoading"
      [multiple]="false"
      [searchable]="true"
      [clearable]="clearable"
      [editableSearchTerm]="true"
      [minTermLength]="minTermLength"
      [disabled]="disabled"
      dropdownPosition="bottom"
      bindLabel="ngSelectLabel"
      [placeholder]="placeholder"
      [(ngModel)]="selectedVenue"
      (ngModelChange)="onVenueSelected($event)">
      <ng-template ng-option-tmp let-item="item">
        <div class="venue-option">
          <fa-icon [icon]="item.type | toVenueIcon" class="venue-icon me-2"></fa-icon>
          <div class="venue-details">
            <div class="venue-name">{{ item.name }}</div>
            <div class="venue-address text-muted small">
              {{ item.address1 }}{{ item.postcode ? ', ' + item.postcode : '' }}
              <span class="badge bg-secondary ms-1" title="Times used">{{ item.usageCount }}</span>
            </div>
          </div>
        </div>
      </ng-template>
    </ng-select>
  `,
  styles: [`
    .venue-option
      display: flex
      align-items: flex-start
      padding: 4px 0
    .venue-icon
      margin-top: 2px
      color: #666
    .venue-details
      flex: 1
      min-width: 0
    .venue-name
      font-weight: 500
    .venue-address
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis
  `]
})
export class VenueAutocompleteComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("VenueAutocompleteComponent", NgxLoggerLevel.ERROR);
  private venueService = inject(VenueService);
  private subscriptions: Subscription[] = [];

  @Input() placeholder = "Search for previously used venue...";
  @Input() disabled = false;
  @Input() clearable = true;
  @Input() minTermLength = 2;
  @Output() venueSelected = new EventEmitter<VenueWithUsageStats>();

  venueInput$ = new Subject<string>();
  venueSuggestions$!: Observable<VenueWithUsageStats[]>;
  venueLoading = false;
  selectedVenue: VenueWithUsageStats | null = null;

  ngOnInit() {
    this.setupVenueSearch();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private setupVenueSearch() {
    this.venueSuggestions$ = this.venueInput$.pipe(
      tap(term => this.logger.info(`Venue search input: "${term}"`)),
      debounceTime(200),
      distinctUntilChanged(),
      startWith(""),
      tap(() => this.venueLoading = true),
      switchMap(term => {
        return this.venueService.venues().pipe(
          map(venues => {
            if (!term || term.length < this.minTermLength) {
              return venues.slice(0, 20);
            }
            return this.venueService.searchVenues(term).slice(0, 20);
          }),
          tap(results => this.logger.info(`Venue search returned ${results.length} results`)),
          tap(() => this.venueLoading = false)
        );
      })
    );
  }

  onVenueSelected(venue: VenueWithUsageStats | null) {
    if (!venue) {
      return;
    }
    this.logger.info("Venue selected:", venue);
    this.venueSelected.emit(venue);
    this.selectedVenue = null;
  }

  clear() {
    this.selectedVenue = null;
  }
}
