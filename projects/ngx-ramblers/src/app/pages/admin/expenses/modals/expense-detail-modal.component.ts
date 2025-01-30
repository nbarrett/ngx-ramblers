import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import first from "lodash-es/first";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../../models/alert-target.model";
import { DateValue } from "../../../../models/date.model";
import { Confirm, EditMode } from "../../../../models/ui-actions";
import { ExpenseClaim, ExpenseItem, ExpenseType } from "../../../../notifications/expenses/expense.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { ExpenseDisplayService } from "../../../../services/expenses/expense-display.service";
import { FileUploadService } from "../../../../services/file-upload.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { NumberUtilsService } from "../../../../services/number-utils.service";
import { AwsFileUploadResponseData } from "../../../../models/aws-object.model";
import { DatePickerComponent } from "../../../../date-picker/date-picker.component";
import { FormsModule } from "@angular/forms";
import { NgClass, NgStyle } from "@angular/common";
import { FileUploadModule } from "ng2-file-upload";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { expenseTypeTracker } from "../../../../functions/trackers";

@Component({
    selector: "app-expense-detail-modal",
    templateUrl: "./expense-detail-modal.component.html",
    styleUrls: ["./expense-detail-modal.component.sass"],
    imports: [DatePickerComponent, FormsModule, NgClass, FileUploadModule, NgStyle, FontAwesomeModule]
})
export class ExpenseDetailModalComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ExpenseDetailModalComponent", NgxLoggerLevel.ERROR);
  private fileUploadService = inject(FileUploadService);
  bsModalRef = inject(BsModalRef);
  private notifierService = inject(NotifierService);
  display = inject(ExpenseDisplayService);
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
