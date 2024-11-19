import { Component, Input, OnInit } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { MeetupConfig } from "../../../models/meetup-config.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { WalkDisplayService } from "../walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MeetupService } from "../../../services/meetup.service";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import isEmpty from "lodash/isEmpty";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { NumberUtilsService } from "../../../services/number-utils.service";

@Component({
  selector: "app-walk-location-edit",
  template: `
    <div class="row">
      <div class="col-sm-6">
        <div class="form-group">
          <label for="post-code">{{ locationType }} Postcode</label>
          <input [disabled]="disabled" [(ngModel)]="locationDetails.postcode"
                 (ngModelChange)="postcodeChange()"
                 type="text" class="form-control input-sm" id="post-code"
                 placeholder="Enter Postcode here">
        </div>
      </div>
      <div class="col-sm-6">
        <div class="form-group">
          <label for="nearest-town">{{ locationType }} Location</label>
          <input [disabled]="disabled" [(ngModel)]="locationDetails.description"
                 type="text" class="form-control input-sm"
                 id="nearest-town"
                 placeholder="Enter {{locationType}} Location here">
        </div>
      </div>
      <div class="col-sm-6">
        <div class="form-group">
          <label for="grid-reference">{{ locationType }} Grid Reference</label>
          <div class="input-group">
            <input [disabled]="disabled"
                   [(ngModel)]="locationDetails.grid_reference_10"
                   type="text" class="form-control input-sm" id="grid-reference"
                   placeholder="Enter {{locationType}} Grid Reference here">
            <div class="input-group-append">
              <div class="input-group-text pointer">
                <div
                  (click)="viewGridReference(display.gridReferenceFrom(locationDetails))"
                  placement="top"
                  tooltip="View {{locationType}} Grid Reference position in gridreferencefinder.com">
                  <img src="/assets/images/local/grid-reference-finder.ico"/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-sm-6">
        <div class="form-group">
          <label for="post-code">{{ locationType }} Lat/Long</label>
          <div>{{ numberUtils.asNumber(locationDetails.latitude, 4) }}
            / {{ numberUtils.asNumber(locationDetails.longitude, 4) }}
          </div>
        </div>
      </div>
      <div class="col-sm-12">
        <div class="btn-group w-100 mb-2" role="group" aria-label="Toggle Google Maps View">
          <button type="button" class="btn btn-primary" [class.active]="!showGoogleMapsView"
                  (click)="showGoogleMapsView = false">
            {{ locationType }} Pin Location
          </button>
          <button type="button" class="btn btn-primary" [class.active]="showGoogleMapsView"
                  (click)="showGoogleMapsView = true">
            {{ locationType }} Location Google Map
          </button>
        </div>
        <ng-container *ngIf="showGoogleMapsView">
          <p>The map below is a preview of where postcode
            <strong>{{ locationDetails.postcode }}</strong>
            will appear on Google Maps. This map will be displayed in the detail view of the walk.</p>
          <input type="number" min="1" max="20" *ngIf="false"
                 [(ngModel)]="display.googleMapsConfig.zoomLevel">
          <iframe allowfullscreen class="map-thumbnail-image-dialog" style="border:0;border-radius: 10px;"
                  [src]="googleMapsUrl"></iframe>
        </ng-container>

        <ng-container *ngIf="!showGoogleMapsView && showLeafletView">
          <p>Use the map below to drag the pin to accurately pinpoint the location.</p>
          <app-map-edit [locationDetails]="locationDetails" [notify]="notify"/>
        </ng-container>
      </div>
    </div>`,
  styleUrls: ["./walk-edit.component.sass"]
})
export class WalkLocationEditComponent implements OnInit {

  @Input() public locationType!: string;
  @Input() public notify!: AlertInstance;

  @Input("disabled") set previewValue(disabled: boolean) {
    this.disabled = coerceBooleanProperty(disabled);
  }

  @Input("locationDetails")
  set initialiseWalk(locationDetails: LocationDetails) {
    this.logger.debug("cloning walk for edit");
    this.locationDetails = locationDetails;
  }

  public showLeafletView = true;
  public disabled: boolean;
  public locationDetails: LocationDetails;
  public meetupService: MeetupService;
  public googleMapsUrl: SafeResourceUrl;
  public walkDate: Date;
  protected logger: Logger;
  public meetupConfig: MeetupConfig;
  public faPencil = faPencil;
  public showGoogleMapsView = false;

  constructor(
    public googleMapsService: GoogleMapsService,
    private addressQueryService: AddressQueryService,
    public route: ActivatedRoute,
    protected dateUtils: DateUtilsService,
    public display: WalkDisplayService,
    public stringUtils: StringUtilsService,
    public numberUtils: NumberUtilsService,
    protected notifierService: NotifierService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkEditComponent", NgxLoggerLevel.INFO);
  }

  async ngOnInit() {
    this.logger.info("locationType:", this.locationType, "locationDetails:", this.locationDetails);
  }

  toggleGoogleOrLeafletMapView() {
    this.showGoogleMapsView = !this.showGoogleMapsView;
    setTimeout(() => {
      this.showGoogleMapsView = !this.showGoogleMapsView;
    }, 0);
  }

  toggleLeafletView() {
    this.showLeafletView = !this.showLeafletView;
    setTimeout(() => {
      this.showLeafletView = !this.showLeafletView;
    }, 0);
  }

  private updateGoogleMapsUrl() {
    this.googleMapsUrl = this.display.googleMapsUrl(false, this.locationDetails.postcode, this.locationDetails.postcode);
  }

  async postcodeChange() {
    this.locationDetails.longitude = null;
    this.locationDetails.latitude = null;
    this.locationDetails.grid_reference_6 = null;
    this.locationDetails.grid_reference_8 = null;
    this.locationDetails.grid_reference_10 = null;
    if (this.locationDetails.postcode.length >= 5) {
      const postcode = this.locationDetails.postcode;
      this.locationDetails.postcode = postcode?.toUpperCase()?.trim();
      this.locationDetails.grid_reference_10 = await this.lookupGridReferenceBasedOn(postcode);
      this.showLeafletView = true;
      this.toggleGoogleOrLeafletMapView();
      return this.updateGoogleMapsUrl();
    } else {
      this.toggleGoogleOrLeafletMapView();
      this.showLeafletView = false;
      this.updateGoogleMapsUrl();
      return Promise.resolve();
    }
  }

  private async lookupGridReferenceBasedOn(postcode: string): Promise<string> {
    this.notify.hide();
    this.logger.debug("postcodeChange:", postcode);
    if (isEmpty(postcode)) {
      return Promise.resolve(null);
    } else {
      const gridReferenceLookupResponse: GridReferenceLookupResponse = await this.addressQueryService.gridReferenceLookup(postcode);
      if (gridReferenceLookupResponse.error) {
        this.notify.error({
          continue: true,
          title: "Postcode error",
          message: `Lookup of postcode ${gridReferenceLookupResponse.postcode} failed due to '${gridReferenceLookupResponse.error}' error`
        });
      } else {
        return gridReferenceLookupResponse.gridReference;
      }
    }
  }

  viewGridReference(gridReference: string) {
    return window.open(this.display.gridReferenceLink(gridReference));
  }

}
