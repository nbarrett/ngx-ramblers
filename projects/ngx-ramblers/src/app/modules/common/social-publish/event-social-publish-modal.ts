import { Component, inject, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { faFacebook, faInstagram } from "@fortawesome/free-brands-svg-icons";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SocialPublishService } from "../../../services/social/social-publish.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import {
  EventPublishOutcome,
  EventPublishResult,
  FacebookPostStyle,
  PublishableEvent,
  SocialNetwork
} from "../../../models/social-publish.model";

@Component({
  selector: "app-event-social-publish-modal",
  template: `
    <div class="modal-header">
      <h4 class="modal-title">Share this {{ eventTypeLabel }} on social media</h4>
      <button type="button" class="btn-close" aria-label="Close" (click)="close()"></button>
    </div>
    <div class="modal-body">
      @if (loading) {
        <div>Loading the preview…</div>
      } @else if (!event) {
        <div class="alert alert-warning d-flex align-items-start">
          <fa-icon class="me-2 mt-1" [icon]="faCircleExclamation"/>
          <div>
            <strong>Could not load this {{ eventTypeLabel }}</strong>
            <div>{{ loadError }}</div>
          </div>
        </div>
      } @else {
        <div class="alert alert-warning d-flex align-items-start">
          <fa-icon class="me-2 mt-1" [icon]="faCircleExclamation"/>
          <div>
            <strong>This is a Page post, not a Facebook Event</strong>
            <div>Meta's API does not allow any app to create a Facebook Event. This posts to the Page and links back
              here.
            </div>
          </div>
        </div>
        @if (alreadyPublished && !event.captionChanged) {
          <div class="alert alert-warning d-flex align-items-start">
            <fa-icon class="me-2 mt-1" [icon]="faCircleCheck"/>
            <div>
              <strong>Already posted</strong>
              <div>Posting again will create a second post.
                <a [href]="event.publication.permalink" target="_blank" rel="noopener noreferrer">View the existing
                  post</a>
              </div>
            </div>
          </div>
        } @else if (alreadyPublished) {
          <div class="alert alert-warning d-flex align-items-start">
            <fa-icon class="me-2 mt-1" [icon]="faCircleExclamation"/>
            <div>
              <strong>Details have changed since this was posted</strong>
              <div>Posting again will create a second post with the updated wording.</div>
            </div>
          </div>
        }
        <div class="d-flex flex-wrap gap-3 mb-3">
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="modal-publish-facebook"
                   [checked]="isSelected(SocialNetwork.FACEBOOK)" [disabled]="!facebookEnabled"
                   (change)="toggle(SocialNetwork.FACEBOOK)">
            <label class="form-check-label" for="modal-publish-facebook">
              <fa-icon [icon]="faFacebook" class="me-1"/>Facebook
            </label>
          </div>
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="modal-publish-instagram"
                   [checked]="isSelected(SocialNetwork.INSTAGRAM)" [disabled]="!instagramAvailable"
                   (change)="toggle(SocialNetwork.INSTAGRAM)">
            <label class="form-check-label" for="modal-publish-instagram">
              <fa-icon [icon]="faInstagram" class="me-1"/>Instagram
              @if (instagramEnabled && event.imageCount === 0) {
                <span class="text-muted">- needs an image</span>
              }
            </label>
          </div>
        </div>
        <div class="post-preview">
          <div class="post-preview-heading">
            <strong>This is exactly what will be posted</strong>
          </div>
          <div class="post-preview-body">
            <pre class="post-preview-caption">{{ event.caption }}</pre>
            @if (event.postStyle === FacebookPostStyle.PHOTO_WITH_LINK) {
              <div class="post-preview-images">
                @for (imageUrl of event.imageUrls; track imageUrl) {
                  <img class="post-preview-image" [src]="imageUrl" [alt]="event.title">
                }
              </div>
              <div class="post-preview-note">Posted as
                {{ event.imageUrls.length === 1 ? "a photo" : event.imageUrls.length + " photos" }} with the link in the
                text above.
              </div>
            } @else {
              <div class="post-preview-note">No image on this {{ eventTypeLabel }}, so Facebook gets a link with a
                preview card built from the page.
              </div>
            }
            @if (isSelected(SocialNetwork.INSTAGRAM)) {
              <div class="post-preview-note">
                <fa-icon [icon]="faInstagram" class="me-1"/>On Instagram the link will not be clickable.
              </div>
            }
          </div>
        </div>
        @if (results.length > 0) {
          <ul class="mt-3">
            @for (result of results; track result.network) {
              <li><strong>{{ result.network }}</strong>: {{ outcomeDescription(result) }}</li>
            }
          </ul>
        }
        @if (notifyTarget.showAlert) {
          <div class="alert mt-3 {{ notifyTarget.alertClass }} d-flex align-items-start">
            <fa-icon class="me-2 mt-1" [icon]="notifyTarget.alert.icon"/>
            <div>
              @if (notifyTarget.alertTitle) {
                <strong>{{ notifyTarget.alertTitle }}</strong>
              }
              <div>{{ notifyTarget.alertMessage }}</div>
            </div>
          </div>
        }
      }
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-quiet" (click)="close()">Close</button>
      <button type="button" class="btn btn-primary"
              [disabled]="!event || selectedNetworks.length === 0 || publishing"
              (click)="publish()">
        {{ publishing ? "Posting…" : "Post now" }}
      </button>
    </div>`,
  imports: [FormsModule, FontAwesomeModule],
  styles: `
    .post-preview
      border: 1px solid #dee2e6
      border-radius: var(--ngx-radius-sm, 4px)
      background: #fff

    .post-preview-heading
      padding: 8px 12px
      border-bottom: 1px solid #dee2e6

    .post-preview-body
      padding: 12px

    .post-preview-caption
      white-space: pre-wrap
      word-break: break-word
      font-family: inherit
      font-size: 0.95rem
      margin: 0 0 10px 0

    .post-preview-images
      display: flex
      flex-wrap: wrap
      gap: 6px

    .post-preview-image
      width: 120px
      height: 90px
      object-fit: cover
      border-radius: var(--ngx-radius-sm, 4px)

    .post-preview-note
      margin-top: 8px
      font-size: 0.85rem
      color: #65676b
  `
})
export class EventSocialPublishModalComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("EventSocialPublishModalComponent", NgxLoggerLevel.ERROR);
  private socialPublishService = inject(SocialPublishService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  public bsModalRef = inject(BsModalRef);

  @Input() eventId: string;
  @Input() eventTypeLabel = "walk";

  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  protected event: PublishableEvent;
  protected results: EventPublishResult[] = [];
  protected selectedNetworks: SocialNetwork[] = [];
  protected loading = true;
  protected publishing = false;
  protected loadError = "";

  protected readonly faFacebook = faFacebook;
  protected readonly faInstagram = faInstagram;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly SocialNetwork = SocialNetwork;
  protected readonly FacebookPostStyle = FacebookPostStyle;

  async ngOnInit(): Promise<void> {
    try {
      this.event = await this.socialPublishService.publishableEvent(this.eventId);
      this.selectedNetworks = this.facebookEnabled ? [SocialNetwork.FACEBOOK] : [];
      this.logger.info("loaded publishable event", this.event);
    } catch (error) {
      this.loadError = error?.error?.error || error?.message || error;
    } finally {
      this.loading = false;
    }
  }

  get facebookEnabled(): boolean {
    return !!this.systemConfigService.systemConfig()?.externalSystems?.facebook?.eventPublishingEnabled;
  }

  get instagramEnabled(): boolean {
    return !!this.systemConfigService.systemConfig()?.externalSystems?.instagram?.eventPublishingEnabled;
  }

  get instagramAvailable(): boolean {
    return this.instagramEnabled && this.event?.imageCount > 0;
  }

  get alreadyPublished(): boolean {
    return !!this.event?.publication?.permalink;
  }

  protected isSelected(network: SocialNetwork): boolean {
    return this.selectedNetworks.includes(network);
  }

  protected toggle(network: SocialNetwork): void {
    this.selectedNetworks = this.isSelected(network)
      ? this.selectedNetworks.filter(candidate => candidate !== network)
      : this.selectedNetworks.concat(network);
  }

  protected outcomeDescription(result: EventPublishResult): string {
    if (result.outcome === EventPublishOutcome.FAILED) {
      return `could not be posted - ${result.error}`;
    } else if (result.outcome === EventPublishOutcome.UNCHANGED) {
      return "already posted and unchanged, so left alone";
    } else if (result.outcome === EventPublishOutcome.ALREADY_PUBLISHED) {
      return "already posted - switch on reposting to post the change";
    } else {
      return `posted - ${result.permalink}`;
    }
  }

  async publish(): Promise<void> {
    this.publishing = true;
    this.results = [];
    this.notify.progress({title: "Posting", message: "Sending to social media"});
    try {
      this.results = await this.socialPublishService.publishEvents([this.eventId], this.selectedNetworks, true);
      const failures = this.results.filter(result => result.outcome === EventPublishOutcome.FAILED);
      if (failures.length > 0) {
        this.notify.warning({title: "Some posts failed", message: `${failures.length} of ${this.results.length} did not go out`});
      } else {
        this.notify.success({title: "Posted", message: "Sent to social media"});
      }
      this.event = await this.socialPublishService.publishableEvent(this.eventId);
    } catch (error) {
      this.notify.error({title: "Posting failed", message: error?.error?.error || error?.message || error});
    } finally {
      this.publishing = false;
    }
  }

  close(): void {
    this.bsModalRef.hide();
  }
}
