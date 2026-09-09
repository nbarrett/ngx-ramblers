import { equals, isPresent } from "@serenity-js/assertions";
import { Task, Wait } from "@serenity-js/core";
import { OsMapsLoadingIndicatorDisplayed } from "../../questions/os-maps/os-maps-loading-indicator-displayed";
import { OsMapsPageElements } from "../../ui/os-maps/os-maps-page-elements";

export class WaitForOsMapsApplicationReady {

  static now(): Task {
    return Task.where("#actor waits for the OS Maps application to be ready",
      Wait.until(OsMapsPageElements.applicationHeader, isPresent()),
      Wait.until(OsMapsLoadingIndicatorDisplayed.now(), equals(false))
    );
  }

}
