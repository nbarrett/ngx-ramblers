import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { DeploymentInfo } from "../models/build-version.model";
import { ReleaseFeed, ReleaseFeedEntry } from "../models/release-feed.model";

@Injectable({
  providedIn: "root"
})
export class DeploymentInfoService {

  private http = inject(HttpClient);

  deploymentInfo(): Promise<DeploymentInfo> {
    return firstValueFrom(this.http.get<DeploymentInfo>("/api/version/details"));
  }

  releaseFeed(limit: number): Promise<ReleaseFeed> {
    return firstValueFrom(this.http.get<ReleaseFeed>("/api/public/releases", {params: {limit}}));
  }

  releaseNotesForBuild(feed: ReleaseFeed | null, buildNumber: string): ReleaseFeedEntry[] {
    const pattern = new RegExp(`\\bbuild ${buildNumber}\\b`, "i");
    return (feed?.entries || []).filter(entry => pattern.test(entry.title));
  }
}
