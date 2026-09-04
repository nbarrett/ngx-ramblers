import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { RouteTurnStepsRequest, RouteTurnStepsResponse } from "../../models/route-follow.model";

@Injectable({
  providedIn: "root"
})
export class RouteTurnsService {

  private http = inject(HttpClient);

  turnSteps(request: RouteTurnStepsRequest): Promise<RouteTurnStepsResponse> {
    return firstValueFrom(this.http.post<RouteTurnStepsResponse>("/api/routes/turn-steps", request));
  }
}
