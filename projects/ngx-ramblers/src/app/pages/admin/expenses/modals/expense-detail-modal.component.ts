import { DOCUMENT } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";
import first from "lodash-es/first";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../../auth/auth.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import { DateValue } from "../../../../models/date.model";
import { Confirm, EditMode } from "../../../../models/ui-actions";
import { ExpenseClaim, ExpenseItem, ExpenseType } from "../../../../notifications/expenses/expense.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { ExpenseClaimService } from "../../../../services/expenses/expense-claim.service";
import { ExpenseDisplayService } from "../../../../services/expenses/expense-display.service";
import { FileUploadService } from "../../../../services/file-upload.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { NumberUtilsService } from "../../../../services/number-utils.service";
import { StringUtilsService } from "../../../../services/string-utils.service";

@Component({
  selector: "app-expense-detail-modal",
  templateUrl: "./expense-detail-modal.component.html",
  styleUrls: ["./expense-detail-modal.component.sass"]
})
export class ExpenseDetailModalComponent implements OnInit, OnDestroy {

  constructor(@Inject(DOCUMENT) private document: Document,
              private fileUploadService: FileUploadService,
              public bsModalRef: BsModalRef,
              private authService: AuthService,
              private notifierService: NotifierService,
              private expenseClaimService: ExpenseClaimService,
              private stringUtils: StringUtilsService,
              private modalService: BsModalService,
              public display: ExpenseDisplayService,
              protected dateUtils: DateUtilsService,
              private numberUtils: NumberUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ExpenseDetailModalComponent, NgxLoggerLevel.OFF);
  }
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public expenseItem: ExpenseItem;
  public editable: boolean;
  private logger: Logger;
  public expenseClaim: ExpenseClaim;
  public editMode: EditMode;
  public confirm = new Confirm();
  uploadedFile: any;
  public expenseItemIndex: number;
  public hasFileOver = false;
  public uploader;
  private subscriptions: Subscription[] = [];

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  ngOnInit() {
    this.uploader = this.fileUploadService.createUploaderFor("expenseClaims");
    if (!this.editable) {
      this.uploader.options.allowedMimeType = [];
    }
    this.editMode = this.expenseItemIndex === -1 ? EditMode.ADD_NEW : EditMode.EDIT;
    this.logger.debug("constructed:editMode", this.editMode, "expenseItem:", this.expenseItem, "expenseClaim:", this.expenseClaim);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
        this.logger.debug("response", response, "type", typeof response);
        this.notify.clearBusy();
        if (response instanceof HttpErrorResponse) {
          this.notify.error({title: "Upload failed", message: response.error});
        } else if (response === "Unauthorized") {
          this.notify.error({title: "Upload failed", message: response + " - try logging out and logging back in again and trying this again."});
        } else {
          const uploadResponse = JSON.parse(response);
          this.expenseItem.receipt = uploadResponse.response.fileNameData;
          this.expenseItem.receipt.title = this.expenseItem.receipt.originalFileName;
          this.logger.debug("JSON response:", uploadResponse, "receipt:", this.expenseItem.receipt);
          this.notify.clearBusy();
          this.notify.success({title: "New receipt added", message: this.expenseItem.receipt.title});
        }
      }
    ));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  expenseTypeComparer(item1: ExpenseType, item2: ExpenseType): boolean {
    return item1 && item2 ? item1.value === item2.value : item1 === item2;
  }

  expenseTypeTracker(expenseType: ExpenseType) {
    return expenseType.value;
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
    } else {
      this.expenseItem.travel = undefined;
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
