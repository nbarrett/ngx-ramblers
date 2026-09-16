import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { MoveBrevoRequest, MoveBrevoResult } from "../models/move-brevo.model";

@Injectable({
  providedIn: "root"
})
export class MoveBrevoService {
  private http = inject(HttpClient);
  private BASE_URL = "api/move-brevo";

  plan(request: MoveBrevoRequest): Observable<MoveBrevoResult> {
    return this.http.post<MoveBrevoResult>(`${this.BASE_URL}/plan`, request);
  }

  execute(request: MoveBrevoRequest): Observable<MoveBrevoResult> {
    return this.http.post<MoveBrevoResult>(`${this.BASE_URL}/execute`, request);
  }

  job(jobId: string): Observable<MoveBrevoResult> {
    return this.http.get<MoveBrevoResult>(`${this.BASE_URL}/jobs/${encodeURIComponent(jobId)}`);
  }
}
