import { By, PageElement } from "@serenity-js/web";

export class OsMapsPageElements {

  public static cookieAccept = PageElement.located(By.css("#ccc-notify-accept"))
    .describedAs("OS Maps cookie accept button");

  public static loginButton = PageElement.located(By.css("button[aria-label='Log in'], button[aria-label='Log In']"))
    .describedAs("OS Maps log in button");

  public static emailField = PageElement.located(By.id("signInName"))
    .describedAs("OS Maps email address field");

  public static passwordField = PageElement.located(By.id("password"))
    .describedAs("OS Maps password field");

  public static loginSubmit = PageElement.located(By.id("next"))
    .describedAs("OS Maps log in submit button");

  public static loginError = PageElement.located(By.css(".error.pageLevel, #claimVerificationServerError"))
    .describedAs("OS Maps login error");

  public static accountButton = PageElement.located(By.css("button[aria-label='Go to my account']"))
    .describedAs("OS Maps account button");

  public static logOutButton = PageElement.located(By.css("button[aria-label='Log Out']"))
    .describedAs("OS Maps log out button");

  public static exportGpxButton = PageElement.located(By.id("export_gpx_button_id"))
    .describedAs("Export GPX button");

  public static confirmExportGpxButton = PageElement.located(By.css("button.export-button"))
    .describedAs("Export GPX file confirm button");

}
