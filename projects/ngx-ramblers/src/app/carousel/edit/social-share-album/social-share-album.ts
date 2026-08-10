import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FormsModule } from "@angular/forms";
import { DatePipe, TitleCasePipe } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faFacebook, faInstagram } from "@fortawesome/free-brands-svg-icons";
import {
  faCheck,
  faCheckDouble,
  faCircleCheck,
  faCircleExclamation,
  faImages,
  faShareNodes,
  faSpinner,
  faWandMagicSparkles,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import { ContentMetadata, ContentMetadataItem } from "../../../models/content-metadata.model";
import {
  INSTAGRAM_MAX_ASPECT_RATIO,
  INSTAGRAM_MAX_CAROUSEL_IMAGES,
  INSTAGRAM_MIN_ASPECT_RATIO,
  INSTAGRAM_MIN_CAROUSEL_IMAGES,
  SocialNetwork,
  SocialPublication,
  SocialPublishProgress,
  SocialPublishResult
} from "../../../models/social-publish.model";
import { ExternalSystemsSubTab, SystemConfig, SystemSettingsTab } from "../../../models/system.model";
import { AdminSettingsPath } from "../../../models/admin-route-paths.model";
import { StoredValue } from "../../../models/ui-actions";
import { facebookPublishingEnabled, instagramPublishingEnabled } from "../../../functions/social-publishing";
import { RouterLink } from "@angular/router";
import { kebabCase } from "es-toolkit/compat";
import { AlertTarget } from "../../../models/alert-target.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { SocialPublishService } from "../../../services/social/social-publish.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { AiService } from "../../../services/ai/ai.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { EmojiTextareaComponent } from "../../../modules/common/emoji-textarea/emoji-textarea";

@Component({
  selector: "app-social-share-album",
  styles: [`
    :host
      display: block

    .share-panel
      border: 1px solid var(--rsm-border, rgba(15, 23, 42, 0.15))
      border-radius: var(--rsm-panel-radius, 10px)
      background: linear-gradient(180deg, #fffef9 0%, #ffffff 48%)
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)
      overflow: hidden

    .share-header
      display: flex
      flex-wrap: wrap
      align-items: center
      justify-content: space-between
      gap: var(--space-3, 12px)
      padding: var(--space-4, 16px) var(--space-5, 20px)
      border-bottom: 1px solid var(--rsm-border, rgba(15, 23, 42, 0.12))

    .share-header-main
      display: flex
      align-items: center
      gap: var(--space-3, 12px)
      min-width: 0

    .share-icon-badge
      display: inline-flex
      align-items: center
      justify-content: center
      width: 42px
      height: 42px
      border-radius: 50%
      background: linear-gradient(135deg, #f9b104 0%, #d99c0a 100%)
      color: #1a1a1a
      flex-shrink: 0
      box-shadow: 0 2px 6px rgba(217, 156, 10, 0.35)

    .share-title-block
      min-width: 0

    .share-title
      margin: 0
      font-size: 1.1rem
      font-weight: 700
      line-height: 1.25
      color: var(--rsm-text, rgb(64, 65, 65))

    .share-subtitle
      margin: 2px 0 0
      font-size: 0.875rem
      color: var(--rsm-muted, rgb(110, 112, 115))
      line-height: 1.35

    .share-header-actions
      display: flex
      flex-direction: row
      flex-wrap: wrap
      align-items: stretch
      gap: var(--space-2, 8px)

    .network-toggle.shared
      cursor: default
      flex: 0 0 auto
      max-width: none
      border-color: #d99c0a
      background: rgba(249, 177, 4, 0.1)

    .network-shared-link
      margin-left: auto
      font-size: 0.8rem
      font-weight: 600
      white-space: nowrap
      color: var(--rsm-text, rgb(64, 65, 65))
      text-decoration: underline

    @media (max-width: 575.98px)
      .share-header-actions
        width: 100%

      .network-toggle.shared
        flex: 1 1 100%

    .share-body
      padding: var(--space-4, 16px) var(--space-5, 20px) var(--space-5, 20px)

    .share-body.collapsed
      padding: 0

    .network-toggles
      display: flex
      flex-wrap: wrap
      gap: var(--space-3, 12px)
      margin-bottom: var(--space-4, 16px)

    .network-toggle
      display: flex
      align-items: center
      gap: 10px
      min-height: 44px
      padding: 10px 16px
      border-radius: var(--radius-3, 8px)
      border: 2px solid var(--rsm-border, rgba(15, 23, 42, 0.15))
      background: #fff
      cursor: pointer
      transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease
      user-select: none
      flex: 1 1 180px
      max-width: 280px

    .network-toggle:hover:not(.shared)
      border-color: rgba(217, 156, 10, 0.55)
      background: rgba(249, 177, 4, 0.04)

    .network-toggle.active
      border-color: #d99c0a
      background: rgba(249, 177, 4, 0.1)
      box-shadow: 0 0 0 1px rgba(217, 156, 10, 0.2)

    .network-toggle-icon
      font-size: 1.35rem
      line-height: 1

    .icon-facebook
      color: #1877f2

    .icon-instagram
      color: #e4405f

    .network-toggle-label
      display: flex
      flex-direction: column
      gap: 1px
      min-width: 0

    .network-toggle-name
      font-weight: 700
      font-size: 0.95rem
      color: var(--rsm-text, rgb(64, 65, 65))

    .network-toggle-status
      font-size: 0.75rem
      color: var(--rsm-muted, rgb(110, 112, 115))

    .network-toggle-check
      margin-left: auto
      color: #146c43
      font-size: 0.95rem

    .section-label
      display: flex
      align-items: center
      justify-content: space-between
      gap: var(--space-3, 12px)
      margin-bottom: var(--space-2, 8px)
      font-weight: 700
      font-size: 0.9rem
      color: var(--rsm-text, rgb(64, 65, 65))

    .section-meta
      font-weight: 500
      font-size: 0.8rem
      color: var(--rsm-muted, rgb(110, 112, 115))

    .selection-actions
      display: flex
      flex-wrap: wrap
      justify-content: flex-end
      gap: var(--space-2, 8px)

    .selection-actions .btn + .btn
      margin-left: 0

    .utility-action
      min-height: 40px
      padding: 0 7px
      border-radius: var(--radius-2, 6px)
      font-family: inherit
      font-size: 0.75rem
      font-weight: 700
      line-height: 1.1
      cursor: pointer
      display: inline-flex
      align-items: center
      justify-content: center
      gap: 4px

    .utility-action fa-icon
      font-size: 0.7rem

    .image-grid
      display: flex
      flex-wrap: wrap
      gap: 8px
      margin-top: var(--space-2, 8px)

    .image-tile
      position: relative
      width: 88px
      height: 88px
      border-radius: var(--radius-2, 6px)
      overflow: hidden
      cursor: pointer
      border: 2px solid transparent
      transition: border-color 0.12s ease, opacity 0.12s ease, transform 0.12s ease
      background: #f1f3f5

    .image-tile:hover
      transform: translateY(-1px)

    .image-tile.selected
      border-color: #d99c0a
      box-shadow: 0 0 0 1px rgba(217, 156, 10, 0.35)

    .image-tile.selected.ratio-warning
      border-color: #c05711
      box-shadow: 0 0 0 2px rgba(192, 87, 17, 0.45)

    .image-tile:not(.selected)
      opacity: 0.45

    .image-tile img
      width: 100%
      height: 100%
      object-fit: cover
      display: block

    .image-check
      position: absolute
      top: 4px
      right: 4px
      width: 22px
      height: 22px
      border-radius: 50%
      background: #d99c0a
      color: #1a1a1a
      display: flex
      align-items: center
      justify-content: center
      font-size: 0.7rem
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2)

    .image-ratio-warning
      position: absolute
      top: 4px
      left: 4px
      width: 22px
      height: 22px
      border-radius: 50%
      background: #c05711
      color: #fff
      display: flex
      align-items: center
      justify-content: center
      font-size: 0.7rem
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25)
      z-index: 1

    .share-footer
      display: flex
      flex-wrap: wrap
      align-items: center
      justify-content: space-between
      gap: var(--space-3, 12px)
      margin-top: var(--space-4, 16px)
      padding-top: var(--space-4, 16px)
      border-top: 1px solid var(--rsm-border, rgba(15, 23, 42, 0.1))

    .publish-btn
      min-height: 44px
      min-width: 200px
      font-weight: 700
      display: inline-flex
      align-items: center
      justify-content: center
      gap: 8px

    .back-btn
      min-height: 44px
      font-weight: 600
      display: inline-flex
      align-items: center
      justify-content: center
      gap: 8px

    .footer-actions
      display: flex
      flex-wrap: wrap
      align-items: center
      gap: var(--space-2, 8px)

    .publish-progress
      display: flex
      flex-direction: column
      gap: 6px
      flex: 1 1 200px
      min-width: 0

    .publish-progress-message
      font-size: 0.85rem
      font-weight: 600
      color: var(--rsm-text, rgb(64, 65, 65))
      line-height: 1.3

    .publish-progress-bar
      height: 8px
      border-radius: 999px
      background: rgba(15, 23, 42, 0.08)
      overflow: hidden

    .publish-progress-fill
      height: 100%
      border-radius: 999px
      background: linear-gradient(90deg, #f9b104 0%, #d99c0a 100%)
      transition: width 0.25s ease
      min-width: 4px

    .not-configured
      margin: 0

    .caption-generating
      display: flex
      align-items: center
      gap: 8px
      margin-bottom: var(--space-3, 12px)
      font-size: 0.85rem
      color: var(--rsm-muted, rgb(110, 112, 115))

  `],
  template: `
    <div class="share-panel">
      <div class="share-header">
        <div class="share-header-main">
          <span class="share-icon-badge" aria-hidden="true">
            <fa-icon [icon]="faShareNodes"/>
          </span>
          <div class="share-title-block">
            <h2 class="share-title">Share this album</h2>
            <p class="share-subtitle">
              @if (!contentMetadata?.files?.length) {
                Loading album photos…
              } @else if (!facebookEnabled && !instagramEnabled) {
                Connect Facebook or Instagram in
                <a [routerLink]="'/' + adminSettingsSystemSettingsPath"
                   [queryParams]="socialSettingsQueryParams">System Settings</a> to publish
              } @else if (allNetworksPublished()) {
                This album has already been shared
              } @else {
                Choose networks, caption and photos, then publish
              }
            </p>
          </div>
        </div>
        @if (publishedNetworksList().length > 0) {
          <div class="share-header-actions">
            @for (network of publishedNetworksList(); track network) {
              <div class="network-toggle shared">
                <fa-icon class="network-toggle-icon"
                         [class.icon-facebook]="network === SocialNetwork.FACEBOOK"
                         [class.icon-instagram]="network === SocialNetwork.INSTAGRAM"
                         [icon]="network === SocialNetwork.FACEBOOK ? faFacebook : faInstagram"/>
                <span class="network-toggle-label">
                  <span class="network-toggle-name">{{ network | titlecase }}</span>
                  <span class="network-toggle-status">
                    @if (publishedAtFor(network)) {
                      Shared {{ publishedAtFor(network) | date: "d MMM yyyy" }}
                    } @else {
                      Shared just now
                    }
                  </span>
                </span>
                @if (publishedPermalinkFor(network)) {
                  <a class="network-shared-link"
                     [href]="publishedPermalinkFor(network)" target="_blank" rel="noopener">View post</a>
                }
                <fa-icon class="network-toggle-check" [icon]="faCheck"/>
              </div>
            }
          </div>
        }
      </div>

      <div class="share-body" [class.collapsed]="!!contentMetadata?.files?.length && allNetworksPublished()">
          @if (!contentMetadata?.files?.length) {
            <div class="alert alert-warning d-flex align-items-start not-configured">
              <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1 me-2"/>
              <div>
                <strong class="d-block">Loading album</strong>
                Photos will appear here once the album has finished loading.
              </div>
            </div>
            <div class="share-footer">
              <span class="section-meta">Please wait a moment</span>
              <button type="button" class="btn btn-secondary back-btn" (click)="done.emit()">
                <fa-icon [icon]="faImages"/>
                Back to album
              </button>
            </div>
          } @else if (!facebookEnabled && !instagramEnabled) {
            <div class="alert alert-warning d-flex align-items-start not-configured">
              <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1 me-2"/>
              <div>
                <strong class="d-block">Not configured</strong>
                Enable Facebook and/or Instagram publishing in
                <a [routerLink]="'/' + adminSettingsSystemSettingsPath"
                   [queryParams]="socialSettingsQueryParams">System Settings → External Systems</a>.
              </div>
            </div>
            <div class="share-footer">
              <span class="section-meta">Publishing is not available yet</span>
              <button type="button" class="btn btn-secondary back-btn" (click)="done.emit()">
                <fa-icon [icon]="faImages"/>
                Back to album
              </button>
            </div>
          } @else if (allNetworksPublished()) {
          } @else {
            <div class="network-toggles">
              @if (facebookEnabled && !networkBlocked(SocialNetwork.FACEBOOK)) {
                <div class="network-toggle"
                     [class.active]="postToFacebook"
                     (click)="toggleNetwork(SocialNetwork.FACEBOOK)"
                     role="checkbox"
                     [attr.aria-checked]="postToFacebook">
                  <fa-icon class="network-toggle-icon icon-facebook" [icon]="faFacebook"/>
                  <span class="network-toggle-label">
                    <span class="network-toggle-name">Facebook</span>
                    <span class="network-toggle-status">
                      {{ postToFacebook ? "Will publish" : "Not selected" }}
                    </span>
                  </span>
                  @if (postToFacebook) {
                    <fa-icon class="network-toggle-check" [icon]="faCheck"/>
                  }
                </div>
              }
              @if (instagramEnabled && !networkBlocked(SocialNetwork.INSTAGRAM)) {
                <div class="network-toggle"
                     [class.active]="postToInstagram"
                     (click)="toggleNetwork(SocialNetwork.INSTAGRAM)"
                     role="checkbox"
                     [attr.aria-checked]="postToInstagram">
                  <fa-icon class="network-toggle-icon icon-instagram" [icon]="faInstagram"/>
                  <span class="network-toggle-label">
                    <span class="network-toggle-name">Instagram</span>
                    <span class="network-toggle-status">
                      {{ postToInstagram ? "Will publish" : "Not selected" }}
                    </span>
                  </span>
                  @if (postToInstagram) {
                    <fa-icon class="network-toggle-check" [icon]="faCheck"/>
                  }
                </div>
              }
            </div>

            <div class="mb-3">
              <div class="section-label">
                <span>Caption</span>
              </div>
              <app-emoji-textarea [(ngModel)]="caption" inputId="share-caption" [rows]="3"
                                  placeholder="Write the post caption. Type :sun for emojis"/>
            </div>

            <div class="form-check mb-3">
              <input [(ngModel)]="separateCaptions" (ngModelChange)="onSeparateCaptionsChange($event)"
                     type="checkbox" class="form-check-input" id="share-separate-captions"
                     [disabled]="generatingCaptions">
              <label class="form-check-label" for="share-separate-captions">
                Use a different caption per network
              </label>
            </div>

            @if (separateCaptions) {
              @if (generatingCaptions) {
                <div class="caption-generating">
                  <fa-icon [icon]="faSpinner" animation="spin"/>
                  Writing platform captions…
                </div>
              } @else if (hasCaptionTargets()) {
                <div class="mb-3">
                  <button type="button" class="btn btn-quiet utility-action"
                          [disabled]="!caption?.trim() || generatingCaptions"
                          (click)="generateNetworkCaptions()">
                    <fa-icon [icon]="faWandMagicSparkles"/>
                    Regenerate platform captions
                  </button>
                </div>
              }
              @if (facebookEnabled && !networkBlocked(SocialNetwork.FACEBOOK)) {
                <div class="mb-3">
                  <div class="section-label">
                    <span><fa-icon [icon]="faFacebook" class="me-1 icon-facebook"/> Facebook caption</span>
                    <span class="section-meta">{{ generatingCaptions ? "Generating…" : "Editable" }}</span>
                  </div>
                  <app-emoji-textarea [(ngModel)]="captionFacebook" inputId="share-caption-facebook" [rows]="3"
                                      [disabled]="generatingCaptions"
                                      placeholder="Facebook caption will appear here. Type :sun for emojis"/>
                </div>
              }
              @if (instagramEnabled && !networkBlocked(SocialNetwork.INSTAGRAM)) {
                <div class="mb-3">
                  <div class="section-label">
                    <span><fa-icon [icon]="faInstagram" class="me-1 icon-instagram"/> Instagram caption</span>
                    <span class="section-meta">{{ generatingCaptions ? "Generating…" : "Editable" }}</span>
                  </div>
                  <app-emoji-textarea [(ngModel)]="captionInstagram" inputId="share-caption-instagram" [rows]="3"
                                      [disabled]="generatingCaptions"
                                      placeholder="Instagram caption will appear here. Type :sun for emojis"/>
                </div>
              }
            }

            <div class="mb-2">
              @if (postToFacebook && !networkBlocked(SocialNetwork.FACEBOOK)) {
                <div class="section-label">
                  <span><fa-icon [icon]="faFacebook" class="me-1 icon-facebook"/> Facebook photos</span>
                  <span class="section-meta">All {{ stringUtils.pluraliseWithCount(images.length, "photo") }} will be shared</span>
                </div>
              }
              @if (postToInstagram && !networkBlocked(SocialNetwork.INSTAGRAM)) {
                <div class="section-label">
                  <span><fa-icon [icon]="faInstagram" class="me-1 icon-instagram"/> Instagram photos
                    <span class="section-meta">({{ selectedCount() }} of {{ images.length }} selected)</span></span>
                  <div class="selection-actions">
                    <button type="button" class="btn btn-quiet utility-action" (click)="selectAll()">
                      <fa-icon [icon]="faCheckDouble"/>
                      Select all
                    </button>
                    <button type="button" class="btn btn-quiet utility-action" (click)="selectNone()">
                      <fa-icon [icon]="faXmark"/>
                      Clear
                    </button>
                    @if (!instagramCountValid()) {
                      <button type="button" class="btn btn-quiet utility-action" (click)="autoChooseForInstagram()">
                        <fa-icon [icon]="faImages"/>
                        Auto-choose for Instagram
                      </button>
                    }
                  </div>
                </div>
                <div class="alert {{ instagramCountValid() ? 'alert-success' : 'alert-warning' }} d-flex align-items-start mb-2">
                  <fa-icon [icon]="instagramCountValid() ? faCircleCheck : faCircleExclamation"
                           class="flex-shrink-0 mt-1 me-2"/>
                  <div class="flex-grow-1">
                    <strong class="d-block">Instagram image count</strong>
                    @if (instagramCountValid()) {
                      {{ stringUtils.pluraliseWithCount(selectedCount(), "image") }} selected
                      (between {{ INSTAGRAM_MIN_CAROUSEL_IMAGES }} and {{ INSTAGRAM_MAX_CAROUSEL_IMAGES }} is allowed).
                    } @else {
                      Select between {{ INSTAGRAM_MIN_CAROUSEL_IMAGES }} and {{ INSTAGRAM_MAX_CAROUSEL_IMAGES }} images
                      (currently {{ selectedCount() }}).
                      <div class="mt-2">
                        <button type="button" class="btn btn-quiet utility-action"
                                (click)="autoChooseForInstagram()">
                          <fa-icon [icon]="faImages"/>
                          Auto-choose for Instagram
                        </button>
                      </div>
                    }
                  </div>
                </div>
                @if (imagesOutsideInstagramRatio() === 0 || !instagramCountValid()) {
                  <div class="alert {{ imagesOutsideInstagramRatio() === 0 ? 'alert-success' : 'alert-warning' }} d-flex align-items-start mb-2">
                    <fa-icon [icon]="imagesOutsideInstagramRatio() === 0 ? faCircleCheck : faCircleExclamation"
                             class="flex-shrink-0 mt-1 me-2"/>
                    <div>
                      <strong class="d-block">Instagram aspect ratio</strong>
                      @if (imagesOutsideInstagramRatio() === 0) {
                        All selected images are within Instagram's 4:5 to 1.91:1 range.
                      } @else {
                        {{ stringUtils.pluraliseWithCount(imagesOutsideInstagramRatio(), "selected image") }}
                        outside Instagram's 4:5 to 1.91:1 range will be intelligently cropped to the nearest supported shape before publishing.
                        The album originals will not be changed. Adapted photos are marked on the grid.
                      }
                    </div>
                  </div>
                }
                <div class="image-grid">
                  @for (item of images; track item.image) {
                  <div class="image-tile"
                       [class.selected]="isSelected(item)"
                       [class.ratio-warning]="showInstagramRatioWarning(item)"
                       [attr.title]="showInstagramRatioWarning(item) ? 'Will be intelligently cropped for Instagram' : null"
                       (click)="toggle(item)" role="checkbox" [attr.aria-checked]="isSelected(item)">
                    <img [src]="urlService.imageSourceFor(item, contentMetadata)" alt=""
                         (load)="onImageLoad(item, $event)">
                    @if (showInstagramRatioWarning(item)) {
                      <span class="image-ratio-warning" aria-label="Will be intelligently cropped for Instagram">
                        <fa-icon [icon]="faCircleExclamation"/>
                      </span>
                    }
                    @if (isSelected(item)) {
                      <span class="image-check" aria-hidden="true">
                        <fa-icon [icon]="faCheck"/>
                      </span>
                    }
                  </div>
                  }
                </div>
              }
            </div>

            @if (notifyTarget.showAlert) {
              <div class="alert {{ notifyTarget.alertClass }} d-flex align-items-start mt-3 mb-0">
                <fa-icon [icon]="notifyTarget.alert.icon" class="flex-shrink-0 mt-1 me-2"/>
                <div>
                  @if (notifyTarget.alertTitle) {
                    <strong class="d-block">{{ notifyTarget.alertTitle }}</strong>
                  }
                  {{ notifyTarget.alertMessage }}
                </div>
              </div>
            }

            @for (result of results; track result.network) {
              @if (!result.success) {
                <div class="alert alert-warning d-flex align-items-start mt-2 mb-0">
                  <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1 me-2"/>
                  <div>
                    <strong class="d-block">{{ result.network | titlecase }}</strong>
                    {{ result.error }}
                  </div>
                </div>
              }
            }

            <div class="share-footer">
              @if (publishing && publishProgress) {
                <div class="publish-progress">
                  <span class="publish-progress-message">
                    {{ publishProgress.message }}
                    @if (publishProgress.percent !== null && publishProgress.percent !== undefined) {
                      ({{ publishProgress.percent }}%)
                    }
                  </span>
                  <div class="publish-progress-bar" role="progressbar"
                       [attr.aria-valuenow]="publishProgress.percent || 0"
                       aria-valuemin="0" aria-valuemax="100"
                       [attr.aria-label]="publishProgress.message">
                    <div class="publish-progress-fill"
                         [style.width.%]="publishProgress.percent || 0"></div>
                  </div>
                </div>
              } @else {
                <span class="section-meta">
                  @if (publishableNetworks().length === 0) {
                    Choose at least one network that has not been published yet
                  } @else {
                    Ready to publish to {{ stringUtils.pluraliseWithCount(publishableNetworks().length, "network") }}
                  }
                </span>
              }
              <div class="footer-actions">
                <button type="button" class="btn btn-secondary back-btn" (click)="done.emit()"
                        [disabled]="publishing">
                  <fa-icon [icon]="faImages"/>
                  Back to album
                </button>
                <button type="button" class="btn btn-primary publish-btn"
                        [disabled]="publishDisabled()" (click)="publish()">
                  @if (publishing) {
                    <fa-icon [icon]="faSpinner" animation="spin"/>
                    Publishing…
                  } @else {
                    <fa-icon [icon]="faShareNodes"/>
                    Publish to social
                  }
                </button>
              </div>
            </div>
          }
      </div>
    </div>`,
  imports: [FormsModule, FontAwesomeModule, TitleCasePipe, DatePipe, EmojiTextareaComponent, RouterLink]
})
export class SocialShareAlbumComponent implements OnInit, OnDestroy {

  public contentMetadata: ContentMetadata = null;
  @Input() caption = "";
  @Input() eventDate: number = null;
  @Input() walkTitle = "";
  @Output() done = new EventEmitter<void>();

  @Input("contentMetadata") set contentMetadataValue(contentMetadata: ContentMetadata) {
    this.contentMetadata = contentMetadata || null;
    this.refreshFromMetadata();
  }

  protected postToFacebook = false;
  protected postToInstagram = false;
  protected separateCaptions = false;
  protected captionFacebook = "";
  protected captionInstagram = "";
  protected generatingCaptions = false;
  protected images: ContentMetadataItem[] = [];
  private selected = new Set<string>();
  protected results: SocialPublishResult[] = [];
  protected publishing = false;
  protected publishProgress: SocialPublishProgress = null;
  protected priorPublications: SocialPublication[] = [];
  private publishedNetworks = new Set<SocialNetwork>();
  private aspectRatios = new Map<string, number>();
  private config: SystemConfig;
  private subscriptions: Subscription[] = [];

  protected readonly SocialNetwork = SocialNetwork;
  protected readonly faFacebook = faFacebook;
  protected readonly faInstagram = faInstagram;
  protected readonly faShareNodes = faShareNodes;
  protected readonly faImages = faImages;
  protected readonly faCheck = faCheck;
  protected readonly faCheckDouble = faCheckDouble;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faSpinner = faSpinner;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly faXmark = faXmark;
  protected readonly INSTAGRAM_MIN_CAROUSEL_IMAGES = INSTAGRAM_MIN_CAROUSEL_IMAGES;
  protected readonly INSTAGRAM_MAX_CAROUSEL_IMAGES = INSTAGRAM_MAX_CAROUSEL_IMAGES;

  private systemConfigService = inject(SystemConfigService);
  private socialPublishService = inject(SocialPublishService);
  private notifierService = inject(NotifierService);
  private aiService = inject(AiService);
  private dateUtils = inject(DateUtilsService);
  protected urlService = inject(UrlService);
  protected stringUtils = inject(StringUtilsService);
  private logger = inject(LoggerFactory).createLogger("SocialShareAlbumComponent", NgxLoggerLevel.ERROR);
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  ngOnInit() {
    this.refreshFromMetadata();
    this.subscriptions.push(this.systemConfigService.events().subscribe(config => {
      this.config = config;
      this.applyDefaults();
    }));
  }

  private refreshFromMetadata(): void {
    this.images = (this.contentMetadata?.files || []).filter(item => item.image);
    this.selected = new Set(this.images.map(item => item.image));
    if (this.contentMetadata?.name) {
      this.socialPublishService.publicationsForAlbum(this.contentMetadata.name)
        .then(publications => {
          this.priorPublications = publications;
          this.applyDefaults();
        })
        .catch(error => this.logger.error("could not load prior publications", error));
    } else {
      this.priorPublications = [];
      this.images = [];
      this.selected = new Set();
      this.applyDefaults();
    }
  }

  private applyDefaults(): void {
    this.postToFacebook = this.facebookEnabled && !this.publishedPreviously(SocialNetwork.FACEBOOK);
    this.postToInstagram = this.instagramEnabled && !this.publishedPreviously(SocialNetwork.INSTAGRAM);
  }

  publishedPreviously(network: SocialNetwork): boolean {
    return this.priorPublications.some(publication => publication.network === network);
  }

  publishedNetworksList(): SocialNetwork[] {
    return [
      this.facebookEnabled && this.networkBlocked(SocialNetwork.FACEBOOK) ? SocialNetwork.FACEBOOK : null,
      this.instagramEnabled && this.networkBlocked(SocialNetwork.INSTAGRAM) ? SocialNetwork.INSTAGRAM : null
    ].filter(Boolean);
  }

  private publicationFor(network: SocialNetwork): SocialPublication | null {
    return this.priorPublications.find(publication => publication.network === network) || null;
  }

  publishedAtFor(network: SocialNetwork): number | null {
    return this.publicationFor(network)?.publishedAt ?? null;
  }

  publishedPermalinkFor(network: SocialNetwork): string | null {
    return this.publicationFor(network)?.permalink
      || this.results.find(result => result.network === network && result.success)?.permalink
      || null;
  }

  private imageNamesFor(network: SocialNetwork): string[] {
    return network === SocialNetwork.FACEBOOK
      ? this.images.map(item => item.image)
      : this.selectedImageNames();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  protected readonly adminSettingsSystemSettingsPath = AdminSettingsPath.SYSTEM_SETTINGS;
  protected readonly socialSettingsQueryParams = {
    [StoredValue.TAB]: kebabCase(SystemSettingsTab.EXTERNAL_SYSTEMS),
    [StoredValue.SUB_TAB]: ExternalSystemsSubTab.SOCIAL
  };

  get facebookEnabled(): boolean {
    return facebookPublishingEnabled(this.config);
  }

  get instagramEnabled(): boolean {
    return instagramPublishingEnabled(this.config);
  }

  onSeparateCaptionsChange(enabled: boolean): void {
    if (enabled) {
      this.generateNetworkCaptions();
    }
  }

  hasCaptionTargets(): boolean {
    return this.captionTargets().length > 0;
  }

  private captionTargets(): SocialNetwork[] {
    return [
      this.facebookEnabled && !this.networkBlocked(SocialNetwork.FACEBOOK) ? SocialNetwork.FACEBOOK : null,
      this.instagramEnabled && !this.networkBlocked(SocialNetwork.INSTAGRAM) ? SocialNetwork.INSTAGRAM : null
    ].filter(Boolean);
  }

  async generateNetworkCaptions(): Promise<void> {
    const source = this.captionSource();
    const fallbackCaption = (this.caption || "").trim() || source;
    const targets = this.captionTargets();
    if (source && !this.generatingCaptions && targets.length > 0) {
      this.generatingCaptions = true;
      this.notify.progress({
        title: "Writing captions",
        message: targets.length === 1
          ? `Creating ${targets[0]} caption`
          : "Creating platform captions"
      });
      try {
        const groupName = this.config?.group?.longName || "our Ramblers group";
        const tasks: Promise<void>[] = [];
        if (targets.includes(SocialNetwork.FACEBOOK)) {
          tasks.push(this.aiService.rewrite(source, this.facebookCaptionPrompt(groupName))
            .then(output => {
              this.captionFacebook = this.cleanGeneratedCaption(output, fallbackCaption);
            })
            .catch(error => {
              this.logger.error("Facebook caption generation failed", error);
              this.captionFacebook = fallbackCaption;
            }));
        }
        if (targets.includes(SocialNetwork.INSTAGRAM)) {
          tasks.push(this.aiService.rewrite(source, this.instagramCaptionPrompt(groupName))
            .then(output => {
              this.captionInstagram = this.cleanGeneratedCaption(output, fallbackCaption);
            })
            .catch(error => {
              this.logger.error("Instagram caption generation failed", error);
              this.captionInstagram = fallbackCaption;
            }));
        }
        await Promise.all(tasks);
        this.notify.success({title: "Captions ready", message: "Platform captions have been drafted - edit them if you like"});
      } catch (error) {
        this.logger.error("caption generation failed", error);
        this.notify.error({title: "Caption generation failed", message: error?.message || String(error)});
      } finally {
        this.generatingCaptions = false;
      }
    } else if (!source) {
      this.notify.warning({title: "Caption needed", message: "Add a main caption first, then generate platform versions"});
    } else if (targets.length === 0) {
      this.notify.warning({title: "Nothing to generate", message: "All configured networks have already been published"});
    }
  }

  private captionSource(): string {
    const body = (this.caption || "").trim();
    const whenPhrase = this.whenPhrase();
    const title = (this.walkTitle || "").trim();
    const contextLines = [
      whenPhrase ? `Walk timing phrase to use naturally in the caption: ${whenPhrase}` : null,
      title ? `Walk title: ${title}` : null,
      body ? `Description:\n${body}` : null
    ].filter(Boolean);
    return contextLines.join("\n\n").trim();
  }

  private whenPhrase(): string {
    return this.eventDate ? this.dateUtils.relativePastDayPhrase(this.eventDate) : null;
  }

  private cleanGeneratedCaption(output: string, fallback: string): string {
    const cleaned = (output || "")
      .trim()
      .replace(/^["“']+|["”']+$/g, "")
      .trim();
    return cleaned || fallback;
  }

  private whenInstruction(): string {
    const whenPhrase = this.whenPhrase();
    return whenPhrase
      ? `Naturally include when the walk took place using exactly this timing phrase: "${whenPhrase}". Examples: "Last Sunday we walked...", "Yesterday our group...", "Today we enjoyed...". Do not invent a different day or date.`
      : "If a walk date is not provided, do not invent one.";
  }

  private facebookCaptionPrompt(groupName: string): string {
    return [
      `Rewrite the source text as a Facebook post caption for ${groupName}, a Ramblers walking group.`,
      "Write warm, natural UK English in the first person plural (we, our, us) as if a member is posting photos from a completed group walk.",
      "Aim for 2 to 4 short paragraphs or a few readable sentences that work well on Facebook.",
      this.whenInstruction(),
      "Keep it factual from the source: places, route feel, weather, and any pub, lunch or coffee stop that is mentioned.",
      "Do not invent places, scenery, people, or events that are not in the source.",
      "Do not include hashtags unless they already appear in the source.",
      "Do not include URLs, markdown, HTML, bullet points, or a title line.",
      "Do not wrap the result in quotation marks.",
      "Return only the finished Facebook caption."
    ].join(" ");
  }

  private instagramCaptionPrompt(groupName: string): string {
    return [
      `Rewrite the source text as an Instagram post caption for ${groupName}, a Ramblers walking group.`,
      "Write warm, natural UK English in the first person plural (we, our, us) as if a member is posting a photo carousel from a completed group walk.",
      "Keep it shorter and punchier than a Facebook post: about 2 to 5 short sentences or short line breaks that read well on a phone.",
      this.whenInstruction(),
      "Keep it factual from the source: places, route feel, weather, and any pub, lunch or coffee stop that is mentioned.",
      "Do not invent places, scenery, people, or events that are not in the source.",
      "You may end with 3 to 6 relevant hashtags on a final line, such as walking, countryside, or local place names from the source. Prefer #Ramblers and place or activity tags grounded in the source.",
      "Do not include URLs, markdown, HTML, or a title line.",
      "Do not wrap the result in quotation marks.",
      "Return only the finished Instagram caption."
    ].join(" ");
  }

  allNetworksPublished(): boolean {
    const networks = [
      this.facebookEnabled ? SocialNetwork.FACEBOOK : null,
      this.instagramEnabled ? SocialNetwork.INSTAGRAM : null
    ].filter(Boolean);
    return networks.length > 0 && networks.every(network => this.networkBlocked(network));
  }

  toggleNetwork(network: SocialNetwork): void {
    if (!this.networkBlocked(network)) {
      if (network === SocialNetwork.FACEBOOK) {
        this.postToFacebook = !this.postToFacebook;
      } else if (network === SocialNetwork.INSTAGRAM) {
        this.postToInstagram = !this.postToInstagram;
      }
    }
  }

  isSelected(item: ContentMetadataItem): boolean {
    return this.selected.has(item.image);
  }

  toggle(item: ContentMetadataItem): void {
    if (this.selected.has(item.image)) {
      this.selected.delete(item.image);
    } else {
      this.selected.add(item.image);
    }
  }

  selectAll(): void {
    this.selected = new Set(this.images.map(item => item.image));
  }

  selectNone(): void {
    this.selected = new Set();
  }

  autoChooseForInstagram(): void {
    const limit = Math.min(INSTAGRAM_MAX_CAROUSEL_IMAGES, this.images.length);
    if (limit < INSTAGRAM_MIN_CAROUSEL_IMAGES) {
      this.notify.warning({
        title: "Not enough photos",
        message: `Instagram needs at least ${INSTAGRAM_MIN_CAROUSEL_IMAGES} images in the album`
      });
    } else {
      const chosen = this.images.slice(0, limit);
      this.selected = new Set(chosen.map(item => item.image));
      const outsideCount = chosen.filter(item => this.ratioOutsideInstagramRange(item.image)).length;
      if (outsideCount > 0) {
        this.notify.success({
          title: "Instagram selection ready",
          message: `Chose the first ${this.stringUtils.pluraliseWithCount(chosen.length, "photo")}. ${this.stringUtils.pluraliseWithCount(outsideCount, "photo")} will be intelligently cropped to Instagram's nearest supported shape.`
        });
      } else {
        this.notify.success({
          title: "Instagram selection ready",
          message: `Chose ${this.stringUtils.pluraliseWithCount(chosen.length, "photo")} within Instagram's aspect ratio range`
        });
      }
    }
  }

  selectedCount(): number {
    return this.selected.size;
  }

  alreadyPublished(network: SocialNetwork): boolean {
    return this.publishedNetworks.has(network);
  }

  private selectedImageNames(): string[] {
    return this.images.filter(item => this.selected.has(item.image)).map(item => item.image);
  }

  private captionFor(network: SocialNetwork): string {
    const override = network === SocialNetwork.FACEBOOK ? this.captionFacebook : this.captionInstagram;
    return this.separateCaptions && override?.trim() ? override : this.caption;
  }

  instagramCountValid(): boolean {
    const count = this.selectedCount();
    return count >= INSTAGRAM_MIN_CAROUSEL_IMAGES && count <= INSTAGRAM_MAX_CAROUSEL_IMAGES;
  }

  onImageLoad(item: ContentMetadataItem, event: Event): void {
    const image = event.target as HTMLImageElement;
    if (image.naturalWidth && image.naturalHeight) {
      this.aspectRatios.set(item.image, image.naturalWidth / image.naturalHeight);
    }
  }

  imagesOutsideInstagramRatio(): number {
    return this.selectedImageNames().filter(name => this.ratioOutsideInstagramRange(name)).length;
  }

  showInstagramRatioWarning(item: ContentMetadataItem): boolean {
    return this.postToInstagram
      && !this.networkBlocked(SocialNetwork.INSTAGRAM)
      && this.isSelected(item)
      && this.ratioOutsideInstagramRange(item.image);
  }

  private ratioOutsideInstagramRange(imageName: string): boolean {
    const ratio = this.aspectRatios.get(imageName);
    return ratio !== undefined && (ratio < INSTAGRAM_MIN_ASPECT_RATIO || ratio > INSTAGRAM_MAX_ASPECT_RATIO);
  }

  networkBlocked(network: SocialNetwork): boolean {
    return this.publishedPreviously(network) || this.alreadyPublished(network);
  }

  publishableNetworks(): SocialNetwork[] {
    return [
      this.postToFacebook && !this.networkBlocked(SocialNetwork.FACEBOOK) ? SocialNetwork.FACEBOOK : null,
      this.postToInstagram && !this.networkBlocked(SocialNetwork.INSTAGRAM) ? SocialNetwork.INSTAGRAM : null
    ].filter(Boolean);
  }

  publishDisabled(): boolean {
    const networks = this.publishableNetworks();
    const instagramInvalid = networks.includes(SocialNetwork.INSTAGRAM) && !this.instagramCountValid();
    const facebookInvalid = networks.includes(SocialNetwork.FACEBOOK) && this.images.length === 0;
    return this.publishing || !this.caption?.trim() || networks.length === 0 || instagramInvalid || facebookInvalid;
  }

  async publish(): Promise<void> {
    const networks = this.publishableNetworks();
    this.publishing = true;
    this.results = [];
    this.publishProgress = {message: "Connecting…", percent: 0, phase: "connect"};
    this.notify.progress({title: "Publishing", message: "Sending album to social media"});
    try {
      const captions: Partial<Record<SocialNetwork, string>> = {};
      const imageNamesByNetwork: Partial<Record<SocialNetwork, string[]>> = {};
      networks.forEach(network => {
        captions[network] = this.captionFor(network);
        imageNamesByNetwork[network] = this.imageNamesFor(network);
      });
      const imageNames = Array.from(new Set(networks.flatMap(network => imageNamesByNetwork[network] || [])));
      const results = await this.socialPublishService.publishAlbum({
        albumName: this.contentMetadata.name,
        networks,
        captions,
        imageNames,
        imageNamesByNetwork
      }, progress => {
        this.publishProgress = progress;
        if (progress?.message) {
          this.notify.progress({title: "Publishing", message: progress.message});
        }
      });
      this.results = results || [];
      this.results.filter(result => result.success).forEach(result => this.publishedNetworks.add(result.network));
      const successCount = this.results.filter(result => result.success).length;
      const failureCount = this.results.length - successCount;
      if (successCount > 0 && failureCount === 0) {
        this.notify.success({
          title: "Published",
          message: successCount === 1
            ? `Published to ${this.results.find(result => result.success)?.network}`
            : `Published to ${this.stringUtils.pluraliseWithCount(successCount, "network")}`
        });
      } else if (successCount > 0) {
        this.notify.warning({
          title: "Partly published",
          message: `Published to ${this.stringUtils.pluraliseWithCount(successCount, "network")}; ${this.stringUtils.pluraliseWithCount(failureCount, "network")} failed`
        });
      } else if (this.results.length > 0) {
        this.notify.error({
          title: "Publish failed",
          message: this.results.map(result => result.error).filter(Boolean).join("; ") || "All selected networks failed"
        });
      }
    } catch (error) {
      this.logger.error("publish failed", error);
      this.notify.error({
        title: "Publish failed",
        message: error?.message || String(error)
      });
    } finally {
      this.publishing = false;
      this.publishProgress = null;
    }
  }
}
