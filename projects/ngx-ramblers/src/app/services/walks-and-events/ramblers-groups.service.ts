import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ReplaySubject } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { GroupListRequest, MAXIMUM_PAGE_SIZE, RamblersGroupsApiResponse, RamblersGroupsApiResponseApiResponse } from "../../models/ramblers-walks-manager";
import { sortBy } from "../../functions/arrays";
import { CommonDataService } from "../common-data-service";
import { LoggerFactory } from "../logger-factory.service";

@Injectable({providedIn: "root"})
export class RamblersGroupsService {
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private logger = inject(LoggerFactory).createLogger("RamblersGroupsService", NgxLoggerLevel.ERROR);
  private subject = new ReplaySubject<RamblersGroupsApiResponseApiResponse>();

  events() {
    return this.subject.asObservable();
  }

  async list(groups: string[]): Promise<RamblersGroupsApiResponse[]> {
    const body: GroupListRequest = {limit: MAXIMUM_PAGE_SIZE, groups};
    const rawData = await this.commonDataService.responseFrom(this.logger,
      this.http.post<RamblersGroupsApiResponseApiResponse>("/api/ramblers/walks-manager/list-groups", body), this.subject);
    return (rawData.response || []).sort(sortBy("name"));
  }
}
