import { Target } from "@serenity-js/protractor";
import { padStart } from "lodash";
import { by } from "protractor";

export class ContactsTargets {

  public static addContact = Target.the("add a contact action")
    .located(by.id("layout_0_content_1_right_0_lnkAddContact"));

  public static firstName = Target.the("contact first name")
    .located(by.id("layout_0_content_1_innerleft_1_txtContactFirstName"));

  public static lastName = Target.the("contact surname")
    .located(by.id("layout_0_content_1_innerleft_1_txtContactSurname"));

  public static displayName = Target.the("contact display name")
    .located(by.id("layout_0_content_1_innerleft_1_txtContactDisplayName"));

  public static email = Target.the("contact email")
    .located(by.id("layout_0_content_1_innerleft_1_txtContactEmail"));

  public static contactNumber = Target.the("contact phone 1")
    .located(by.id("layout_0_content_1_innerleft_1_txtContactPhone1"));

  public static save = Target.the("save contact")
    .located(by.id("layout_0_content_1_innerleft_1_btnSave"));

  public static backToContacts = Target.the("back to contacts button")
    .located(by.id("layout_0_content_1_innerleft_1_btnReturn"));

  public static addAnotherContact = Target.the("add another contact button")
    .located(by.id("layout_0_content_1_innerleft_1_btnAddAnother"));

  public static userName = Target.the("user name")
    .located(by.css("#layout_0_content_0_innerleft_1_txtUsername"));

  public static contacts = Target.all("ramblers contacts")
    .located(by.css(".lbs-search-row"));

  public static page1 = Target.the("page 1")
    .located(by.css("#layout_0_content_1_innerleft_2_tabContacts_btm1"));

  public static page2 = Target.the("page 2")
    .located(by.css("#layout_0_content_1_innerleft_2_tabContacts_btm2"));

  public static page3 = Target.the("page 3")
    .located(by.css("#layout_0_content_1_innerleft_2_tabContacts_btm3"));

  public static checkboxSelector(rowIndex: number) {
    return Target.the("checkbox index " +
      rowIndex).located(by.css("#layout_0_content_1_innerleft_2_tabContacts_rptResults_ctl01_chkSelectedContact" +
      padStart((rowIndex + 1).toString(), 2, "0") +
      "_chkSelectedContact"));
  }
}
