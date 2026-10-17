import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { from, Observable, of, Subject } from "rxjs";
import { isString } from "es-toolkit/compat";
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from "rxjs/operators";
import { NgxLoggerLevel } from "ngx-logger";
import { AddressQueryService } from "../../services/walks/address-query.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { GridReferenceLookupResponse } from "../../models/address-model";
import { LocationSuggestion } from "../../models/locate.model";
import { GridReferenceService } from "../../services/maps/grid-reference.service";
import { formattedUkPostcode, locationLabel } from "../../functions/locate";

@Component({
  selector: "app-location-autocomplete",
  imports: [FormsModule, NgSelectComponent, NgOptionTemplateDirective, AsyncPipe],
  template: `
    <ng-select
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
      (ngModelChange)="onLocationSelected($event)">
      <ng-template ng-option-tmp let-item="item">
        <div>
          <strong>{{ item.label }}</strong>
        </div>
      </ng-template>
    </ng-select>
  `
})
export class LocationAutocompleteComponent implements OnInit, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("LocationAutocompleteComponent", NgxLoggerLevel.ERROR);
  private addressQueryService = inject(AddressQueryService);
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
      tap(() => this.locationLoading = true),
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
      })
    );
  }

  private remoteSuggestions(term: string): Observable<LocationSuggestion[]> {
    const lookup = formattedUkPostcode(term)
      ? from(this.addressQueryService.gridReferenceLookup(term)).pipe(catchError(error => {
        this.logger.warn("Postcode lookup failed, trying place search:", error);
        return from(this.addressQueryService.placeNameLookup(term));
      }))
      : from(this.addressQueryService.placeNameLookup(term));
    return lookup.pipe(
      map(response => response?.latlng && !response.error ? [this.toLocationSuggestion(response, term)] : []),
      catchError(error => {
        this.logger.warn("Location search failed:", error);
        return of([]);
      }),
      tap(() => this.locationLoading = false)
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
        from(this.addressQueryService.placeNameLookup(query)).subscribe({
          next: response => this.emitLookupResponse(response, query),
          error: error => this.logger.error("Location lookup error:", error)
        });
      }
    } else if (location) {
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
}
