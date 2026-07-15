import { By, PageElement, PageElements } from "@serenity-js/web";

export class WalksPageElements {

  public static cookieBannerContainer = PageElement.located(By.css(".cky-consent-container"))
    .describedAs("cookie banner accept button");

  public static cookieBannerAccept = PageElement.located(By.css(".cky-notice-btn-wrapper button.cky-btn.cky-btn-accept"))
    .describedAs("cookie banner accept button");

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

  public static loggedInWalksManagerPage = PageElement.located(By.css("body.user-logged-in.path-node.page-node-type-walks-manager-homepage"))
    .describedAs("logged in walks manager page");

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

  public static deleteSelected = PageElement.located(By.css("#vbo-action-form-wrapper input[data-vbo='vbo-action'][value='Delete']"))
    .describedAs("delete selected walks button");

  public static unPublishSelected = PageElement.located(By.css("#vbo-action-form-wrapper input[data-vbo='vbo-action'][value='Unpublish']"))
    .describedAs("Unpublish selected walks button");

  public static publishSelected = PageElement.located(By.css("#vbo-action-form-wrapper input[data-vbo='vbo-action'][value='Publish']"))
    .describedAs("Publish selected walks button");

  public static cancelSelected = PageElement.located(By.id("ramled_vbo_cancel_open"))
    .describedAs("Cancel selected walks button");

  public static uncancelSelected = PageElement.located(By.css("#vbo-action-form-wrapper input[data-vbo='vbo-action'][value='Uncancel']"))
    .describedAs("Uncancel selected walks button");

  public static cancelModal = PageElement.located(By.id("ramled_vbo_cancel"))
    .describedAs("Cancel walks modal");

  public static cancelReasonTextarea = PageElement.located(By.id("edit-cancel-reason"))
    .describedAs("Cancellation reason textarea");

  public static cancelSubmitButton = PageElement.located(By.id("edit-6--2"))
    .describedAs("Cancel submit button in modal");

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

  public static walkImagesFileInput = PageElement.located(By.css("input[type=file][multiple]"))
    .describedAs("walk images file input");

  public static walkImagesUploadProgress = PageElement.located(By.css(".ajax-progress, .ajax-progress-throbber"))
    .describedAs("walk images upload progress");

  public static walkImageAlternativeTextFields = PageElements.located(By.css("input[name*='[alt]']"))
    .describedAs("walk image alternative text fields");

  public static walkImageAlternativeTextField(index: number) {
    return PageElement.located(By.css(`input[name$='[${index}][alt]']`))
      .describedAs(`walk image ${index + 1} alternative text field`);
  }

  public static walkImageManagedRows = PageElements.located(By.css("table tr:has(input[name*='[alt]']):has(input[value='Remove']):has(a[href]:not([href$='#']))"))
    .describedAs("completed managed walk image rows");

  public static walkImageRemoveButtons = PageElements.located(By.css("table:has(input[name*='[alt]']) input[value='Remove']"))
    .describedAs("walk image remove buttons");

  public static walkImageRowLink(tableRow: PageElement) {
    return PageElement.located(By.css("a[href]:not([href$='#'])")).of(tableRow).describedAs("walk image file link");
  }

  public static walkImageRowAlternativeTextField(tableRow: PageElement) {
    return PageElement.located(By.css("input[name*='[alt]']")).of(tableRow).describedAs("walk image alternative text field");
  }

  public static walkImageRowRemoveButton(tableRow: PageElement) {
    return PageElement.located(By.css("input[value='Remove']")).of(tableRow).describedAs("walk image remove button");
  }

  public static walkImageRowWeightSelect(tableRow: PageElement) {
    return PageElement.located(By.css("select[name*='[_weight]']")).of(tableRow).describedAs("walk image display order");
  }

  public static walkTitleField = PageElement.located(By.id("edit-title-0-value"))
    .describedAs("walk title");

  public static walkDateField = PageElement.located(By.id("edit-field-date-0-value-date"))
    .describedAs("walk date");

  public static walkStartTimeField = PageElement.located(By.id("edit-field-date-0-value-time"))
    .describedAs("walk start time");

  public static walkDescriptionEditor = PageElement.located(By.css(".field--name-field-basic-description-2 .ck-editor__editable"))
    .describedAs("walk description");

  public static walkAdditionalDetailsEditor = PageElement.located(By.css(".field--name-field-additional-details .ck-editor__editable"))
    .describedAs("walk additional details");

  public static walkWebsiteLinkField = PageElement.located(By.id("edit-field-walk-website-link-0-uri"))
    .describedAs("walk website link");

  public static walkMeetingTimeField = PageElement.located(By.id("edit-field-meeting-time-0-value"))
    .describedAs("walk meeting time");

  public static walkDistanceKilometresField = PageElement.located(By.css("input[name='field_walk_distance[0][value]']"))
    .describedAs("walk distance in kilometres");

  public static walkDistanceMilesField = PageElement.located(By.css("input[name='field_walk_distance[0][alternative]']"))
    .describedAs("walk distance in miles");

  public static walkAscentMetresField = PageElement.located(By.css("input[name='field_walk_ascent[0][value]']"))
    .describedAs("walk ascent in metres");

  public static walkAscentFeetField = PageElement.located(By.css("input[name='field_walk_ascent[0][alternative]']"))
    .describedAs("walk ascent in feet");

  public static walkFinishTimeField = PageElement.located(By.id("edit-field-estimated-finishing-time-0-value"))
    .describedAs("walk estimated finishing time");

  public static walkOptionLabelled(optionLabel: string) {
    return PageElement.located(By.xpath(`//form//label[normalize-space()='${optionLabel}']`))
      .describedAs(`${optionLabel} option`);
  }

  public static saveChangesButton = PageElement.located(By.id("save_action"))
    .describedAs("Save changes button");

  public static saveAndContinueButton = PageElement.located(By.css("input[value='Save and continue'], button[value='Save and continue']"))
    .describedAs("Save and continue button");

  public static publishChangesButton = PageElement.located(By.css("label[for='save_publish_action']"))
    .describedAs("Publish changes button");

  public static manageWalkButton = PageElement.located(By.id("ramled_manage"))
    .describedAs("Manage walk button");

  public static editWalkLink = PageElement.located(By.css("a[href*='/walks-manager/walk/basic-information/']"))
    .describedAs("Edit walk link");

  public static descriptionStepLink = PageElement.located(By.css("a[href*='/walks-manager/walk/description/']"))
    .describedAs("Description step link");

  public static walkStepLink(step: string) {
    return PageElement.located(By.css(`a[href*='/walks-manager/walk/${step}/']`))
      .describedAs(`${step} step link`);
  }

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
    return PageElement.located(By.css(".views-field-ramled-title-field a")).of(result).describedAs("walk edit link");
  }

  public static emphasisedWithin(pageElement: PageElement) {
    return PageElement.located(By.tagName("em").describedAs("emphasised text")).of(pageElement);
  }

  public static cancelledRow(rowIndex: number, date: string) {
    return PageElement.located(By.css(`#views-form-ramled-all-walks-events-all-walks-events tr:nth-child(${rowIndex + 1}) .ramled-status-cancelled`))
      .describedAs(`Checkbox for ${date} walk`);
  }

  public static checkboxSelector(tableRow: PageElement, date: string) {
    return PageElement.located(By.css("[id^=edit-views-bulk-operations-bulk-form-]")).of(tableRow).describedAs(`Checkbox for ${date} walk`);
  }

}
