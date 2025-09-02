import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { StoredValue } from "../models/ui-actions";

@Injectable({
  providedIn: "root"
})

export class SiteEditService {

  private logger: Logger = inject(LoggerFactory).createLogger("SiteEditService", NgxLoggerLevel.ERROR);
  private subject: Subject<NamedEvent<boolean>> = new Subject();
  public events: Observable<NamedEvent<boolean>> = this.subject.asObservable();
  public editNameEnabled = false;

  allowNameEdits(enabled: boolean) {
    this.editNameEnabled = enabled;
  }

  active() {
    const editSite = localStorage.getItem(StoredValue.EDIT_SITE);
    const active = editSite === "true";
    this.logger.debug("editSite", editSite, "active:", active);
    return active;
  }

  toggle(state: boolean) {
    const priorState = this.active();
    const newState = JSON.stringify(state);
    localStorage.setItem(StoredValue.EDIT_SITE, newState);
    this.subject.next(NamedEvent.withData(StoredValue.EDIT_SITE, state));
    this.logger.debug("toggle:priorState", priorState, "newState", newState);
  }

}

