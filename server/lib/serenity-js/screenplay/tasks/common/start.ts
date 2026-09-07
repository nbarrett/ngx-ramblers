import { Task } from "@serenity-js/core";
import { Navigate } from "@serenity-js/web";
import { StartWithNavigation } from "./start-with-navigation";
import { NavigateWithDomLoaded } from "./navigate-with-dom-loaded";
import { Accept } from "../ramblers/common/accept-cookie-prompt";
import { OS_MAPS_EXPLORE_URL } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { PrepareOsMapsBrowser } from "../os-maps/prepare-os-maps-browser";

export class Start {

  static onWalksProgramme(): Task {
    return Task.where("#actor starts on the walks tab",
      Navigate.to("/walks"),
    );
  }

  static onRamblersLoginPage(): Task {
    return Task.where("#actor starts on the ramblers login page",
      StartWithNavigation.to("https://www.ramblers.org.uk/login.aspx"),
    );
  }

  static onContacts(): Task {
    return Task.where("#actor starts on ramblers contacts page",
      StartWithNavigation.to("http://www.ramblers.org.uk/group-walks-and-events-manager.aspx?tab=Contacts"),
    );
  }

  static onWalksAndEventsManager(): Task {
    return Task.where("#actor starts on the walks and events manager",
      StartWithNavigation.to("https://walks-manager.ramblers.org.uk/walks-manager"),
      Accept.dismissCookieBanners(),
    );
  }

  static onOsMaps(): Task {
    return Task.where("#actor starts on OS Maps",
      PrepareOsMapsBrowser.withoutMapTiles(),
      NavigateWithDomLoaded.to(OS_MAPS_EXPLORE_URL),
    );
  }

  static onOsMapsRoute(url: string): Task {
    return Task.where("#actor starts on an OS Maps route",
      PrepareOsMapsBrowser.withoutMapTiles(),
      NavigateWithDomLoaded.to(url),
    );
  }

}
