import { Task } from "@serenity-js/core/lib/screenplay/Task";
import { Navigate } from "@serenity-js/web";
import { StartWithNavigation } from "./start-with-navigation";
import { Accept } from "../ramblers/common/accept-cookie-prompt";

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
      Accept.disableCookieBannerPermanently(),
    );
  }

}
