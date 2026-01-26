import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEdit, faTrash, faMapMarkerAlt, faPlus, faSearch, faSync, faMagic, faSortUp, faSortDown, faSort } from "@fortawesome/free-solid-svg-icons";
import { inferVenueTypeFromName, StoredVenue, VenueType } from "../../../../models/event-venue.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StoredVenueService } from "../../../../services/venue/stored-venue.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import { WalksReferenceService } from "../../../../services/walks/walks-reference-data.service";
import { VenueIconPipe } from "../../../../pipes/venue-icon.pipe";
import { AddressQueryService } from "../../../../services/walks/address-query.service";
import { PageComponent } from "../../../../page/page.component";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { VenueTypeSelect } from "../../../walks/walk-venue/venue-type-select";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { VenueEditorComponent } from "../../../walks/walk-venue/venue-editor";

@Component({
  selector: "app-venue-settings",
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, VenueIconPipe, PageComponent, VenueTypeSelect, TooltipDirective, MarkdownEditorComponent, TabsetComponent, TabDirective, VenueEditorComponent],
  styles: [`
    .table-container
      max-height: calc(100vh - 520px)
      overflow-y: auto
      overflow-x: hidden
      border: 1px solid #dee2e6
      border-radius: 4px
    th.sortable
      cursor: pointer
      user-select: none
    th.sortable:hover
      background-color: rgba(0, 0, 0, 0.05)
    th .sort-icon
      margin-left: 0.25rem
      opacity: 0.5
    th.sorted .sort-icon
      opacity: 1
    thead.sticky-top
      background-color: #f8f9fa
      border-top: 2px solid #dee2e6
      border-bottom: 2px solid #dee2e6
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)
    thead th
      font-weight: 600
      padding-top: 0.75rem
      padding-bottom: 0.75rem
  `],
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <tabset class="custom-tabset">
            <tab heading="Venue Management" [active]="true">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-markdown-editor standalone allowHide category="admin" name="venue-settings-help"/>
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <div class="text-muted small">{{ statusMessage }}</div>
                  <div class="d-flex gap-2">
                    <button class="btn btn-primary btn-sm" (click)="refreshVenues()" tooltip="Refresh venue list">
                      <fa-icon [icon]="faSync" class="me-1"></fa-icon>Refresh
                    </button>
                    <button class="btn btn-warning btn-sm" (click)="redetectTypes()" [disabled]="processing" tooltip="Re-detect venue types from names">
                      <fa-icon [icon]="faMagic" class="me-1"></fa-icon>Re-detect Types
                    </button>
                    <button class="btn btn-info btn-sm" (click)="geocodeAll()" [disabled]="processing" tooltip="Geocode all venues missing coordinates">
                      <fa-icon [icon]="faMapMarkerAlt" class="me-1"></fa-icon>Geocode All
                    </button>
                    <button class="btn btn-success btn-sm" (click)="addVenue()" tooltip="Add new venue">
                      <fa-icon [icon]="faPlus" class="me-1"></fa-icon>Add Venue
                    </button>
                  </div>
                </div>
                @if (editingVenue) {
                  <div class="mb-3">
                    <app-venue-editor
                      [venue]="editingVenue"
                      [heading]="editingVenue.id ? 'Edit venue' : 'Add new venue'"
                      [showActions]="true"
                      [showCoordinates]="true"
                      [saveButtonText]="editingVenue.id ? 'Save' : 'Create'"
                      [notify]="notify"
                      (save)="onEditorSave($event)"
                      (cancel)="cancelEdit()"/>
                  </div>
                }
                <div class="row mb-3">
                  <div class="col-sm-4">
                    <label class="form-label">Search</label>
                    <div class="input-group">
                      <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                      <input type="text" class="form-control" [(ngModel)]="searchTerm" placeholder="Search venues...">
                    </div>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">Filter by Type</label>
                    <app-venue-type-select
                      [value]="filterType"
                      (valueChange)="filterType = $event"
                      [clearable]="true"
                      placeholder="All types">
                    </app-venue-type-select>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">Stats</label>
                    <div class="form-control-plaintext">
                      {{ filteredVenues.length }} venues ({{ venuesWithCoordinates }} with coordinates)
                    </div>
                  </div>
                </div>
                <div class="table-responsive table-container">
                  <table class="table table-striped table-hover">
                    <thead class="sticky-top">
                    <tr>
                      <th style="width: 40px" class="sortable" [class.sorted]="sortField === 'type'"
                          (click)="toggleSort('type')">
                        Type
                        <fa-icon [icon]="getSortIcon('type')" class="sort-icon"></fa-icon>
                      </th>
                      <th class="sortable" [class.sorted]="sortField === 'name'" (click)="toggleSort('name')">
                        Name
                        <fa-icon [icon]="getSortIcon('name')" class="sort-icon"></fa-icon>
                      </th>
                      <th class="sortable" [class.sorted]="sortField === 'address1'" (click)="toggleSort('address1')">
                        Address
                        <fa-icon [icon]="getSortIcon('address1')" class="sort-icon"></fa-icon>
                      </th>
                      <th class="sortable" [class.sorted]="sortField === 'postcode'" (click)="toggleSort('postcode')">
                        Postcode
                        <fa-icon [icon]="getSortIcon('postcode')" class="sort-icon"></fa-icon>
                      </th>
                      <th style="width: 80px" class="sortable" [class.sorted]="sortField === 'usageCount'"
                          (click)="toggleSort('usageCount')">
                        Uses
                        <fa-icon [icon]="getSortIcon('usageCount')" class="sort-icon"></fa-icon>
                      </th>
                      <th style="width: 100px" class="sortable" [class.sorted]="sortField === 'createdAt'"
                          (click)="toggleSort('createdAt')">
                        Created
                        <fa-icon [icon]="getSortIcon('createdAt')" class="sort-icon"></fa-icon>
                      </th>
                      <th style="width: 100px" class="sortable" [class.sorted]="sortField === 'updatedAt'"
                          (click)="toggleSort('updatedAt')">
                        Updated
                        <fa-icon [icon]="getSortIcon('updatedAt')" class="sort-icon"></fa-icon>
                      </th>
                      <th style="width: 80px">Coords</th>
                      <th style="width: 120px">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                      @for (venue of filteredVenues; track venue.id) {
                        <tr [class.table-primary]="editingVenue?.id === venue.id">
                          <td>
                            <fa-icon [icon]="venue.type | toVenueIcon" class="colour-mintcake"></fa-icon>
                          </td>
                          <td>{{ venue.name }}</td>
                          <td>{{ venue.address1 }}</td>
                          <td>{{ venue.postcode }}</td>
                          <td class="text-center">
                            <span class="badge bg-primary">{{ venue.usageCount }}</span>
                          </td>
                          <td class="text-center small">
                            @if (venue.createdAt) {
                              {{ dateUtils.displayDate(venue.createdAt) }}
                            }
                          </td>
                          <td class="text-center small">
                            @if (venue.updatedAt) {
                              {{ dateUtils.displayDate(venue.updatedAt) }}
                            }
                          </td>
                          <td class="text-center">
                            @if (venue.lat && venue.lon) {
                              <span class="badge text-style-sunset" tooltip="{{venue.lat}}, {{venue.lon}}">Yes</span>
                            } @else {
                              <span class="badge bg-warning">No</span>
                            }
                          </td>
                          <td>
                            <div class="btn-group btn-group-sm">
                              <button class="btn btn-outline-ramblers" (click)="editVenue(venue)" tooltip="Edit venue"
                                      [disabled]="editingVenue">
                                <fa-icon [icon]="faEdit"></fa-icon>
                              </button>
                              <button class="btn btn-outline-ramblers" (click)="geocodeVenue(venue)"
                                      [disabled]="!venue.postcode || geocoding === venue.id || editingVenue"
                                      tooltip="Get coordinates from postcode">
                                <fa-icon [icon]="faMapMarkerAlt"></fa-icon>
                              </button>
                              <button class="btn btn-outline-ramblers" (click)="deleteVenue(venue)"
                                      [disabled]="editingVenue"
                                      tooltip="Delete venue">
                                <fa-icon [icon]="faTrash"></fa-icon>
                              </button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </tab>
          </tabset>
        </div>
      </div>
    </app-page>
  `
})
export class VenueSettingsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("VenueSettingsComponent", NgxLoggerLevel.ERROR);
  private storedVenueService = inject(StoredVenueService);
  private walksReferenceService = inject(WalksReferenceService);
  private addressQueryService = inject(AddressQueryService);
  private notifierService = inject(NotifierService);
  protected dateUtils = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];

  venues: StoredVenue[] = [];
  venueTypes: VenueType[];
  editingVenue: StoredVenue | null = null;
  searchTerm = "";
  filterType: VenueType | null = null;
  geocoding: string | null = null;
  processing = false;
  statusMessage = "";
  notify: AlertInstance;
  notifyTarget: AlertTarget = {};

  faEdit = faEdit;
  faTrash = faTrash;
  faMapMarkerAlt = faMapMarkerAlt;
  faPlus = faPlus;
  faSearch = faSearch;
  faSync = faSync;
  faMagic = faMagic;
  faSortUp = faSortUp;
  faSortDown = faSortDown;
  faSort = faSort;

  sortField: keyof StoredVenue | null = "name";
  sortDirection: "asc" | "desc" = "asc";

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.venueTypes = this.walksReferenceService.venueTypes();
    this.refreshVenues();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async refreshVenues() {
    this.logger.info("refreshVenues");
    try {
      this.venues = await this.storedVenueService.all();
      this.logger.info("Loaded", this.venues.length, "venues");
    } catch (error) {
      this.logger.error("Error loading venues:", error);
    }
  }

  get filteredVenues(): StoredVenue[] {
    const filtered = this.venues.filter(venue => {
      const matchesSearch = !this.searchTerm ||
        venue.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        venue.address1?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        venue.postcode?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesType = !this.filterType || venue.type === this.filterType.type;
      return matchesSearch && matchesType;
    });
    return this.sortVenues(filtered);
  }

  private sortVenues(venues: StoredVenue[]): StoredVenue[] {
    if (!this.sortField) return venues;
    return [...venues].sort((a, b) => {
      const aVal = a[this.sortField as keyof StoredVenue];
      const bVal = b[this.sortField as keyof StoredVenue];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      }
      return this.sortDirection === "asc" ? comparison : -comparison;
    });
  }

  toggleSort(field: keyof StoredVenue) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      this.sortDirection = "asc";
    }
  }

  getSortIcon(field: keyof StoredVenue) {
    if (this.sortField !== field) return this.faSort;
    return this.sortDirection === "asc" ? this.faSortUp : this.faSortDown;
  }

  get venuesWithCoordinates(): number {
    return this.venues.filter(v => v.lat && v.lon).length;
  }

  editVenue(venue: StoredVenue) {
    this.editingVenue = {...venue};
  }

  cancelEdit() {
    this.editingVenue = null;
  }

  async onEditorSave(venue: Partial<StoredVenue>) {
    this.logger.info("onEditorSave:", venue);
    try {
      if (venue.id) {
        await this.storedVenueService.update(venue as StoredVenue);
        this.statusMessage = `Venue "${venue.name}" updated`;
      } else {
        await this.storedVenueService.create(venue as StoredVenue);
        this.statusMessage = `Venue "${venue.name}" created`;
      }
      await this.refreshVenues();
      this.editingVenue = null;
    } catch (error) {
      this.logger.error("Error saving venue:", error);
      this.statusMessage = `Error saving venue: ${error}`;
    }
  }

  async deleteVenue(venue: StoredVenue) {
    if (!confirm(`Delete venue "${venue.name}"?`)) return;
    try {
      await this.storedVenueService.delete(venue);
      await this.refreshVenues();
    } catch (error) {
      this.logger.error("Error deleting venue:", error);
    }
  }

  async geocodeVenue(venue: StoredVenue) {
    if (!venue.postcode) return;
    this.geocoding = venue.id;
    try {
      const gridReference = await this.addressQueryService.gridReferenceLookup(venue.postcode);
      if (gridReference?.latlng?.lat && gridReference?.latlng?.lng) {
        await this.storedVenueService.updateCoordinates(venue.id, gridReference.latlng.lat, gridReference.latlng.lng);
        await this.refreshVenues();
        this.logger.info("Geocoded venue:", venue.name, "to", gridReference.latlng.lat, gridReference.latlng.lng);
      }
    } catch (error) {
      this.logger.error("Error geocoding venue:", error);
    } finally {
      this.geocoding = null;
    }
  }

  addVenue() {
    this.editingVenue = {
      name: "",
      address1: "",
      postcode: "",
      type: "other",
      usageCount: 0
    } as StoredVenue;
  }

  async redetectTypes() {
    this.processing = true;
    this.statusMessage = "Re-detecting venue types...";
    const venuesToUpdate = this.venues.filter(v => v.name);
    let updated = 0;
    for (let i = 0; i < venuesToUpdate.length; i++) {
      const venue = venuesToUpdate[i];
      const inferredType = inferVenueTypeFromName(venue.name);
      if (inferredType !== venue.type) {
        venue.type = inferredType;
        await this.storedVenueService.update(venue);
        updated++;
      }
      this.statusMessage = `Re-detecting types: ${i + 1}/${venuesToUpdate.length} (${updated} updated)`;
    }
    this.statusMessage = `Re-detected types: ${updated} venues updated`;
    this.logger.info(`Re-detected types for ${updated} venues`);
    await this.refreshVenues();
    this.processing = false;
  }

  async geocodeAll() {
    const venuesMissingCoords = this.venues.filter(v => v.postcode && (!v.lat || !v.lon));
    if (venuesMissingCoords.length === 0) {
      this.statusMessage = "All venues with postcodes already have coordinates";
      return;
    }
    this.processing = true;
    this.statusMessage = `Geocoding ${venuesMissingCoords.length} venues...`;
    let geocoded = 0;
    for (let i = 0; i < venuesMissingCoords.length; i++) {
      const venue = venuesMissingCoords[i];
      try {
        const gridReference = await this.addressQueryService.gridReferenceLookup(venue.postcode);
        if (gridReference?.latlng?.lat && gridReference?.latlng?.lng) {
          await this.storedVenueService.updateCoordinates(venue.id, gridReference.latlng.lat, gridReference.latlng.lng);
          geocoded++;
        }
      } catch (error) {
        this.logger.error(`Error geocoding venue ${venue.name}:`, error);
      }
      this.statusMessage = `Geocoding: ${i + 1}/${venuesMissingCoords.length} (${geocoded} successful)`;
    }
    this.statusMessage = `Geocoding complete: ${geocoded}/${venuesMissingCoords.length} venues updated`;
    await this.refreshVenues();
    this.processing = false;
  }
}
