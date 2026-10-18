import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgOptionTemplateDirective, NgFooterTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { from, Observable, of, Subject } from "rxjs";
import { isString } from "es-toolkit/compat";
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from "rxjs/operators";
import { NgxLoggerLevel } from "ngx-logger";
import { AddressQueryService } from "../../services/walks/address-query.service";
import { RecentSearchesComponent } from "../../shared/components/recent-searches";
import { SearchHistoryDirective } from "../../shared/directives/search-history.directive";
import { StoredValue } from "../../models/ui-actions";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { GridReferenceLookupResponse } from "../../models/address-model";
import { LocationSuggestion } from "../../models/locate.model";
import { GridReferenceService } from "../../services/maps/grid-reference.service";
import { formattedUkPostcode, locationLabel } from "../../functions/locate";

@Component({
  selector: "app-location-autocomplete",
  imports: [SearchHistoryDirective, RecentSearchesComponent, FormsModule, NgFooterTemplateDirective, NgSelectComponent, NgOptionTemplateDirective, AsyncPipe],
  template: `
    <ng-select appSearchHistory #history="appSearchHistory" [searchHistoryKey]="StoredValue.LOCATION_SEARCH_RECENT"
      [items]="locationSuggestions$ | async"
      [typeahead]="locationInput$"
      [loading]="locationLoading"
      [multiple]="false"
      [searchable]="true"
      [clearable]="clearable"
      [editableSearchTerm]="true"
      [minTermLength]="minTermLength"
      [disabled]="disabled"
      dropdownPosition="bottom"
      bindLabel="label"
      [placeholder]="placeholder"
      [(ngModel)]="selectedLocation"
      (focus)="repeatSelectedSearch()"
      (ngModelChange)="onLocationSelected($event)">
      <ng-template ng-option-tmp let-item="item">
        <div>
          <strong>{{ item.label }}</strong>
        </div>
      </ng-template>
      <ng-template ng-footer-tmp>
        <app-recent-searches [storageKey]="StoredValue.LOCATION_SEARCH_RECENT" (searchSelected)="history.applyRecent($event)"/>
      </ng-template>
    </ng-select>
    @if (selectionRequired) {
      <small class="form-text text-muted" role="status">Choose a result from the list to set the location. Typing alone does not update the map.</small>
    }
  `
})
export class LocationAutocompleteComponent implements OnInit, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("LocationAutocompleteComponent", NgxLoggerLevel.ERROR);
  private addressQueryService = inject(AddressQueryService);
  protected readonly StoredValue = StoredValue;
  private gridReferences = inject(GridReferenceService);

  @Input() placeholder = "Enter UK postcode or place name...";
  @Input() disabled = false;
  @Input() clearable = true;
  @Input() minTermLength = 3;
  @Input() value: string | null = null;
  @Output() locationChange = new EventEmitter<GridReferenceLookupResponse>();

  locationInput$ = new Subject<string>();
  locationSuggestions$!: Observable<LocationSuggestion[]>;
  locationLoading = false;
  selectionRequired = false;
  selectedLocation: LocationSuggestion | null = null;

  ngOnInit() {
    this.setupLocationSearch();
    this.syncValueToSelection();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["value"] && !changes["value"].firstChange) {
      this.syncValueToSelection();
    }
  }

  private syncValueToSelection() {
    if (this.value && (!this.selectedLocation || this.selectedLocation.label !== this.value)) {
      this.selectedLocation = { label: this.value, lat: 0, lng: 0 };
    } else if (!this.value) {
      this.selectedLocation = null;
    }
  }

  private setupLocationSearch() {
    this.locationSuggestions$ = this.locationInput$.pipe(
      tap(term => this.logger.info(`Location search input: "${term}"`)),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => {
        this.locationLoading = true;
        this.selectionRequired = false;
      }),
      switchMap(term => {
        const point = term ? this.gridReferences.fromSearch(term) : null;
        if (!term || term.length < this.minTermLength) {
          this.locationLoading = false;
          return of([]);
        } else if (point) {
          this.locationLoading = false;
          return of([{
            label: point.gridReference10,
            lat: point.latitude,
            lng: point.longitude,
            gridReference6: point.gridReference6,
            gridReference8: point.gridReference8,
            gridReference10: point.gridReference10
          }]);
        } else {
          return this.remoteSuggestions(term);
        }
      }),
      tap(results => this.selectionRequired = results.length > 0)
    );
  }

  private remoteSuggestions(term: string): Observable<LocationSuggestion[]> {
    const lookup = formattedUkPostcode(term)
      ? from(this.addressQueryService.gridReferenceLookup(term)).pipe(
        switchMap(response => response?.latlng && !response.error
          ? of([this.toLocationSuggestion(response, term)])
          : this.placeSuggestions(term)),
        catchError(error => {
          this.logger.warn("Postcode lookup failed, trying place search:", error);
          return this.placeSuggestions(term);
        }))
      : this.placeSuggestions(term);
    return lookup.pipe(
      catchError(error => {
        this.logger.warn("Location search failed:", error);
        return of([]);
      }),
      tap(() => this.locationLoading = false)
    );
  }

  private placeSuggestions(term: string): Observable<LocationSuggestion[]> {
    return from(this.addressQueryService.venueSearch(term)).pipe(
      switchMap(results => results.length
        ? of(results.map(result => this.toLocationSuggestion({
          description: [result.name, result.address1, result.address2].filter(Boolean).join(", "),
          postcode: result.postcode,
          latlng: {lat: result.lat, lng: result.lon}
        }, term)))
        : this.placeNameSuggestions(term)),
      catchError(error => {
        this.logger.warn("Google Places search failed, trying place lookup:", error);
        return this.placeNameSuggestions(term);
      })
    );
  }

  private placeNameSuggestions(term: string): Observable<LocationSuggestion[]> {
    return from(this.addressQueryService.placeNameLookup(term)).pipe(
      map(response => response?.latlng && !response.error ? [this.toLocationSuggestion(response, term)] : []),
      catchError(error => {
        this.logger.warn("Place lookup failed:", error);
        return of([]);
      })
    );
  }

  private toLocationSuggestion(response: GridReferenceLookupResponse, fallback: string): LocationSuggestion {
    const postcode = formattedUkPostcode(response.postcode) || response.postcode;
    return {
      label: locationLabel(postcode, response.description, fallback),
      description: response.description,
      lat: response.latlng?.lat || 0,
      lng: response.latlng?.lng || 0,
      postcode,
      gridReference6: response.gridReference6,
      gridReference8: response.gridReference8,
      gridReference10: response.gridReference10
    };
  }

  onLocationSelected(location: LocationSuggestion | string | null) {
    if (isString(location)) {
      const query = location.trim();
      if (query) {
        this.remoteSuggestions(query).subscribe({
          next: suggestions => this.onLocationSelected(suggestions[0] || null),
          error: error => this.logger.error("Location lookup error:", error)
        });
      }
    } else if (location) {
      this.selectionRequired = false;
      this.logger.info(`Location selected:`, location);
      this.emitLookupResponse({
        description: location.description || location.label,
        latlng: { lat: location.lat, lng: location.lng },
        postcode: location.postcode,
        gridReference6: location.gridReference6,
        gridReference8: location.gridReference8,
        gridReference10: location.gridReference10
      }, location.label);
    }
  }

  private emitLookupResponse(response: GridReferenceLookupResponse, fallback: string) {
    if (response?.error) {
      this.logger.warn("Location lookup failed:", response.error);
    } else if (response) {
      this.locationChange.emit({
        ...response,
        description: response.description || fallback
      });
    }
  }

  clear() {
    this.selectedLocation = null;
  }

  repeatSelectedSearch(): void {
    if (this.selectedLocation?.label) {
      this.locationInput$.next(this.selectedLocation.label);
    }
  }
}
