import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map, Observable } from "rxjs";
import { EditableEventStats, EventStats } from "../../../models/group-event.model";
import { DateUtilsService } from "../../../services/date-utils.service";

@Injectable({
  providedIn: "root"
})
export class WalkGroupAdminService {
  private dateUtils = inject(DateUtilsService);
  constructor(private http: HttpClient) {}

  eventStats(): Observable<EventStats[]> {
    return this.http.get<EventStats[]>(`api/database/walks/event-stats`)
      .pipe(
        map(groups => groups.map(g => ({
          ...g,
          minDate: this.dateUtils.asDateTime(g.minDate).toJSDate(),
          maxDate: this.dateUtils.asDateTime(g.maxDate).toJSDate(),
          selected: false
        })))
      );
  }

  bulkDeleteEvents(groups: { itemType: string, groupCode: string }[]): Observable<void> {
    return this.http.post<void>(`api/database/walks/bulk-delete`, groups);
  }

  bulkUpdateEvents(updates: EditableEventStats[]): Observable<void> {
    return this.http.post<void>(`api/database/walks/bulk-update`, updates);
  }

  recreateGroupEventsIndex(): Observable<void> {
    return this.http.post<void>(`api/database/walks/recreate-index`, {});
  }
}
