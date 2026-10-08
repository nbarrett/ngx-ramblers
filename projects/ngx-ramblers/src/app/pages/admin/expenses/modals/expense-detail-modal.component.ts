import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { first, isNumber, isString } from "es-toolkit/compat";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, map } from "rxjs/operators";
import { AlertTarget } from "../../../../models/alert-target.model";
import { DateValue } from "../../../../models/date.model";
import { Confirm, EditMode, StoredValue } from "../../../../models/ui-actions";
import { ExpenseClaim, ExpenseItem, ExpenseType } from "../../../../models/expense-claim.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { ExpenseDisplayService } from "../../../../services/expenses/expense-display.service";
import { FileUploadService } from "../../../../services/file-upload.service";
import { GoogleMapsService } from "../../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { NumberUtilsService } from "../../../../services/number-utils.service";
import { UiActionsService } from "../../../../services/ui-actions.service";
import { AwsFileUploadResponseData } from "../../../../models/aws-object.model";
import { GridReferenceLookupResponse } from "../../../../models/address-model";
import { LocationType } from "../../../../models/map.model";
import { LocationDetails } from "../../../../models/ramblers-walks-manager";
import { DatePicker } from "../../../../date-and-time/date-picker";
import { FormsModule } from "@angular/forms";
import { NgClass, NgStyle } from "@angular/common";
import { FileUploadModule } from "ng2-file-upload";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { expenseTypeTracker } from "../../../../functions/trackers";
import { formattedUkPostcode, locationLabel } from "../../../../functions/locate";
import { MapEditComponent } from "../../../walks/walk-edit/map-edit";
import { ResizerComponent, ResizerOrientation, ResizerVariant } from "../../../../modules/common/resizer/resizer";
import { asNumber } from "../../../../functions/numbers";
import { LocationAutocompleteComponent } from "../../../../shared/components/location-autocomplete";

