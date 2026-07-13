import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { WalkLeaderBulkRematchSummary } from "../../models/walk-leader-match.model";

@Injectable({providedIn: "root"})
export class WalkLeaderRematchService {
  private http = inject(HttpClient);

  rematchOnDemand(): Promise<WalkLeaderBulkRematchSummary> {
    return firstValueFrom(this.http.post<WalkLeaderBulkRematchSummary>("api/database/walks/leader-rematch", {trigger: "on-demand"}));
  }

  rematchAfterMemberBulkLoad(uploadSessionId: string): Promise<WalkLeaderBulkRematchSummary | null> {
    return firstValueFrom(this.http.post<WalkLeaderBulkRematchSummary | null>("api/database/walks/leader-rematch", {trigger: "member-bulk-load-complete", uploadSessionId}));
  }
}
