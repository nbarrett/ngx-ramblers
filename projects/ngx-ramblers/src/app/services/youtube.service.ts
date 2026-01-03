import { Injectable } from "@angular/core";
import { YouTubeDomain, YouTubeQuality } from "../models/youtube.model";

@Injectable({
  providedIn: "root"
})
export class YouTubeService {
  embedUrl(videoId: string, enableApi: boolean = false): string {
    if (!videoId) {
      return null;
    }
    const apiParam = enableApi ? "?enablejsapi=1" : "";
    return `https://${YouTubeDomain.EMBED}/embed/${videoId}${apiParam}`;
  }

  thumbnailUrl(videoId: string, quality: YouTubeQuality = YouTubeQuality.MAX): string {
    if (!videoId) {
      return null;
    }
    return `https://${YouTubeDomain.THUMBNAIL}/vi/${videoId}/${quality}.jpg`;
  }
}
