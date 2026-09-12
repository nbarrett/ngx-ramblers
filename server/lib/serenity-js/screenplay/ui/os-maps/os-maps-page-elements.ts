import { By, PageElement } from "@serenity-js/web";

export const OS_MAPS_COOKIE_ACCEPT_SELECTOR = "#ccc-notify-accept";

export const OS_MAPS_COOKIE_OVERLAY_SELECTOR = "#ccc-overlay";

export const OS_MAPS_LOGIN_BUTTON_SELECTOR = ".header__right button[aria-label='Log in']";

export class OsMapsPageElements {

  public static cookieAccept = PageElement.located(By.css("#ccc-notify-accept"))
    .describedAs("cookie banner accept button");

  public static anyObstruction = PageElement.located(By.css("#ccc-overlay, #ccc, button[aria-label='Close popup']"))
    .describedAs("anything blocking progress on the page");

  public static cookieBanner = PageElement.located(By.role("dialog", {name: /we use cookies/i}))
    .describedAs("cookie consent dialog");

  public static cookieOverlay = PageElement.located(By.css("#ccc-overlay"))
    .describedAs("cookie banner overlay");

  public static loginButton = PageElement.located(By.css(OS_MAPS_LOGIN_BUTTON_SELECTOR))
    .describedAs("OS Maps log in button");

  public static emailField = PageElement.located(By.css("#signInName, input[type='email']"))
    .describedAs("OS Maps email address field");

  public static passwordField = PageElement.located(By.css("#password, input[type='password']"))
    .describedAs("OS Maps password field");

  public static loginSubmit = PageElement.located(By.css("#next, form button[type='submit']"))
    .describedAs("OS Maps log in submit button");

  public static loginError = PageElement.located(By.css(".error.pageLevel, #claimVerificationServerError, #password-error, #signInName-error"))
    .describedAs("OS Maps login error");

  public static logOutButton = PageElement.located(By.css("button[aria-label='Log Out']"))
    .describedAs("OS Maps log out button");

  public static exportGpxButton = PageElement.located(By.role("button", {name: "Export GPX", exact: true}))
    .describedAs("Export GPX button");

  public static confirmExportGpxButton = PageElement.located(By.css("button.export-button"))
    .describedAs("Export GPX file confirm button");

  public static feedbackSurveyDismissButton = PageElement.located(By.role("button", {name: "No Thanks", exact: true}))
    .describedAs("OS Maps feedback survey dismissal button");

  public static newMapTypeDismissButton = PageElement.located(By.role("button", {name: "NOT RIGHT NOW", exact: true}))
    .describedAs("OS Maps new map type dismissal button");

  public static subscriptionDismissButton = PageElement.located(By.css("[aria-label='Modal open - Get subscription'] button[aria-label='Close popup']"))
    .describedAs("OS Maps subscription dismissal button");

  public static announcementDismissButton = PageElement.located(By.role("button", {name: "Close popup", exact: true}))
    .describedAs("OS Maps announcement dismissal button");

  public static applicationHeader = PageElement.located(By.css(".header__right"))
    .describedAs("OS Maps application header");

  public static headerLoadingIndicator = PageElement.located(By.css(".header__right .loading-indicator"))
    .describedAs("OS Maps header loading indicator");

  public static sidePanelLoadingIndicator = PageElement.located(By.css(".side-panel .loading-indicator"))
    .describedAs("OS Maps side panel loading indicator");

  public static exportDialogControl = PageElement.located(By.css("button.export-button, button[aria-label='Close popup'], button[aria-label='NOT RIGHT NOW']"))
    .describedAs("an OS Maps export dialog control");

}
