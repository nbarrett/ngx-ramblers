import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DeletedMember, DeletedMemberApiResponse } from "../../models/member.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class DeletedMemberService {
  private logger: Logger;
  private BASE_URL = "/api/database/deleted-member";
  private notificationsInternal = new Subject<DeletedMemberApiResponse>();

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DeletedMemberService, NgxLoggerLevel.OFF);
  }

  notifications(): Observable<DeletedMemberApiResponse> {
    return this.notificationsInternal.asObservable();
  }

  async all(): Promise<DeletedMember[]> {
    const apiResponse = await this.http.get<{ response: DeletedMember[] }>(this.BASE_URL + "/all").toPromise();
    this.logger.debug("all - received", apiResponse);
    return apiResponse.response;
  }

  async create(deletedMember: DeletedMember): Promise<DeletedMember> {
    this.logger.debug("creating", deletedMember);
    const apiResponse = await this.http.post<{ response: DeletedMember }>(this.BASE_URL, deletedMember).toPromise();
    this.logger.debug("created", deletedMember, "- received", apiResponse);
    return apiResponse.response;
  }

  async createOrUpdateAll(deletedMembers: DeletedMember[]): Promise<DeletedMember[]> {
    this.logger.info("createOrUpdateAll", deletedMembers);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<DeletedMemberApiResponse>(`${this.BASE_URL}/all`, deletedMembers));
    this.logger.info("created", deletedMembers, "- received", apiResponse);
    return apiResponse.response as DeletedMember[];
  }

}
