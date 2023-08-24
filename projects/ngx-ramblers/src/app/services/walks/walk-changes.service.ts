import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { Walk } from "../../models/walk.model";

@Injectable({
  providedIn: "root"
})
export class WalkChangesService {

  private walkNotifications = new Subject<Walk>();

  notifications(): Observable<Walk> {
    return this.walkNotifications.asObservable();
  }

  notifyChange(walk: Walk): void {
    this.walkNotifications.next(walk);
  }

}
