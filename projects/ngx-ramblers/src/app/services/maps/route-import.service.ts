import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { MapRouteImportResponse } from "../../models/map-route-import.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { WebSocketClientService } from "../websockets/websocket-client.service";
import { EventType, MessageType } from "../../models/websocket.model";

export interface ImportProgress {
  message: string;
  percent?: number;
}

@Injectable({
  providedIn: "root"
})
export class RouteImportService {
  private logger: Logger = inject(LoggerFactory).createLogger("RouteImportService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private wsClient = inject(WebSocketClientService);
  private readonly uploadEndpoint = "api/routes/upload-esri";

  async importEsri(file: File, onProgress?: (progress: ImportProgress) => void): Promise<MapRouteImportResponse> {
    const formData = new FormData();
    formData.append("file", file, file.name);

    this.logger.info("Uploading ESRI file", file.name);
    if (onProgress) {
      onProgress({ message: "Uploading file...", percent: 0 });
    }

    const uploadResponse = await firstValueFrom(
      this.http.post<{ filePath: string; originalName: string }>(this.uploadEndpoint, formData)
    );

    this.logger.info("File uploaded, connecting to websocket");
    await this.wsClient.connect();

    if (onProgress) {
      onProgress({ message: "File uploaded, starting import...", percent: 5 });
    }

    return new Promise((resolve, reject) => {
      const progressSub = this.wsClient.receiveMessages<ImportProgress>(MessageType.PROGRESS).subscribe((data) => {
        this.logger.info("Import progress:", data.message);
        if (onProgress) {
          onProgress(data);
        }
      });

      const errorSub = this.wsClient.receiveMessages<{ message: string }>(MessageType.ERROR).subscribe((data) => {
        this.logger.error("Import error:", data.message);
        progressSub.unsubscribe();
        errorSub.unsubscribe();
        completeSub.unsubscribe();
        reject(new Error(data.message || "Import failed"));
      });

      const completeSub = this.wsClient.receiveMessages<MapRouteImportResponse>(MessageType.COMPLETE).subscribe((data) => {
        this.logger.info("Import complete:", data);
        progressSub.unsubscribe();
        errorSub.unsubscribe();
        completeSub.unsubscribe();
        resolve(data);
      });

      this.wsClient.sendMessage(EventType.ESRI_ROUTE_IMPORT, {
        filePath: uploadResponse.filePath,
        originalName: uploadResponse.originalName
      });
    });
  }
}
