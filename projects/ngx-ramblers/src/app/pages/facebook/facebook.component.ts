import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { take } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faImages } from "@fortawesome/free-solid-svg-icons";
import { faFacebook } from "@fortawesome/free-brands-svg-icons";
import { FacebookPagePost, FacebookPageProfile, FacebookRecentPostsData } from "../../models/facebook.model";
import { ExternalSystems } from "../../models/system.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { FacebookService } from "../../services/facebook.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { CardContainerComponent } from "../../modules/common/card-container/card-container.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-facebook",
  template: `
    <app-card-container [icon]="faFacebook" [title]="accountName()" [subtitle]="followerSummary()"
                        [href]="pageHref()" [brandColour]="brandColour">
      @if (loading) {
        <div class="facebook-post-list" aria-busy="true" aria-label="Loading recent posts">
          @for (placeholder of skeletonRows; track placeholder) {
            <div class="facebook-post-skeleton">
              <div class="facebook-skeleton-thumb"></div>
              <div class="facebook-skeleton-lines">
                <div class="facebook-skeleton-line"></div>
                <div class="facebook-skeleton-line short"></div>
              </div>
            </div>
          }
        </div>
      } @else if (loadError) {
        <div class="alert alert-warning d-flex align-items-start mb-0">
          <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1 me-2"/>
          <div>
            <strong class="d-block">Facebook feed unavailable</strong>
            {{ loadError }}
          </div>
        </div>
      } @else if (recentPosts.length > 0) {
        <div class="facebook-post-list">
          @for (post of recentPosts; track post.id) {
            <a class="facebook-post" [href]="post.permalink" target="_blank" rel="noopener noreferrer"
               delay="500" [tooltip]="postTooltip(post)" [placement]="'top'"
               containerClass="social-media-tooltip">
              @if (post.imageUrl) {
                <span class="facebook-post-thumb">
                  <img [src]="post.imageUrl" [alt]="post.message || 'Facebook post'"/>
                  @if (post.imageCount > 1) {
                    <span class="facebook-post-count">
                      <fa-icon [icon]="faImages"/>
                      {{ post.imageCount }}
                    </span>
                  }
                </span>
              } @else {
                <span class="facebook-post-thumb facebook-post-thumb-empty">
                  <fa-icon [icon]="faFacebook"/>
                </span>
              }
              <span class="facebook-post-copy">
                <span class="facebook-post-message">{{ post.message }}</span>
                <span class="facebook-post-meta">{{ postMeta(post) }}</span>
              </span>
            </a>
          }
        </div>
      } @else if (externalSystems?.facebook?.showFeed) {
        <div class="alert alert-warning d-flex align-items-start mb-0">
          <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1 me-2"/>
          <div>
            <strong class="d-block">No Facebook posts yet</strong>
            Connect a Facebook Page in System Settings, or check that the Page has public posts.
          </div>
        </div>
      }
    </app-card-container>
  `,
  styleUrls: ["./facebook.component.sass"],
  imports: [CardContainerComponent, TooltipDirective, FontAwesomeModule]
})
export class FacebookComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("FacebookComponent", NgxLoggerLevel.ERROR);
  private facebookService = inject(FacebookService);
  private systemConfigService = inject(SystemConfigService);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);
  public recentPosts: FacebookPagePost[] = [];
  public profile: FacebookPageProfile;
  public externalSystems: ExternalSystems;
  public loading = false;
  public loadError = "";
  private loadInFlight = false;
  private readonly feedSize = 5;
  private subscriptions: Subscription[] = [];
  protected readonly skeletonRows = Array.from({length: this.feedSize}, (ignored, index) => index);
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faFacebook = faFacebook;
  protected readonly faImages = faImages;
  protected readonly brandColour = "#1877f2";

  ngOnInit() {
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.externalSystems = item.externalSystems;
      this.logger.debug("system config event: facebook config:", this.externalSystems?.facebook);
      this.loadRecentPosts();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  pageHref(): string {
    return this.externalSystems?.facebook?.groupUrl || this.profile?.link || "";
  }

  accountName(): string {
    return this.profile?.name || "Facebook";
  }

  followerSummary(): string {
    const followers = this.profile?.followersCount;
    return followers ? this.stringUtils.pluraliseWithCount(followers, "follower") : this.pageName();
  }

  postMeta(post: FacebookPagePost): string {
    const when = post?.createdTime ? `Posted ${this.dateUtils.relativePastDayPhrase(post.createdTime)}` : "";
    return [post?.authorName, when].filter(Boolean).join(" · ");
  }

  postTooltip(post: FacebookPagePost): string {
    const when = post?.createdTime ? this.dateUtils.displayDate(post.createdTime) : "";
    const photos = post?.imageCount > 0 ? this.stringUtils.pluraliseWithCount(post.imageCount, "photo") : "";
    const author = post?.authorName ? `posted by ${post.authorName}` : "";
    return ["Open this post on Facebook", [when, author, photos].filter(Boolean).join(" · ")].filter(Boolean).join(" - ");
  }

  private pageName(): string {
    const groupUrl = this.externalSystems?.facebook?.groupUrl;
    return groupUrl ? groupUrl.replace(/\/+$/, "").split("/").pop() : "";
  }

  private loadRecentPosts(): void {
    if (!this.externalSystems?.facebook?.showFeed) {
      this.logger.debug("showFeed is not enabled - clearing feed. facebook config:", this.externalSystems?.facebook);
      this.recentPosts = [];
      this.loadError = "";
      this.loading = false;
    } else if (this.loadInFlight) {
      this.logger.debug("load already in flight - ignoring this config event");
    } else {
      this.loadInFlight = true;
      this.loading = true;
      this.loadError = "";
      this.facebookService.recentPosts()
        .then((recentPosts: FacebookRecentPostsData) => {
          const returned = recentPosts?.data || [];
          this.profile = recentPosts?.profile;
          this.recentPosts = take(returned, this.feedSize);
          this.logger.debug("recent posts response: returned:", returned.length, "displaying:", this.recentPosts.length);
        })
        .catch(error => {
          this.recentPosts = [];
          this.loadError = error?.error?.error || error?.message || "Could not load Facebook posts";
          this.logger.error("facebook recent posts failed:", this.loadError, error);
        })
        .finally(() => {
          this.loading = false;
          this.loadInFlight = false;
        });
    }
  }
}
