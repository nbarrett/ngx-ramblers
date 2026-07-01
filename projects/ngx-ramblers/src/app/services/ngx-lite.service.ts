import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { SetupStatusResponse } from "../models/environment-setup.model";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class NgxLiteService {

  private logger: Logger = inject(LoggerFactory).createLogger("NgxLiteService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private _ngxLite = false;
  private _hasLocalSocialEvents = false;
  private loadPromise: Promise<void>;

  constructor() {
    this.loadStatus();
  }

  loadStatus(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = firstValueFrom(this.http.get<SetupStatusResponse>("/api/environment-setup/status"))
        .then(response => {
          this._ngxLite = response?.ngxLite || false;
          this._hasLocalSocialEvents = response?.hasLocalSocialEvents || false;
          this.logger.info("ngxLite:", this._ngxLite, "hasLocalSocialEvents:", this._hasLocalSocialEvents);
        })
        .catch(() => {
          this._ngxLite = false;
          this._hasLocalSocialEvents = false;
        });
    }
    return this.loadPromise;
  }

  get ngxLite(): boolean {
    return this._ngxLite;
  }

  set ngxLite(value: boolean) {
    this._ngxLite = value;
  }

  get hasLocalSocialEvents(): boolean {
    return this._hasLocalSocialEvents;
  }
}
