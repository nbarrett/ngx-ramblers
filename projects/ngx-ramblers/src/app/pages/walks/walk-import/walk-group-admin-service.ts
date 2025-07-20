import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map, Observable } from "rxjs";
import { EventStats } from "../../../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class WalkGroupAdminService {
  constructor(private http: HttpClient) {
  }

  eventStats(): Observable<EventStats[]> {
    return this.http.get<EventStats[]>(`api/database/walks/event-stats`)
      .pipe(
        map(groups => groups.map(g => ({
          ...g,
          minDate: new Date(g.minDate),
          maxDate: new Date(g.maxDate),
          selected: false
        })))
      );
  }

  bulkDeleteEvents(groups: { itemType: string, groupCode: string }[]): Observable<void> {
    return this.http.post<void>(`api/database/walks/bulk-delete`, groups);
  }

  bulkUpdateEvents(updates: {
    itemType: string,
    groupCode: string,
    newGroupCode: string,
    newGroupName: string
  }[]): Observable<void> {
    return this.http.post<void>(`api/database/walks/bulk-update`, updates);
  }

  recreateGroupEventsIndex(): Observable<void> {
    return this.http.post<void>(`api/database/walks/recreate-index`, {});
  }
}
