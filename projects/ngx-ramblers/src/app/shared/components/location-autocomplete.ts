import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { from, Observable, of, Subject } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from "rxjs/operators";
import { NgxLoggerLevel } from "ngx-logger";
import { AddressQueryService } from "../../services/walks/address-query.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { GridReferenceLookupResponse } from "../../models/address-model";

export interface LocationSuggestion {
  label: string;
  lat: number;
  lng: number;
  postcode?: string;
  gridReference6?: string;
  gridReference8?: string;
  gridReference10?: string;
}

@Component({
  selector: "app-location-autocomplete",
  standalone: true,
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
        if (!term || term.length < this.minTermLength) {
          this.locationLoading = false;
          return of([]);
        }

        const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i;
        if (ukPostcodeRegex.test(term.trim())) {
          this.logger.info(`Searching postcode: ${term}`);
          return from(this.addressQueryService.gridReferenceLookup(term)).pipe(
            map(response => [this.toLocationSuggestion(response, term)]),
            tap(results => this.logger.info(`Postcode found:`, results)),
            catchError(error => {
              this.logger.warn("Postcode not found, trying place name search:", error);
              return from(this.addressQueryService.placeNameLookup(term)).pipe(
                map(response => [this.toLocationSuggestion(response, term)])
              );
            }),
            tap(() => this.locationLoading = false)
          );
        }

        this.logger.info(`Searching address: ${term}`);
        return from(this.addressQueryService.placeNameLookup(term)).pipe(
          map(response => [this.toLocationSuggestion(response, term)]),
          tap(results => this.logger.info(`Address search returned ${results.length} results`)),
          tap(() => this.locationLoading = false),
          catchError(error => {
            this.logger.error("Location search error:", error);
            this.locationLoading = false;
            return of([]);
          })
        );
      })
    );
  }

  private toLocationSuggestion(response: GridReferenceLookupResponse, fallback: string): LocationSuggestion {
    return {
      label: response.description || response.postcode || fallback,
      lat: response.latlng?.lat || 0,
      lng: response.latlng?.lng || 0,
      postcode: response.postcode,
      gridReference6: response.gridReference6,
      gridReference8: response.gridReference8,
      gridReference10: response.gridReference10
    };
  }

  onLocationSelected(location: LocationSuggestion | null) {
    if (!location) {
      return;
    }
    this.logger.info(`Location selected:`, location);
    const response: GridReferenceLookupResponse = {
      description: location.label,
      latlng: { lat: location.lat, lng: location.lng },
      postcode: location.postcode,
      gridReference6: location.gridReference6,
      gridReference8: location.gridReference8,
      gridReference10: location.gridReference10
    };
    this.locationChange.emit(response);
  }

  clear() {
    this.selectedLocation = null;
  }
}
