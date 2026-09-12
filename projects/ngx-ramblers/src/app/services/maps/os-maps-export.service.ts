import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { IntegrationWorkerJobResponse, IntegrationWorkerQueueCancelResult } from "../../models/integration-worker.model";
import { FileNameData } from "../../models/aws-object.model";
import { OS_MAPS_EXPORT_MAX_WAIT_MS, OS_MAPS_EXPORT_POLL_INTERVAL_MS, OsMapsExportJobResult, OsMapsExportJobStatus, OsMapsListedRoute, OsMapsRouteListing } from "../../models/os-maps-export.model";
import { WebSocketClientService } from "../websockets/websocket-client.service";

@Injectable({
  providedIn: "root"
})
export class OsMapsExportService {
  private http = inject(HttpClient);
  private webSocketClientService = inject(WebSocketClientService);
  private baseUrl = "/api/os-maps";

  private async connectForReporting(): Promise<void> {
    await this.webSocketClientService.connect();
  }

  listing(): Promise<OsMapsRouteListing> {
    return firstValueFrom(this.http.get<OsMapsRouteListing>(`${this.baseUrl}/routes`));
  }

  importedRoute(routeId: string): Promise<OsMapsListedRoute> {
    return firstValueFrom(this.http.get<OsMapsListedRoute>(`${this.baseUrl}/routes/${routeId}`));
  }

  saveImportedRoute(routeId: string, update: {
    gpxFile?: FileNameData | null;
    color?: string | null;
    weight?: number | null;
    opacity?: number | null;
  }): Promise<OsMapsListedRoute> {
    return firstValueFrom(this.http.put<OsMapsListedRoute>(`${this.baseUrl}/routes/${routeId}`, update));
  }

  async refresh(): Promise<IntegrationWorkerJobResponse> {
    await this.connectForReporting();
    return firstValueFrom(this.http.post<IntegrationWorkerJobResponse>(`${this.baseUrl}/routes/refresh`, {}));
  }

  async exportRoutes(routeUrls: string[], walkId?: string): Promise<IntegrationWorkerJobResponse> {
    await this.connectForReporting();
    return firstValueFrom(this.http.post<IntegrationWorkerJobResponse>(`${this.baseUrl}/export`, {
      routeUrls,
      ...(walkId ? {walkId} : {})
    }));
  }

  cancelActive(): Promise<IntegrationWorkerQueueCancelResult> {
    return firstValueFrom(this.http.post<IntegrationWorkerQueueCancelResult>(`${this.baseUrl}/export/cancel`, {}));
  }

  exportResult(jobId: string): Promise<OsMapsExportJobResult> {
    return firstValueFrom(this.http.get<OsMapsExportJobResult>(`${this.baseUrl}/export/${jobId}`));
  }

  latestExportResult(): Promise<OsMapsExportJobResult | null> {
    return firstValueFrom(this.http.get<OsMapsExportJobResult | null>(`${this.baseUrl}/export/latest`));
  }

  async waitForExport(jobId: string, stillWaiting: () => boolean = () => true, maxWaitMs = OS_MAPS_EXPORT_MAX_WAIT_MS): Promise<OsMapsExportJobResult> {
    const attempts = {count: 0};
    const maxAttempts = Math.ceil(maxWaitMs / OS_MAPS_EXPORT_POLL_INTERVAL_MS);
    const poll = async (): Promise<OsMapsExportJobResult> => {
      const result = await this.exportResult(jobId);
      attempts.count += 1;
      if (result.status === OsMapsExportJobStatus.COMPLETED
        || result.status === OsMapsExportJobStatus.FAILED
        || attempts.count >= maxAttempts
        || !stillWaiting()) {
        return result;
      } else {
        await new Promise(resolve => setTimeout(resolve, OS_MAPS_EXPORT_POLL_INTERVAL_MS));
        return poll();
      }
    };
    return poll();
  }
}