@Component({
    selector: "app-expense-detail-modal",
    templateUrl: "./expense-detail-modal.component.html",
    styleUrls: ["./expense-detail-modal.component.sass"],
    imports: [DatePicker, FormsModule, NgClass, FileUploadModule, NgStyle, FontAwesomeModule, MapEditComponent, ResizerComponent, LocationAutocompleteComponent]
})
export class ExpenseDetailModalComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ExpenseDetailModalComponent", NgxLoggerLevel.ERROR);
  private fileUploadService = inject(FileUploadService);
  bsModalRef = inject(BsModalRef);
  private notifierService = inject(NotifierService);
  display = inject(ExpenseDisplayService);
  private googleMapsService = inject(GoogleMapsService);
  private uiActions = inject(UiActionsService);
  protected dateUtils = inject(DateUtilsService);
  private numberUtils = inject(NumberUtilsService);
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public expenseItem: ExpenseItem;
  public editable: boolean;
  public expenseClaim: ExpenseClaim;
  public editMode: EditMode;
  public confirm = new Confirm();
  uploadedFile: any;
  public expenseItemIndex: number;
  public hasFileOver = false;
  public uploader;
  private subscriptions: Subscription[] = [];
  protected readonly expenseTypeTracker = expenseTypeTracker;
  protected readonly LocationType = LocationType;
  protected readonly ResizerOrientation = ResizerOrientation;
  protected readonly ResizerVariant = ResizerVariant;
  public calculatingMiles = false;
  public travelFromLocation: LocationDetails = this.emptyTravelLocation();
  public travelToLocation: LocationDetails = this.emptyTravelLocation();
  public travelMapHeight = asNumber(this.uiActions.initialValueFor(StoredValue.EXPENSE_TRAVEL_MAP_HEIGHT)) || 260;
  private travelLocationChanges = new Subject<void>();

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  ngOnInit() {
    this.uploader = this.fileUploadService.createUploaderFor("expenseClaims");
    if (!this.editable) {
      this.uploader.options.allowedMimeType = [];
    }
    this.editMode = this.expenseItemIndex === -1 ? EditMode.ADD_NEW : EditMode.EDIT;
    this.logger.info("constructed:editMode", this.editMode, "expenseItem:", this.expenseItem, "expenseClaim:", this.expenseClaim);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.syncTravelLocationsFromFields();
    this.subscriptions.push(this.travelLocationChanges.pipe(
      debounceTime(500),
      map(() => this.travelLookupKey()),
      distinctUntilChanged()
    ).subscribe(key => {
      void this.refreshTravelDistance(key);
    }));
    void this.refreshTravelDistance(this.travelLookupKey());
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
        const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
        this.expenseItem.receipt = {
          title: awsFileUploadResponseData.fileNameData.originalFileName,
          awsFileName: awsFileUploadResponseData.fileNameData.awsFileName,
          originalFileName: awsFileUploadResponseData.uploadedFile.originalname
        };
        this.notify.success({title: "New receipt added", message: this.expenseItem.receipt.title});
      }
    ));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  expenseTypeComparer(item1: ExpenseType, item2: ExpenseType): boolean {
    return item1 && item2 ? item1.value === item2.value : item1 === item2;
  }

  browseToReceipt(expenseFileUpload: HTMLInputElement) {
    expenseFileUpload.click();
  }

  cancelExpenseChange() {
    this.bsModalRef.hide();
  }

  expenseTypeChange(expenseType: ExpenseType) {
    this.logger.debug("this.expenseClaim.expenseType", expenseType);
    if (expenseType.travel) {
      if (!this.expenseItem.travel) {
        this.expenseItem.travel = this.display.defaultExpenseItem().travel;
      }
      this.syncTravelLocationsFromFields();
    } else {
      this.expenseItem.travel = undefined;
      this.travelFromLocation = this.emptyTravelLocation();
      this.travelToLocation = this.emptyTravelLocation();
    }
    this.setExpenseItemFields();
  }

  saveExpenseClaim() {
    this.logger.debug("this.editMode", this.editMode);
    this.display.showExpenseProgressAlert(this.notify, "Saving expense claim", true);
    this.setExpenseItemFields();
    this.display.saveExpenseItem(this.editMode, this.confirm, this.notify, this.expenseClaim, this.expenseItem, this.expenseItemIndex)
      .then(() => this.bsModalRef.hide())
      .then(() => this.notify.clearBusy())
      .catch(error => this.display.showExpenseErrorAlert(this.notify, error));
  }

  setExpenseItemFields() {
    if (this.expenseItem) {
      if (this.expenseItem.travel) {
        this.expenseItem.travel.miles = this.numberUtils.asNumber(this.expenseItem.travel.miles);
      }
      this.expenseItem.description = this.display.expenseItemDescription(this.expenseItem);
      this.expenseItem.cost = this.display.expenseItemCost(this.expenseItem);
    }
    this.display.recalculateClaimCost(this.expenseClaim);
  }

  onTravelFromLookup(response: GridReferenceLookupResponse) {
    this.applyTravelLookup(response, true);
  }

  onTravelToLookup(response: GridReferenceLookupResponse) {
    this.applyTravelLookup(response, false);
  }

  onTravelFromPin(location: LocationDetails) {
    this.applyTravelPin(location, true);
  }

  onTravelToPin(location: LocationDetails) {
    this.applyTravelPin(location, false);
  }

  onTravelMapHeightChange(height: number) {
    this.travelMapHeight = height;
  }

  onTravelMapHeightResizeEnd() {
    this.uiActions.saveValueFor(StoredValue.EXPENSE_TRAVEL_MAP_HEIGHT, this.travelMapHeight);
  }

  showTravelMap(): boolean {
    return !!this.expenseItem?.expenseType?.travel;
  }

  private emptyTravelLocation(): LocationDetails {
    return {
      postcode: "",
      latitude: null,
      longitude: null,
      grid_reference_6: null,
      grid_reference_8: null,
      grid_reference_10: null,
      description: "",
      w3w: ""
    };
  }

  private locationFromField(value: string): LocationDetails {
    const location = this.emptyTravelLocation();
    const trimmed = isString(value) ? value.trim() : "";
    location.postcode = formattedUkPostcode(trimmed) || trimmed;
    location.description = formattedUkPostcode(trimmed) ? "" : trimmed;
    return location;
  }

  private travelFieldFrom(location: LocationDetails, fallback = ""): string {
    return locationLabel(location?.postcode, location?.description, fallback || location?.postcode || "");
  }

  private applyTravelLookup(response: GridReferenceLookupResponse, isFrom: boolean) {
    if (this.expenseItem?.travel && response) {
      const fallback = isFrom ? this.expenseItem.travel.from : this.expenseItem.travel.to;
      const location = this.locationFromLookup(response, fallback);
      const field = this.travelFieldFrom(location, fallback);
      if (isFrom) {
        this.travelFromLocation = location;
        this.expenseItem.travel.from = field;
      } else {
        this.travelToLocation = location;
        this.expenseItem.travel.to = field;
      }
      this.setExpenseItemFields();
      this.travelLocationChanges.next();
    }
  }

  private applyTravelPin(location: LocationDetails, isFrom: boolean) {
    if (this.expenseItem?.travel && location) {
      const field = this.travelFieldFrom(location);
      if (isFrom) {
        this.expenseItem.travel.from = field;
      } else {
        this.expenseItem.travel.to = field;
      }
      this.setExpenseItemFields();
      this.travelLocationChanges.next();
    }
  }

  private locationFromLookup(response: GridReferenceLookupResponse, fallback: string): LocationDetails {
    const location = this.emptyTravelLocation();
    const postcode = formattedUkPostcode(response.postcode) || (isString(response.postcode) ? response.postcode.trim() : "");
    location.postcode = postcode || fallback?.trim() || "";
    location.description = response.description || "";
    location.latitude = response.latlng?.lat ?? null;
    location.longitude = response.latlng?.lng ?? null;
    location.grid_reference_6 = response.gridReference6 || null;
    location.grid_reference_8 = response.gridReference8 || null;
    location.grid_reference_10 = response.gridReference10 || null;
    return location;
  }

  private travelCoords(location: LocationDetails): {lat: number; lng: number} | null {
    if (location?.latitude && location?.longitude) {
      return {lat: location.latitude, lng: location.longitude};
    } else {
      return null;
    }
  }

  private syncTravelLocationsFromFields() {
    const from = isString(this.expenseItem?.travel?.from) ? this.expenseItem.travel.from.trim() : "";
    const to = isString(this.expenseItem?.travel?.to) ? this.expenseItem.travel.to.trim() : "";
    if (this.expenseItem?.travel) {
      this.expenseItem.travel.from = formattedUkPostcode(from) || from;
      this.expenseItem.travel.to = formattedUkPostcode(to) || to;
    }
    this.travelFromLocation = this.locationFromField(this.expenseItem?.travel?.from);
    this.travelToLocation = this.locationFromField(this.expenseItem?.travel?.to);
  }

  private travelLookupKey(): string {
    const from = isString(this.expenseItem?.travel?.from) ? this.expenseItem.travel.from.trim() : "";
    const to = isString(this.expenseItem?.travel?.to) ? this.expenseItem.travel.to.trim() : "";
    return `${from}|${to}`;
  }

  private async refreshTravelDistance(key: string): Promise<void> {
    const from = isString(this.expenseItem?.travel?.from) ? this.expenseItem.travel.from.trim() : "";
    const to = isString(this.expenseItem?.travel?.to) ? this.expenseItem.travel.to.trim() : "";
    if (from && to && this.expenseItem?.travel) {
      this.calculatingMiles = true;
      try {
        const miles = await this.googleMapsService.drivingDistanceMiles(
          from,
          to,
          this.travelCoords(this.travelFromLocation),
          this.travelCoords(this.travelToLocation)
        );
        if (key === this.travelLookupKey() && isNumber(miles)) {
          this.expenseItem.travel.miles = miles;
          this.setExpenseItemFields();
        }
      } catch (error) {
        this.logger.warn("driving distance failed", error);
      } finally {
        if (key === this.travelLookupKey()) {
          this.calculatingMiles = false;
        }
      }
    } else {
      this.calculatingMiles = false;
    }
  }

  onExpenseDateChange(date: DateValue) {
    this.logger.debug("date", date);
    this.expenseItem.expenseDate = this.dateUtils.asValueNoTime(date);
  }

  removeReceipt() {
    this.expenseItem.receipt = undefined;
    this.notify.progress({title: "Expense receipt upload", message: "Removed"});
  }

  onFileSelect(files: File[]) {
    if (files?.length > 0) {
      this.notify.setBusy();
      this.notify.progress({title: "Expense receipt upload", message: `uploading ${first(files).name} - please wait...`});
    }
  }

  fileDropped($event: File[]) {
    this.logger.debug("fileDropped:", $event);
  }

  confirmDeleteExpenseItem(expenseClaim: ExpenseClaim, expenseItem: ExpenseItem, expenseItemIndex: number) {
    this.display.saveExpenseItem(EditMode.DELETE, this.confirm, this.notify, expenseClaim, expenseItem, expenseItemIndex)
      .then(() => this.bsModalRef.hide());
  }
}
