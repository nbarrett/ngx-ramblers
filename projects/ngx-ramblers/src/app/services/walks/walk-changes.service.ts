import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

import { ExtendedGroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class WalkChangesService {

  private walkNotifications = new Subject<ExtendedGroupEvent>();

  notifications(): Observable<ExtendedGroupEvent> {
    return this.walkNotifications.asObservable();
  }

  notifyChange(walk: ExtendedGroupEvent): void {
    this.walkNotifications.next(walk);
  }

}
