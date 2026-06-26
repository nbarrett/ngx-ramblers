import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import {
  MemberSyncNotification,
  MemberSyncNotificationApiResponse,
  MemberSyncNotificationReconcileRequest,
  MemberSyncNotificationReconcileResult,
  MemberSyncNotificationSendRequest,
  MemberSyncNotificationSendResult
} from "../../models/member-sync-notification.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class MemberSyncNotificationService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberSyncNotificationService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/member-sync-notifications";
  private notificationsInternal = new Subject<MemberSyncNotificationApiResponse>();

  notifications(): Observable<MemberSyncNotificationApiResponse> {
    return this.notificationsInternal.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<MemberSyncNotification[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberSyncNotificationApiResponse>(`${this.BASE_URL}/all`, {params}), this.notificationsInternal);
    return apiResponse.response as MemberSyncNotification[];
  }

  async reconcile(request: MemberSyncNotificationReconcileRequest): Promise<MemberSyncNotificationReconcileResult> {
    this.logger.info("reconcile:candidates", request.candidates.length, "processedMemberIds", request.processedMemberIds.length);
    const apiResponse = await this.http.post<{ response: MemberSyncNotificationReconcileResult }>(`${this.BASE_URL}/reconcile`, request).toPromise();
    return apiResponse.response;
  }

  async send(request: MemberSyncNotificationSendRequest): Promise<MemberSyncNotificationSendResult> {
    this.logger.info("send:memberIds", request.memberIds.length);
    const apiResponse = await this.http.post<{ response: MemberSyncNotificationSendResult }>(`${this.BASE_URL}/send`, request).toPromise();
    return apiResponse.response;
  }
}
