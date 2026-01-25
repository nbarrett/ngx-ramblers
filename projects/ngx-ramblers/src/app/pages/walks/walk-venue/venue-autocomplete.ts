import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { AsyncPipe, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { Observable, Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, map, startWith, switchMap, tap } from "rxjs/operators";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { VenueService } from "../../../services/venue/venue.service";
import { GeoDistanceService } from "../../../services/maps/geo-distance.service";
import { VenueWithDistance, VenueWithUsageStats } from "../../../models/event-venue.model";
import { VenueIconPipe } from "../../../pipes/venue-icon.pipe";

@Component({
  selector: "app-venue-autocomplete",
  standalone: true,
  imports: [FormsModule, NgSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective, AsyncPipe, DecimalPipe, FontAwesomeModule, VenueIconPipe],
  template: `
    <ng-select
      [items]="venueSuggestions$ | async"
      [typeahead]="venueInput$"
      [loading]="venueLoading"
      [multiple]="false"
      [searchable]="true"
      [clearable]="clearable"
      [minTermLength]="minTermLength"
      [disabled]="disabled"
      dropdownPosition="bottom"
      bindLabel="ngSelectLabel"
      [placeholder]="placeholder"
      [(ngModel)]="selectedVenue"
      (ngModelChange)="onVenueSelected($event)"
      [inputAttrs]="{ autocomplete: 'off' }">
      <ng-template ng-label-tmp let-item="item">
        <fa-icon [icon]="item.type | toVenueIcon" class="colour-mintcake me-2"></fa-icon>
        <span>{{ item.name }}{{ item.address1 ? ', ' + item.address1 : '' }}{{ item.postcode ? ', ' + item.postcode : '' }}</span>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <div class="venue-option">
          <fa-icon [icon]="item.type | toVenueIcon" class="venue-icon colour-mintcake me-2"></fa-icon>
          <div class="venue-details">
            <div class="venue-name">{{ item.name }}</div>
            <div class="venue-address-row">
              <span class="venue-address text-muted small">{{ item.address1 }}{{ item.address1 && item.postcode ? ', ' : '' }}{{ item.postcode }}</span>
              @if (item.distance !== null && item.distance !== undefined) {
                <span class="badge distance-badge ms-2" title="Distance from starting point">{{ item.distance | number:'1.1-1' }} mi</span>
              }
            </div>
          </div>
        </div>
      </ng-template>
    </ng-select>
  `,
  styles: [`
    :host ::ng-deep .ng-select .ng-value-container
      display: flex !important
      align-items: center !important
    :host ::ng-deep .ng-select .ng-value-container .ng-value
      display: flex !important
      align-items: center !important
    :host ::ng-deep .ng-select .ng-value-container .ng-value fa-icon
      display: inline-flex !important
      margin-right: 0.5rem !important
    :host ::ng-deep .ng-select.ng-select-single .ng-select-container .ng-value-container .ng-value
      display: flex !important
      align-items: center !important
    .venue-option
      display: flex
      align-items: center
      padding: 4px 0
    .venue-icon
      flex-shrink: 0
      width: 28px
      text-align: center
    .venue-details
      flex: 1
      min-width: 0
    .venue-name
      font-weight: 500
    .venue-address-row
      display: flex
      align-items: center
      gap: 0.25rem
    .venue-address
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis
      flex-shrink: 1
      min-width: 0
    .venue-address-row .badge
      flex-shrink: 0
    :host ::ng-deep .distance-badge
      background-color: rgb(240, 128, 80)
      color: #fff
      font-weight: normal
      font-size: 0.75rem
  `]
})
export class VenueAutocompleteComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("VenueAutocompleteComponent", NgxLoggerLevel.ERROR);
  private venueService = inject(VenueService);
  private geoDistanceService = inject(GeoDistanceService);
  private subscriptions: Subscription[] = [];

  @Input() placeholder = "Search for previously used venue...";
  @Input() disabled = false;
  @Input() clearable = true;
  @Input() minTermLength = 2;
  @Input() startingPoint: { latitude: number; longitude: number } | null = null;
  @Input() set initialVenue(venue: Partial<VenueWithUsageStats> | null) {
    if (venue?.name) {
      this.selectedVenue = {
        ...venue,
        usageCount: venue.usageCount || 0,
        type: venue.type || this.venueService.inferVenueType(venue.name)
      } as VenueWithDistance;
    }
  }
  @Output() venueSelected = new EventEmitter<VenueWithUsageStats>();

  venueInput$ = new Subject<string>();
  venueSuggestions$!: Observable<VenueWithDistance[]>;
  venueLoading = false;
  selectedVenue: VenueWithDistance | null = null;

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
            let results: VenueWithUsageStats[];
            if (!term || term.length < this.minTermLength) {
              results = [...venues];
            } else {
              results = this.venueService.searchVenues(term);
            }
            return this.sortByProximity(results).slice(0, 20);
          }),
          tap(results => this.logger.info(`Venue search returned ${results.length} results`)),
          tap(() => this.venueLoading = false)
        );
      })
    );
  }

  private sortByProximity(venues: VenueWithUsageStats[]): VenueWithDistance[] {
    if (!this.startingPoint?.latitude || !this.startingPoint?.longitude) {
      return venues.map(venue => ({ ...venue, distance: null }));
    }

    return venues
      .map(venue => ({
        ...venue,
        distance: this.calculateDistance(venue)
      }))
      .sort((a, b) => {
        if (a.distance === null && b.distance === null) {
          return b.usageCount - a.usageCount;
        }
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }

  private calculateDistance(venue: VenueWithUsageStats): number | null {
    if (!venue.lat || !venue.lon || !this.startingPoint) {
      return null;
    }
    return this.geoDistanceService.calculateDistanceMiles(
      this.startingPoint,
      { latitude: venue.lat, longitude: venue.lon }
    );
  }

  onVenueSelected(venue: VenueWithUsageStats | null) {
    if (!venue) {
      return;
    }
    this.logger.info("Venue selected:", venue);
    this.venueSelected.emit(venue);
  }

  clear() {
    this.selectedVenue = null;
  }
}
