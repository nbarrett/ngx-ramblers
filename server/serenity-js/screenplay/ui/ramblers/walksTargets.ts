import { Target } from "@serenity-js/protractor";
import { TargetElement, TargetElements } from "@serenity-js/protractor/lib/screenplay/questions/targets";
import { by, ElementArrayFinder, ElementFinder } from "protractor";

export class WalksTargets {

  public static loginTab: TargetElement = Target.the("login tab")
    .located(by.css(".auth0-lock-tabs-current"));

  public static userName: TargetElement = Target.the("user name")
    .located(by.css("input[type=email][name=email]"));

  public static password: TargetElement = Target.the("password")
    .located(by.css("input[type=password][name=password]"));

  public static loginSubmitButton: TargetElement = Target.the("login submit button")
    .located(by.css(".auth0-label-submit"));

  public static createDropdown: TargetElement = Target.the("Create Menu dropdown")
    .located(by.id("walks_manager_create"));

  public static authHeader: TargetElement = Target.the("Auth Header Frame")
    .located(by.css(".auth0-lock-header-welcome"));

  public static itemsPerPagePopup: TargetElement = Target.the("items per page popup")
    .located(by.css("_lstPageSize-button > span.ui-selectmenu-status"));

  public static walkListviewTable: TargetElement = Target.the("items per page")
    .located(by.css("#views-form-ramled-all-walks-events-all-walks-events table tbody"));

  public static showAllWalks: TargetElement = Target.the("show all walks")
    .located(by.css("_lstPageSize-button > span.ui-selectmenu-status"));

  public static walkListviewTableRows: TargetElements = Target.all("ramblers walk table rows")
    .located(by.css("#views-form-ramled-all-walks-events-all-walks-events table tbody tr"));

  public static progressIndicator: TargetElement = Target.the("progress indicator")
    .located(by.css("#updateprogress.progress"));

  public static loaderIndicator: TargetElement = Target.the("loader indicator")
    .located(by.css("[src$='ajax-loader.gif']"));

  public static selectAll: TargetElement = Target.the("select all walks button")
    .located(by.css("th.select-all input"));

  public static deleteSelected: TargetElement = Target.the("delete selected walks button")
    .located(by.css("input[value=Delete][name=op]"));

  public static unPublishSelected: TargetElement = Target.the("Unpublish selected walks button")
    .located(by.css("input[value=Unpublish][name=op]"));

  public static publishSelected: TargetElement = Target.the("Publish selected walks button")
    .located(by.css("input[value=Publish][name=op]"));

  public static chooseFilesButton: TargetElement = Target.the("Choose Files button")
    .located(by.id("edit-walk-csv-upload"));

  public static uploadAWalksCSV: TargetElement = Target.the("Upload a walk CSV")
    .located(by.id("uploadWalkModal_open"));

  public static uploadWalksButton: TargetElement = Target.the("Upload walks")
    .located(by.id("edit-submit-upload"));

  public static executeActionButton: TargetElement = Target.the("Execute Action Button")
    .located(by.id("edit-submit"));

  public static cancelActionButton: TargetElement = Target.the("Cancel")
    .located(by.id("edit-cancel"));

  public static errorAlert: TargetElement = Target.the("Error Alert")
    .located(by.css(".alert-error"));

  public static successAlert: TargetElement = Target.the("Success Alert")
    .located(by.css(".alert-success"));

  public static alertMessage: TargetElement = Target.the("Alert Status Message")
    .located(by.css(".alert-error,.alert-success"));

  public static uploadErrorList: TargetElements = Target.all("Upload Error List Parent")
    .located(by.css(".alert-error .item-list ul"));

  public static uploadErrorSummary: TargetElements = Target.all("Upload result table rows")
    .located(by.css(".alert-error .item-list h3"));

  public static columnsForRow(result: ElementFinder): ElementArrayFinder {
    return result.all(by.css(".views-field-views-bulk-operations-bulk-form,.views-field-ramled-title-field,.views-field-field-date,.views-field-ram-content-moderation-views-field-states"));
  }

  public static hrefForRow(result: ElementFinder): ElementFinder {
    return result.element(by.css(".views-field-ramled-title-field a"));
  }

  public static cancelledRow(rowIndex: number, date: string): TargetElement {
    return Target.the(`Checkbox for ${date} walk`).located(by.css(`#views-form-ramled-all-walks-events-all-walks-events tr:nth-child(${rowIndex + 1}) .ramled-status-cancelled`));
  }

  public static checkboxSelector(rowIndex: number, date: string): TargetElement {
    return Target.the(`Checkbox for ${date} walk`)
      .located(by.id(`edit-views-bulk-operations-bulk-form-${rowIndex}`));
  }
}
