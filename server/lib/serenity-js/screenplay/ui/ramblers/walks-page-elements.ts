import { By, PageElement, PageElements } from "@serenity-js/web";

export class WalksPageElements {

  public static authErrorMessage = PageElement.located(By.css(".auth0-global-message.auth0-global-message-error"))
    .describedAs("auth error message");

  public static userName = PageElement.located(By.css("input[type=email][name=email]"))
    .describedAs("user name");

  public static password = PageElement.located(By.css("input[type=password][name=password]"))
    .describedAs("password");

  public static loginSubmitButton = PageElement.located(By.css(".auth0-label-submit"))
    .describedAs("login submit button");

  public static createMenuDropdown = PageElement.located(By.id("walks_manager_create"))
    .describedAs("create menu dropdown");

  public static authHeader = PageElement.located(By.css(".auth0-lock-header-welcome"))
    .describedAs("auth header Frame");

  public static itemsPerPagePopup = PageElement.located(By.css("_lstPageSize-button > span.ui-selectmenu-status"))
    .describedAs("items per page popup");

  public static walkListTable = PageElement.located(By.css("#views-form-ramled-all-walks-events-all-walks-events table"))
    .describedAs("walk list view table");

  public static walkListTableRows = PageElements.located(By.css("#views-form-ramled-all-walks-events-all-walks-events table tbody tr"))
    .describedAs("ramblers walk table rows");

  public static showAllWalks = PageElement.located(By.css("_lstPageSize-button > span.ui-selectmenu-status"))
    .describedAs("show all walks");

  public static progressIndicator = PageElement.located(By.css("#updateprogress.progress"))
    .describedAs("progress indicator");

  public static progressIndicatorOrAlertMessage = PageElement.located(By.css("#updateprogress.progress,.alert-error,.alert-success"))
    .describedAs("progress indicator or alert message");

  public static loaderIndicator = PageElement.located(By.css("[src$='ajax-loader.gif']"))
    .describedAs("loader indicator");

  public static selectAll = PageElement.located(By.css("th.select-all input"))
    .describedAs("select all walks button");

  public static deleteSelected = PageElement.located(By.css("input[value=Delete][name=op]"))
    .describedAs("delete selected walks button");

  public static unPublishSelected = PageElement.located(By.css("input[value=Unpublish][name=op]"))
    .describedAs("Unpublish selected walks button");

  public static publishSelected = PageElement.located(By.css("input[value=Publish][name=op]"))
    .describedAs("Publish selected walks button");

  public static chooseFilesButton = PageElement.located(By.id("edit-walk-csv-upload"))
    .describedAs("Choose Files button");

  public static modalError = PageElement.located(By.css(".form-item--error-message"))
    .describedAs("Choose Files button");

  public static uploadAWalksCSV = PageElement.located(By.id("uploadWalkModal_open"))
    .describedAs("Upload a walk CSV");

  public static uploadWalksButton = PageElement.located(By.id("edit-submit-upload"))
    .describedAs("Upload walks");

  public static executeActionButton = PageElement.located(By.id("edit-submit"))
    .describedAs("Execute Action Button");

  public static cancelActionButton = PageElement.located(By.id("edit-cancel"))
    .describedAs("Cancel");

  public static errorAlert = PageElement.located(By.css(".alert-error"))
    .describedAs("Error Alert");

  public static successAlert = PageElement.located(By.css(".alert-success"))
    .describedAs("Success Alert");

  public static alertMessage = PageElement.located(By.css(".alert-error,.alert-success"))
    .describedAs("Alert Status Message");

  public static uploadErrorListItems = PageElements.located(By.css(".alert-error .item-list ul li"))
    .describedAs("Upload Error List Items");

  public static columnsForRow(result: PageElement) {
    return PageElements.located(By.css(".views-field-views-bulk-operations-bulk-form,.views-field-ramled-title-field,.views-field-field-date,.views-field-ram-content-moderation-views-field-states")
      .describedAs("columns for row"))
      .of(result);
  }

  public static tdsForRow(tableRow: PageElement) {
    return PageElements.located(By.tagName("td")
      .describedAs("columns(td) for row"))
      .of(tableRow);
  }

  public static hrefForRow(result: PageElement) {
    return PageElement.located(By.css(".views-field-ramled-title-field a").describedAs("anchor for row")).of(result);
  }

  public static emphasisedWithin(pageElement: PageElement) {
    return PageElement.located(By.tagName("em").describedAs("emphasised text")).of(pageElement);
  }

  public static cancelledRow(rowIndex: number, date: string) {
    return PageElement.located(By.css(`#views-form-ramled-all-walks-events-all-walks-events tr:nth-child(${rowIndex + 1}) .ramled-status-cancelled`))
      .describedAs(`Checkbox for ${date} walk`);
  }

  public static checkboxSelector(tableRow: PageElement, date: string) {
    return PageElement.located(By.css("[id^=edit-views-bulk-operations-bulk-form-]").describedAs(`Checkbox for ${date} walk`)).of(tableRow);
  }

}
