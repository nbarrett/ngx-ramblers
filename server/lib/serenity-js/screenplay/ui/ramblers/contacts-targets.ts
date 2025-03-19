import { By, PageElement, PageElements } from "@serenity-js/web";

function padStart(value: string, length: number, padChar: string): string {
  while (value.length < length) {
    value = padChar + value;
  }
  return value;
}

export class ContactsTargets {
  public static addContact = PageElement.located(By.id("layout_0_content_1_right_0_lnkAddContact"))
    .describedAs("add a contact action");

  public static firstName = PageElement.located(By.id("layout_0_content_1_innerleft_1_txtContactFirstName"))
    .describedAs("contact first name");

  public static lastName = PageElement.located(By.id("layout_0_content_1_innerleft_1_txtContactSurname"))
    .describedAs("contact surname");

  public static displayName = PageElement.located(By.id("layout_0_content_1_innerleft_1_txtContactDisplayName"))
    .describedAs("contact display name");

  public static email = PageElement.located(By.id("layout_0_content_1_innerleft_1_txtContactEmail"))
    .describedAs("contact email");

  public static contactNumber = PageElement.located(By.id("layout_0_content_1_innerleft_1_txtContactPhone1"))
    .describedAs("contact phone 1");

  public static save = PageElement.located(By.id("layout_0_content_1_innerleft_1_btnSave"))
    .describedAs("save contact");

  public static backToContacts = PageElement.located(By.id("layout_0_content_1_innerleft_1_btnReturn"))
    .describedAs("back to contacts button");

  public static addAnotherContact = PageElement.located(By.id("layout_0_content_1_innerleft_1_btnAddAnother"))
    .describedAs("add another contact button");

  public static userName = PageElement.located(By.css("#layout_0_content_0_innerleft_1_txtUsername"))
    .describedAs("user name");

  public static contacts = PageElements.located(By.css(".lbs-search-row"))
    .describedAs("ramblers contacts");

  public static page1 = PageElement.located(By.css("#layout_0_content_1_innerleft_2_tabContacts_btm1"))
    .describedAs("page 1");

  public static page2 = PageElement.located(By.css("#layout_0_content_1_innerleft_2_tabContacts_btm2"))
    .describedAs("page 2");

  public static page3 = PageElement.located(By.css("#layout_0_content_1_innerleft_2_tabContacts_btm3"))
    .describedAs("page 3");


  public static colsForRow(tableRow: PageElement) {
    return PageElements.located(By.css("class^='col-")
      .describedAs("columns for row"))
      .of(tableRow);
  }

  public static checkboxSelector(tableRow: PageElement, displayName: string) {
    return PageElement.located(By.css("id$='layout_0_content_1_innerleft_2_tabContacts_rptResults_ctl01_chkSelectedContact").describedAs(`checkbox for ${displayName}`))
      .of(tableRow);
  }
}
