import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeFile } from "../../models/committee.model";
import { Member } from "../../models/member.model";
import { CommitteeDisplayService } from "../../pages/committee/committee-display.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { HasMedia, SocialEvent } from "../../models/social-events.model";
import { BasicMedia, Media } from "../../models/ramblers-walks-manager";
import { UrlService } from "../url.service";
import { FALLBACK_MEDIA, Walk } from "../../models/walk.model";

@Injectable({
  providedIn: "root"
})

export class MediaQueryService {
  private logger: Logger;
  public committeeFiles: CommitteeFile[] = [];
  public committeeMembers: Member[] = [];

  constructor(
    private urlService: UrlService,
    public display: CommitteeDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MediaQueryService", NgxLoggerLevel.ERROR);
  }


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

  imageFromSocialEvent(socialEvent: SocialEvent) {
    return this.urlService.imageSource(socialEvent?.thumbnail, true);
  }

  imageSource(walk: Walk): BasicMedia {
    return this.basicMediaFrom(walk)?.[0];
  }

  imageSourceWithFallback(walk: Walk): BasicMedia {
    return this.imageSource(walk) || FALLBACK_MEDIA;
  }


}
