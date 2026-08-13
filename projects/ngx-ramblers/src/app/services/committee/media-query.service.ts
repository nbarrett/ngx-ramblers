import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeFile } from "../../models/committee.model";
import { Member } from "../../models/member.model";
import { CommitteeDisplayService } from "../../pages/committee/committee-display.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { HasMedia } from "../../models/group-events.model";
import { BasicMedia, Media } from "../../models/ramblers-walks-manager";
import { UrlService } from "../url.service";
import { FALLBACK_MEDIA } from "../../models/walk.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { applyImageSourceTo, mediaFrom, mediumStyleUrlFrom } from "../../functions/media";

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
    return this.mediumStyleUrlFrom(mediaItem);
  }

  public mediumStyleUrlFrom(media: Media): string {
    return mediumStyleUrlFrom(media);
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

  imageSourceWithFallback(extendedGroupEvent: ExtendedGroupEvent, absolute = false): BasicMedia {
    const basicMedia = this.imageSource(extendedGroupEvent);
    return basicMedia ? {...basicMedia, url:this.urlService.imageSource(basicMedia.url, absolute, true)} : FALLBACK_MEDIA;
  }

  applyImageSource(hasMedia: HasMedia, title: string, imageUrl: string): void {
    applyImageSourceTo(hasMedia, title, imageUrl);
    this.logger.info("applyImageSource:", imageUrl, "all media:", hasMedia.media);
  }

  public mediaFrom(title: string, imageUrl: string): Media {
    return mediaFrom(title, imageUrl);
  }
}
