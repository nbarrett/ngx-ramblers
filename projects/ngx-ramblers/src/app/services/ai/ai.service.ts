import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AiConnectionStatus,
  AiConnectionStatusApiResponse,
  ChooseCoverImageApiResponse,
  ChooseCoverImageResponse,
  CoverImageCandidate,
  TextRewriteApiResponse,
  TextRewriteResponse
} from "../../models/ai.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class AiService {

  private logger: Logger = inject(LoggerFactory).createLogger("AiService", NgxLoggerLevel.ERROR);
  private commonDataService = inject(CommonDataService);
  private http = inject(HttpClient);
  private BASE_URL = "/api/ai";

  async rewrite(input: string, systemPrompt?: string): Promise<string> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<TextRewriteApiResponse>(`${this.BASE_URL}/rewrite`, {input, systemPrompt}));
    return (response.response as TextRewriteResponse)?.output;
  }

  async chooseCoverImage(
    candidates: CoverImageCandidate[],
    rootFolder?: string,
    albumName?: string
  ): Promise<string | null> {
    if (!candidates?.length) {
      return null;
    }
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ChooseCoverImageApiResponse>(`${this.BASE_URL}/choose-cover`, {
        candidates,
        rootFolder,
        albumName
      })
    );
    return (response.response as ChooseCoverImageResponse)?.image || candidates[0]?.image || null;
  }

  async status(): Promise<AiConnectionStatus> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<AiConnectionStatusApiResponse>(`${this.BASE_URL}/status`));
    return response.response as AiConnectionStatus;
  }
}
