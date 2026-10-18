import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { AsyncPipe, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgHeaderTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { from, Observable, of, Subject, Subscription } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap, tap } from "rxjs/operators";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { RecentSearchesComponent } from "../../../shared/components/recent-searches";
import { SearchHistoryDirective } from "../../../shared/directives/search-history.directive";
import { StoredValue } from "../../../models/ui-actions";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { VenueService } from "../../../services/venue/venue.service";
import { GeoDistanceService } from "../../../services/maps/geo-distance.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { UK_POSTCODE_PATTERN } from "../../../models/locate.model";
import { withoutTrailingPostcode } from "../../../functions/locate";
import { PlaceNameChoiceComponent } from "../../../shared/components/place-name-choice";
import { PlaceNameChoice, VenueSource, VenueTypeValue, VenueWithDistance, VenueWithUsageStats } from "../../../models/event-venue.model";
import { placeNameChoiceFor } from "../../../functions/venue";
import { VenueIconPipe } from "../../../pipes/venue-icon.pipe";

@Component({
  selector: "app-venue-autocomplete",
  imports: [SearchHistoryDirective, RecentSearchesComponent, FormsModule, NgHeaderTemplateDirective, NgSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective, AsyncPipe, DecimalPipe, FontAwesomeModule, VenueIconPipe, PlaceNameChoiceComponent],
  template: `
    <ng-select #select appSearchHistory #history="appSearchHistory" [searchHistoryKey]="StoredValue.LOCATION_SEARCH_RECENT"
      [items]="venueSuggestions$ | async"
      [typeahead]="venueInput$"
      [loading]="venueLoading"
      [multiple]="false"
      [searchable]="true"
      [editableSearchTerm]="true"
      [clearable]="clearable"
      [minTermLength]="minTermLength"
      [disabled]="disabled"
      dropdownPosition="bottom"
      bindLabel="ngSelectLabel"
      [placeholder]="placeholder"
      [(ngModel)]="selectedVenue"
      (focus)="repeatSelectedSearch()"
      (ngModelChange)="onVenueSelected($event)"
      [inputAttrs]="{ autocomplete: 'one-time-code', 'data-lpignore': 'true', 'data-form-type': 'other' }">
      <ng-template ng-label-tmp let-item="item">
        <fa-icon [icon]="item.type | toVenueIcon" class="colour-mintcake me-2"></fa-icon>
        <span>{{ venueLabel(item) }}</span>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <div class="venue-option">
          @if (item.source === VenueSource.GOOGLE) {
            <fa-icon [icon]="faGoogle" class="venue-icon text-danger me-2" title="From Google Places"></fa-icon>
          } @else {
            <fa-icon [icon]="item.type | toVenueIcon" class="venue-icon colour-mintcake me-2"></fa-icon>
          }
          <div class="venue-details">
            <div class="venue-name">{{ item.name }}</div>
            <div class="venue-address-row">
              <span class="venue-address text-muted small">{{ venueAddress(item) }}</span>
              @if (item.distance !== null && item.distance !== undefined) {
                <span class="badge distance-badge ms-2" title="Distance from starting point">{{ item.distance | number:'1.1-1' }} mi</span>
              }
              @if (item.source === VenueSource.GOOGLE) {
                <span class="badge bg-danger ms-2" title="From Google Places">Google</span>
              }
            </div>
          </div>
        </div>
      </ng-template>
      <ng-template ng-header-tmp>
        <app-recent-searches [visible]="showRecentSearches" [storageKey]="StoredValue.LOCATION_SEARCH_RECENT" (searchSelected)="history.applyRecent($event)"/>
      </ng-template>
    </ng-select>
    @if (showSelectionHint && selectionRequired) {
      <small class="form-text text-muted" role="status">Choose a result from the list to set the location. Typing alone does not update the map.</small>
    } @else if (showSelectionHint && selectedVenue) {
      <small class="form-text text-muted">Edit this text to search again, then choose a replacement result.</small>
    }
    <app-place-name-choice [choice]="placeNameChoice" (keep)="keepTypedPlaceName()" (useResult)="useResultPlaceName()"/>
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
    :host ::ng-deep .ng-dropdown-header
      background: #fff
      border-bottom: 1px solid var(--rsm-border, #d9dee3)
      padding: 0.25rem 0.5rem 0.5rem
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
  private addressQueryService = inject(AddressQueryService);
  protected readonly StoredValue = StoredValue;
  private subscriptions: Subscription[] = [];

  faGoogle = faGoogle;
  protected VenueSource = VenueSource;

  @Input() placeholder = "Type venue name to search...";
  @Input() showSelectionHint = true;
  @Input() disabled = false;
  @Input() clearable = true;
  @Input() minTermLength = 2;
  @Input() startingPoint: { latitude: number; longitude: number } | null = null;
  @Input() set initialVenue(venue: Partial<VenueWithUsageStats> | null) {
    if (venue?.name) {
      this.applyingInitial = true;
      this.selectedVenue = {
        ...venue,
        ngSelectLabel: venue.enteredName || venue.ngSelectLabel || VenueService.buildNgSelectLabel(venue),
        usageCount: venue.usageCount || 0,
        type: venue.type || this.venueService.inferVenueType(venue.name)
      } as VenueWithDistance;
      setTimeout(() => {
        this.applyingInitial = false;
      }, 0);
    }
  }
  @Output() venueSelected = new EventEmitter<VenueWithUsageStats>();

  venueInput$ = new Subject<string>();
  venueSuggestions$!: Observable<VenueWithDistance[]>;
  venueLoading = false;
  selectionRequired = false;
  showRecentSearches = true;
  selectedVenue: VenueWithDistance | null = null;
  placeNameChoice: PlaceNameChoice | null = null;
  @ViewChild("select") private select: NgSelectComponent;
  private applyingInitial = false;
  private lastSearchTerm = "";

  ngOnInit() {
    this.setupVenueSearch();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  venueLabel(item: { name?: string; address1?: string; postcode?: string; enteredName?: string; ngSelectLabel?: string }): string {
    const entered = (item?.enteredName || "").trim();
    if (entered) {
      return entered;
    } else if ((item?.ngSelectLabel || "").trim()) {
      return item.ngSelectLabel.trim();
    } else {
      return VenueService.buildNgSelectLabel(item);
    }
  }

  venueAddress(item: { name?: string; address1?: string; postcode?: string }): string {
    return VenueService.buildNgSelectLabel({address1: item?.address1, postcode: item?.postcode});
  }

  private setupVenueSearch() {
    this.venueSuggestions$ = this.venueInput$.pipe(
      tap(term => {
        const typed = (term || "").trim();
        if (!this.applyingInitial && typed && typed !== this.selectedVenue?.ngSelectLabel && typed !== this.selectedVenue?.enteredName) {
          this.lastSearchTerm = typed;
        }
        this.logger.info(`Venue search input: "${term}"`);
      }),
      debounceTime(300),
      distinctUntilChanged(),
      startWith(""),
      tap(() => {
        this.venueLoading = true;
        this.selectionRequired = false;
      }),
      switchMap(term => {
        const query = (term || "").trim();
        if (query && query !== this.selectedVenue?.ngSelectLabel) {
          this.lastSearchTerm = query;
        }
        return this.venueService.venues().pipe(
          switchMap(venues => {
            let storedResults: VenueWithUsageStats[];
            if (!term || term.length < this.minTermLength) {
              storedResults = [...venues];
            } else {
              storedResults = this.venueService.searchVenues(term);
            }
            const sortedStored = this.sortByProximity(storedResults).slice(0, 15);
            if (term && UK_POSTCODE_PATTERN.test(term.trim())) {
              return from(this.addressQueryService.gridReferenceLookup(term)).pipe(
                map(response => {
                  const fromPostcode = this.venueFromPostcodeLookup(response, term);
                  return fromPostcode ? [fromPostcode, ...sortedStored] : sortedStored;
                }),
                catchError(() => of(sortedStored))
              );
            } else if (sortedStored.length >= 3 || !term || term.length < 3) {
              return of(sortedStored);
            } else {
              const lat = this.startingPoint?.latitude;
              const lon = this.startingPoint?.longitude;
              return from(this.addressQueryService.venueSearch(term, lat, lon)).pipe(
                map(googleResults => {
                  const googleVenues = googleResults.map(r => this.mapGoogleResultToVenue(r));
                  const deduplicatedGoogle = this.removeDuplicates(googleVenues, sortedStored);
                  const combinedResults = [...sortedStored, ...this.sortByProximity(deduplicatedGoogle).slice(0, 10)];
                  return combinedResults;
                }),
                catchError(err => {
                  this.logger.error("Google Places search failed:", err);
                  return of(sortedStored);
                })
              );
            }
          }),
          map(results => results.map(venue => ({...venue, ngSelectLabel: VenueService.buildNgSelectLabel(venue)}))),
          tap(results => {
            this.logger.info(`Venue search returned ${results.length} results`);
            this.selectionRequired = !!term && term.length >= this.minTermLength && results.length > 0;
            this.showRecentSearches = !this.selectionRequired;
          }),
          tap(() => this.venueLoading = false)
        );
      })
    );
  }

  private venueFromPostcodeLookup(response: { description?: string; postcode?: string; latlng?: { lat: number; lng: number }; error?: string }, term: string): VenueWithDistance | null {
    if (response?.error || !response?.latlng) {
      return null;
    } else {
      return {
        name: response.description || term.toUpperCase(),
        address1: null,
        address2: null,
        postcode: response.postcode || term.toUpperCase(),
        lat: response.latlng.lat,
        lon: response.latlng.lng,
        url: null,
        type: VenueTypeValue.LOCATION,
        usageCount: 0,
        source: VenueSource.STORED,
        distance: this.calculateDistanceFromLatLon(response.latlng.lat, response.latlng.lng)
      } as VenueWithDistance;
    }
  }

  private mapGoogleResultToVenue(result: any): VenueWithDistance {
    return {
      name: result.name,
      address1: result.address1,
      address2: result.address2,
      postcode: result.postcode,
      lat: result.lat,
      lon: result.lon,
      url: result.url,
      type: result.type || VenueTypeValue.OTHER,
      usageCount: 0,
      source: VenueSource.GOOGLE,
      distance: this.calculateDistanceFromLatLon(result.lat, result.lon)
    } as VenueWithDistance;
  }

  private calculateDistanceFromLatLon(lat: number, lon: number): number | null {
    if (!lat || !lon || !this.startingPoint) {
      return null;
    }
    return this.geoDistanceService.calculateDistanceMiles(
      this.startingPoint,
      { latitude: lat, longitude: lon }
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

  private removeDuplicates(googleVenues: VenueWithDistance[], storedVenues: VenueWithDistance[]): VenueWithDistance[] {
    return googleVenues.filter(googleVenue => {
      return !storedVenues.some(storedVenue => this.isDuplicate(googleVenue, storedVenue));
    });
  }

  private isDuplicate(venue1: VenueWithDistance, venue2: VenueWithDistance): boolean {
    const name1 = (venue1.name || "").toLowerCase().trim();
    const name2 = (venue2.name || "").toLowerCase().trim();
    const postcode1 = (venue1.postcode || "").toUpperCase().replace(/\s/g, "");
    const postcode2 = (venue2.postcode || "").toUpperCase().replace(/\s/g, "");

    if (name1 === name2 && postcode1 && postcode1 === postcode2) {
      return true;
    }

    if (venue1.lat && venue1.lon && venue2.lat && venue2.lon) {
      const distance = this.geoDistanceService.calculateDistanceMiles(
        { latitude: venue1.lat, longitude: venue1.lon },
        { latitude: venue2.lat, longitude: venue2.lon }
      );
      if (distance !== null && distance < 0.1) {
        return true;
      }
    }

    return false;
  }

  onVenueSelected(venue: VenueWithUsageStats | null) {
    if (venue && !this.applyingInitial) {
      this.selectionRequired = false;
      const enteredName = this.preservedSearchText();
      if (enteredName) {
        venue.enteredName = enteredName;
        venue.ngSelectLabel = enteredName;
        this.placeNameChoice = placeNameChoiceFor(enteredName, venue);
      } else {
        this.placeNameChoice = null;
      }
      this.selectedVenue = venue as VenueWithDistance;
      this.showTypedLabel(enteredName);
      this.logger.info("Venue selected:", venue);
      this.venueSelected.emit(venue);
    }
  }

  keepTypedPlaceName(): void {
    this.placeNameChoice = null;
  }

  useResultPlaceName(): void {
    if (this.selectedVenue && this.placeNameChoice) {
      const fromResult = this.placeNameChoice.fromResult;
      this.selectedVenue.enteredName = null;
      this.selectedVenue.ngSelectLabel = fromResult;
      this.placeNameChoice = null;
      this.showTypedLabel(fromResult);
      this.venueSelected.emit(this.selectedVenue);
    }
  }

  private preservedSearchText(): string {
    const typed = withoutTrailingPostcode(this.lastSearchTerm);
    if (!typed || typed.length < this.minTermLength || UK_POSTCODE_PATTERN.test(typed)) {
      return "";
    } else {
      return typed;
    }
  }

  private showTypedLabel(enteredName: string): void {
    if (enteredName) {
      setTimeout(() => {
        const input = this.select?.element?.querySelector("input") as HTMLInputElement;
        if (input) {
          input.value = enteredName;
        }
      }, 0);
    }
  }

  clear() {
    this.selectedVenue = null;
  }

  repeatSelectedSearch(): void {
    if (this.selectedVenue?.ngSelectLabel) {
      this.venueInput$.next(this.selectedVenue.ngSelectLabel);
    }
  }
}
