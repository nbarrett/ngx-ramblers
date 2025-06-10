import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeFile } from "../../models/committee.model";
import { Member } from "../../models/member.model";
import { CommitteeDisplayService } from "../../pages/committee/committee-display.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { HasMedia } from "../../models/social-events.model";
import { BasicMedia, Media } from "../../models/ramblers-walks-manager";
import { UrlService } from "../url.service";
import { FALLBACK_MEDIA } from "../../models/walk.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class MediaQueryService {

  private logger: Logger = inject(LoggerFactory).createLogger("MediaQueryService", NgxLoggerLevel.ERROR);
  private urlService = inject(UrlService);
  display = inject(CommitteeDisplayService);
  public committeeFiles: CommitteeFile[] = [];
  public committeeMembers: Member[] = [];


  public imageUrlFrom(mediaObject: HasMedia): string {
    return this.imageUrlFromMedia(mediaObject?.media);
  }

  private imageUrlFromMedia(media: Media[]): string {
    this.logger.info("image from media:", media);
    const mediaItem: Media = media?.find(item => item.styles.find(style => style.style === "medium"));
    return mediaItem?.styles?.find(style => style.style === "medium")?.url;
  }

  public basicMediaFrom(mediaObject: HasMedia): BasicMedia[] {
    const media = mediaObject?.media?.map(item => ({
      alt: item.alt,
      url: item.styles.find(style => style.style === "medium")?.url
    }));
    this.logger.info("imageFromWalk:mediaObject media:", media);
    return media;
  }

  imageSource(walk: ExtendedGroupEvent): BasicMedia {
    return this.basicMediaFrom(walk?.groupEvent)?.[0];
  }

  imageSourceWithFallback(extendedGroupEvent: ExtendedGroupEvent): BasicMedia {
    const basicMedia = this.imageSource(extendedGroupEvent);
    return basicMedia ? {...basicMedia, url:this.urlService.imageSource(basicMedia.url, false, true)} : FALLBACK_MEDIA;
  }

  applyImageSource(hasMedia: HasMedia, title: string, imageUrl: string): void {
    const media = this.mediaFrom(title, imageUrl);
    const mediaItem: Media = hasMedia.media.find(item => item.styles.find(style => style.url === imageUrl));
    if (!mediaItem) {
      this.logger.info("no media exists - adding first item:", media);
      if (!hasMedia?.media) {
        hasMedia.media = [media];
      } else {
        hasMedia.media.push(media);
        this.logger.info("Added media item", hasMedia.media.length, ":", media, "all media:", hasMedia.media);
      }
    }
  }

  public mediaFrom(title: string, imageUrl: string) {
    const media: Media = {
      caption: null,
      credit: null,
      title,
      alt: title,
      styles: [{
        style: "medium", url: imageUrl,
        width: 0,
        height: 0
      }]
    };
    return media;
  }
}
