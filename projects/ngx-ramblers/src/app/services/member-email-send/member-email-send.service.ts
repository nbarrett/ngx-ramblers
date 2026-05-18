import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { MemberEmailSend, MemberEmailSendsApiResponse } from "../../models/member-email-send.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({ providedIn: "root" })
export class MemberEmailSendService {
  private readonly logger: Logger = inject(LoggerFactory).createLogger("MemberEmailSendService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private readonly BASE_URL = "/api/database/member-email-sends";

  async list(notificationConfigId?: string): Promise<MemberEmailSend[]> {
    const params = notificationConfigId ? new HttpParams().set("notificationConfigId", notificationConfigId) : undefined;
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberEmailSendsApiResponse>(this.BASE_URL, { params }));
    return apiResponse.response ?? [];
  }
}
