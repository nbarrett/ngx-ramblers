import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlbumView, FocalPointTarget, PageContentRow } from "../../../models/content-text.model";
import { FocalPoint } from "../focal-point-picker/focal-point-picker";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { ContentMetadata, LazyLoadingMetadata } from "../../../models/content-metadata.model";
import { MarkdownComponent } from "ngx-markdown";
import { CardImageComponent } from "../card/image/card-image";
import { AlbumComponent } from "../../../album/view/album";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { SocialShareAlbumComponent } from "../../../carousel/edit/social-share-album/social-share-album";
import { SocialPostLinksComponent } from "../../../album/view/social-post-links";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { RootFolder } from "../../../models/system.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp, faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { BroadcastService } from "../../../services/broadcast-service";
import { EventSlugResolverService } from "../../../services/walks-and-events/event-slug-resolver.service";
import { NamedEventType } from "../../../models/broadcast.model";
import { SocialPublishService } from "../../../services/social/social-publish.service";

@Component({
  selector: "app-dynamic-content-view-album",
  styles: [`
    :host
      display: block

    .share-toggle-bar
      position: sticky
      top: 0
      z-index: 40
      display: flex
      flex-wrap: wrap
      align-items: center
      gap: 12px
      margin: 0 0 1rem
      padding: 0.5rem 0
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 70%, rgba(255, 255, 255, 0.88) 100%)
      backdrop-filter: blur(8px)

    .share-toggle-btn
      display: inline-flex
      align-items: center
      justify-content: center
      gap: 10px
      min-height: 44px
      padding: 0 18px
      border: 1px solid rgba(217, 156, 10, 0.45)
      border-radius: 999px
      background: linear-gradient(135deg, #fff8e6 0%, #fff 100%)
      color: #1a1a1a
      font-weight: 700
      font-size: 0.95rem
      line-height: 1.1
      cursor: pointer
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06)
      transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease

    .share-toggle-btn:hover
      background: linear-gradient(135deg, #f9b104 0%, #d99c0a 100%)
      border-color: #d99c0a
      box-shadow: 0 2px 8px rgba(217, 156, 10, 0.28)

    .share-toggle-btn.open
      background: linear-gradient(135deg, #f9b104 0%, #d99c0a 100%)
      border-color: #d99c0a
      box-shadow: 0 2px 8px rgba(217, 156, 10, 0.28)

    .share-toggle-btn:focus-visible
      outline: 2px solid #d99c0a
      outline-offset: 2px

    .share-toggle-icon
      display: inline-flex
      align-items: center
      justify-content: center
      width: 28px
      height: 28px
      border-radius: 50%
      background: rgba(217, 156, 10, 0.18)
      font-size: 0.85rem

    .share-toggle-btn.open .share-toggle-icon,
    .share-toggle-btn:hover .share-toggle-icon
      background: rgba(0, 0, 0, 0.08)

    .share-panel-shell
      margin-bottom: 1.25rem

    @media (max-width: 767.98px)
      .share-toggle-bar
        align-items: stretch
        gap: 8px

      .share-toggle-btn
        width: 100%
  `],
  template: `
    @if (actions.isAlbum(row)) {
      <div [class]="actions.rowClasses(row)">
        @if (row.carousel.showTitle && row.carousel.albumView !== AlbumView.BACKGROUNDS) {
          <div class="col-sm-12">
            <h1>{{ row.carousel.title }}</h1>
            <h3>{{ row.carousel.eventDate | displayDay }}
              @if (row.carousel.subtitle) {
                @if (row.carousel.eventId) {
                  <span> - <a delay="500"
                              [href]="urlService.linkUrl({area: row.carousel.eventType, id: eventLinkId() })">
                  {{ row.carousel.subtitle }}</a></span>
                }
                @if (!row.carousel.eventId) {
                  <span>{{ row.carousel.subtitle }}</span>
                }
              }
            </h3>
          </div>
        }
        @if (shareBarVisible()) {
          <div class="col-sm-12">
            <div class="share-toggle-bar">
              @if (canShareAlbum) {
                <button type="button"
                        class="share-toggle-btn"
                        [class.open]="shareExpanded"
                        [attr.aria-expanded]="shareExpanded"
                        (click)="toggleShare()">
                  <span class="share-toggle-icon" aria-hidden="true">
                    <fa-icon [icon]="faShareNodes"/>
                  </span>
                  {{ shareExpanded ? "Hide social sharing" : "Share to social" }}
                  <fa-icon [icon]="shareExpanded ? faChevronUp : faChevronDown"/>
                </button>
              }
              @if (hasSocialPostLinks && !shareExpanded) {
                <app-social-post-links [albumName]="row.carousel?.name"/>
              }
            </div>
            @if (canShareAlbum && shareExpanded) {
              <div class="share-panel-shell">
                <app-social-share-album [contentMetadata]="shareAlbumContentMetadata"
                                        [caption]="shareAlbumCaption()"
                                        [eventDate]="row.carousel?.eventDate"
                                        [walkTitle]="row.carousel?.subtitle"
                                        (done)="collapseShare()"/>
              </div>
            }
          </div>
        }
        @if (row.carousel?.showCoverImageAndText && row.carousel?.albumView !== AlbumView.BACKGROUNDS) {
          <div class="col-sm-12 mb-2">
            <div markdown [data]="row.carousel?.introductoryText"></div>
            @if (lazyLoadingMetadata?.contentMetadata?.coverImage) {
              <app-card-image
                [height]="row.carousel?.coverImageHeight"
                [borderRadius]="row.carousel?.coverImageBorderRadius"
                [focalPoint]="coverImageFocalPoint()"
                [imageSource]="urlService.imageSourceFor({image:lazyLoadingMetadata.contentMetadata?.coverImage},
                                  lazyLoadingMetadata.contentMetadata)">
              </app-card-image>
            }
          </div>
        }
        @if (row.carousel?.showPreAlbumText) {
          <div markdown [data]="row.carousel.preAlbumText" class="col-sm-12 mt-2"></div>
        }
        <div class="col-sm-12">
          <app-album (lazyLoadingMetadataChange)="onLazyLoadingMetadataChange($event)"
                     [album]="row.carousel" [index]="index"/>
        </div>
      </div>
    }`,
  imports: [MarkdownComponent, CardImageComponent, AlbumComponent, DisplayDayPipe, SocialShareAlbumComponent, SocialPostLinksComponent, FontAwesomeModule]
})
export class DynamicContentViewAlbum implements OnInit, OnDestroy {
  protected readonly AlbumView = AlbumView;
  protected readonly faShareNodes = faShareNodes;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronUp = faChevronUp;
  public lazyLoadingMetadata: LazyLoadingMetadata;
  public shareAlbumContentMetadata: ContentMetadata = null;
  public canShareAlbum = false;
  public shareExpanded = false;
  public hasSocialPostLinks = false;
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  public urlService: UrlService = inject(UrlService);
  private memberLoginService = inject(MemberLoginService);
  private socialPublishService = inject(SocialPublishService);
  private eventSlugResolver = inject(EventSlugResolverService);
  private broadcastService = inject(BroadcastService);
  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger: Logger = this.loggerFactory.createLogger("DynamicContentViewAlbumComponent", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];

  @Input()
  public row: PageContentRow;
  @Input()
  public index: number;

  ngOnInit() {
    this.logger.info("ngOnInit for", this.row.carousel?.name);
    this.refreshShareAccess();
    this.loadSocialPostLinkPresence();
    this.subscriptions.push(
      this.broadcastService.on(NamedEventType.MEMBER_LOGIN_COMPLETE, () => this.refreshShareAccess()),
      this.broadcastService.on(NamedEventType.MEMBER_LOGOUT_COMPLETE, () => this.refreshShareAccess())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshShareAccess(): void {
    const albumAllowsShare = !!this.row?.carousel?.allowSocialShare;
    const allowed = albumAllowsShare && !!this.memberLoginService.allowContentEdits();
    this.canShareAlbum = allowed;
    if (allowed) {
      if (!this.shareAlbumContentMetadata) {
        this.loadShareAlbumContentMetadata();
      }
    } else {
      this.shareExpanded = false;
      this.shareAlbumContentMetadata = null;
    }
    this.logger.info("refreshShareAccess: canShareAlbum", allowed, "albumAllowsShare", albumAllowsShare);
  }

  toggleShare(): void {
    if (this.shareExpanded) {
      this.collapseShare();
    } else {
      this.expandShare();
    }
  }

  expandShare(): void {
    this.shareExpanded = true;
    if (this.canShareAlbum && !this.shareAlbumContentMetadata) {
      this.loadShareAlbumContentMetadata();
    }
  }

  collapseShare(): void {
    this.shareExpanded = false;
  }

  eventLinkId(): string {
    return this.eventSlugResolver.slugOrId(this.row?.carousel?.eventId);
  }

  shareBarVisible(): boolean {
    return this.canShareAlbum || this.hasSocialPostLinks;
  }

  showSocialPostLinksConfigured(): boolean {
    return !!this.row?.carousel?.name
      && this.row?.carousel?.albumView !== AlbumView.BACKGROUNDS
      && this.row?.carousel?.showSocialPostLinks !== false;
  }

  private loadSocialPostLinkPresence(): void {
    if (!this.showSocialPostLinksConfigured()) {
      this.hasSocialPostLinks = false;
    } else {
      const albumName = this.row?.carousel?.name;
      if (!albumName) {
        this.hasSocialPostLinks = false;
      } else {
        this.socialPublishService.publicationsForAlbum(albumName)
          .then(publications => {
            this.hasSocialPostLinks = (publications || []).some(publication => !!publication.permalink);
            this.logger.info("loadSocialPostLinkPresence:", albumName, "hasSocialPostLinks:", this.hasSocialPostLinks);
          })
          .catch(error => {
            this.hasSocialPostLinks = false;
            this.logger.error("loadSocialPostLinkPresence failed for", albumName, error);
          });
      }
    }
  }

  shareAlbumCaption(): string {
    return this.row?.carousel?.preAlbumText || this.row?.carousel?.introductoryText || "";
  }

  onLazyLoadingMetadataChange(metadata: LazyLoadingMetadata) {
    this.lazyLoadingMetadata = metadata;
    if (this.canShareAlbum && metadata?.contentMetadata?.files?.length) {
      this.shareAlbumContentMetadata = metadata.contentMetadata;
    }
  }

  private loadShareAlbumContentMetadata(): void {
    const albumName = this.row?.carousel?.name;
    if (!albumName) {
      this.shareAlbumContentMetadata = null;
    } else {
      this.contentMetadataService.items(RootFolder.carousels, albumName)
        .then(contentMetadata => {
          if (this.canShareAlbum) {
            this.shareAlbumContentMetadata = contentMetadata;
          }
        })
        .catch(error => {
          this.logger.error("could not load album content metadata for social share:", albumName, error);
          this.shareAlbumContentMetadata = null;
        });
    }
  }

  coverImageFocalPoint(): FocalPoint | null {
    const focalPointTarget = this.row?.carousel?.coverImageFocalPointTarget || FocalPointTarget.BOTH;
    const applyFocalPointToCover = [FocalPointTarget.COVER_IMAGE, FocalPointTarget.BOTH].includes(focalPointTarget);
    return applyFocalPointToCover ? this.row?.carousel?.coverImageFocalPoint : null;
  }

}
