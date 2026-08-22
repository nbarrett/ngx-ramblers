import { Component, ElementRef, inject, OnDestroy, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleExclamation, faSpinner, faUpload } from "@fortawesome/free-solid-svg-icons";
import { faFacebook, faInstagram } from "@fortawesome/free-brands-svg-icons";
import { HttpErrorResponse } from "@angular/common/http";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FileUploadService } from "../../../services/file-upload.service";
import { AwsFileUploadResponseData } from "../../../models/aws-object.model";
import { RootFolder } from "../../../models/system.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { AlertTarget } from "../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SocialPublishService } from "../../../services/social/social-publish.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { DraggableModalComponent } from "../draggable-modal/draggable-modal";
import { EmojiTextareaComponent } from "../emoji-textarea/emoji-textarea";
import {
  EventPublishOutcome,
  EventPublishResult,
  FacebookPostStyle,
  PublishableEvent,
  SocialNetwork
} from "../../../models/social-publish.model";

@Component({
  selector: "app-event-social-publish-modal",
  imports: [FormsModule, FontAwesomeModule, FileUploadModule, DraggableModalComponent, EmojiTextareaComponent],
  template: `
    <app-draggable-modal [open]="open" contentWidth="min(760px, 95vw)" [showCloseButton]="false" (closed)="close()">
      <h4 modalTitle class="modal-title">Share this {{ eventTypeLabel }} on social media</h4>
      <div modalBody>
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
            <div class="flex-grow-1">
              <strong>This is a Page post, not a Facebook Event</strong>
              <div>Meta's API does not allow any app to create a Facebook Event. This posts to the Page and links back
                here.
              </div>
              @if (instagramEnabled && event.imageCount === 0) {
                <strong class="d-block mt-2">Add a photo to post to Instagram</strong>
                <div>This {{ eventTypeLabel }} has no image, so Instagram can't be posted to. Add one to unlock
                  Instagram — Facebook will still post with a link preview.
                </div>
                <button type="button" class="btn btn-primary btn-sm mt-2"
                        [disabled]="uploadingImage" (click)="chooseImage()">
                  <fa-icon [icon]="uploadingImage ? faSpinner : faUpload" class="me-1"/>{{ uploadingImage ? "Uploading" : "Add an image" }}
                </button>
              }
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
          <div class="d-flex flex-wrap gap-3 mb-3 align-items-center">
            <div class="form-check">
              <input type="checkbox" class="form-check-input" id="modal-publish-facebook"
                     [checked]="isSelected(SocialNetwork.FACEBOOK)" [disabled]="!facebookEnabled"
                     (change)="toggle(SocialNetwork.FACEBOOK)">
              <label class="form-check-label" for="modal-publish-facebook">
                <fa-icon [icon]="faFacebook" class="me-1 icon-facebook"/>Facebook
              </label>
            </div>
            <div class="form-check">
              <input type="checkbox" class="form-check-input" id="modal-publish-instagram"
                     [checked]="isSelected(SocialNetwork.INSTAGRAM)" [disabled]="!instagramAvailable"
                     (change)="toggle(SocialNetwork.INSTAGRAM)">
              <label class="form-check-label" for="modal-publish-instagram">
                <fa-icon [icon]="faInstagram" class="me-1 icon-instagram"/>Instagram
                @if (instagramEnabled && !instagramAvailable) {
                  <span class="text-muted">(needs an image)</span>
                }
              </label>
            </div>
          </div>
          <input #imageFileInput class="d-none" type="file" accept="image/*"
                 ng2FileSelect (onFileSelected)="onImageSelected($event)" [uploader]="uploader"/>
          <div class="post-preview">
            <div class="post-preview-heading">
              <strong>This is what will be posted</strong> — edit it if you like
            </div>
            <div class="post-preview-body">
              @if (!separateCaptions || !separateCaptionsAvailable) {
                <app-emoji-textarea [(ngModel)]="caption" inputId="event-caption" [rows]="8"
                                    placeholder="Write the post caption. Type :sun for emojis"/>
              }
              @if (separateCaptionsAvailable) {
                <div class="form-check mt-2 mb-1">
                  <input type="checkbox" class="form-check-input" id="event-separate-captions"
                         [(ngModel)]="separateCaptions" (ngModelChange)="onSeparateCaptionsChange()">
                  <label class="form-check-label" for="event-separate-captions">Use a different caption per
                    network</label>
                </div>
              }
              @if (separateCaptions && separateCaptionsAvailable) {
                @if (facebookEnabled) {
                  <label class="mt-2 fw-bold"><fa-icon [icon]="faFacebook" class="me-1 icon-facebook"/>Facebook
                    caption</label>
                  <app-emoji-textarea [(ngModel)]="captionFacebook" inputId="event-caption-facebook" [rows]="8"/>
                }
                @if (instagramAvailable) {
                  <label class="mt-2 fw-bold"><fa-icon [icon]="faInstagram" class="me-1 icon-instagram"/>Instagram
                    caption</label>
                  <app-emoji-textarea [(ngModel)]="captionInstagram" inputId="event-caption-instagram" [rows]="8"/>
                }
              }
              @if (event.postStyle === FacebookPostStyle.PHOTO_WITH_LINK) {
                <div class="post-preview-images">
                  @for (imageUrl of event.imageUrls; track imageUrl) {
                    <img class="post-preview-image" [src]="imageUrl" [alt]="event.title">
                  }
                </div>
                <div class="post-preview-note">Posted as
                  {{ event.imageUrls.length === 1 ? "a photo" : event.imageUrls.length + " photos" }} with the link in
                  the text above.
                </div>
              } @else {
                <div class="post-preview-note">No image on this {{ eventTypeLabel }}, so Facebook gets a link with a
                  preview card built from the page.
                </div>
              }
              @if (isSelected(SocialNetwork.INSTAGRAM)) {
                <div class="post-preview-note">
                  <fa-icon [icon]="faInstagram" class="me-1 icon-instagram"/>On Instagram the link will not be clickable.
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
      <button modalFooter type="button" class="btn btn-quiet" (click)="close()">Close</button>
      <button modalFooter type="button" class="btn btn-primary"
              [disabled]="!event || selectedNetworks.length === 0 || publishing"
              (click)="publish()">
        {{ publishing ? "Posting…" : "Post now" }}
      </button>
    </app-draggable-modal>`,
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
export class EventSocialPublishModalComponent implements OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("EventSocialPublishModalComponent", NgxLoggerLevel.ERROR);
  private socialPublishService = inject(SocialPublishService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private fileUploadService = inject(FileUploadService);

  @ViewChild("imageFileInput") private imageFileInput: ElementRef<HTMLInputElement>;

  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  protected open = false;
  protected eventId: string;
  protected eventTypeLabel = "walk";
  protected event: PublishableEvent;
  protected results: EventPublishResult[] = [];
  protected selectedNetworks: SocialNetwork[] = [];
  protected caption = "";
  protected separateCaptions = false;
  protected captionFacebook = "";
  protected captionInstagram = "";
  protected loading = true;
  protected publishing = false;
  protected loadError = "";
  protected uploadingImage = false;
  protected uploader: FileUploader;
  private uploadSubscription: Subscription;

  protected readonly faFacebook = faFacebook;
  protected readonly faInstagram = faInstagram;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faUpload = faUpload;
  protected readonly faSpinner = faSpinner;
  protected readonly SocialNetwork = SocialNetwork;
  protected readonly FacebookPostStyle = FacebookPostStyle;

  ngOnDestroy(): void {
    this.uploadSubscription?.unsubscribe();
  }

  async openFor(eventId: string, eventTypeLabel: string): Promise<void> {
    this.eventId = eventId;
    this.eventTypeLabel = eventTypeLabel || "walk";
    this.event = null;
    this.results = [];
    this.loadError = "";
    this.loading = true;
    this.open = true;
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.event = await this.socialPublishService.publishableEvent(this.eventId);
      this.caption = this.event?.caption || "";
      this.separateCaptions = false;
      this.captionFacebook = "";
      this.captionInstagram = "";
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

  get separateCaptionsAvailable(): boolean {
    return this.facebookEnabled && this.instagramAvailable;
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

  protected chooseImage(): void {
    const rootFolder = this.event?.itemType === RamblersEventType.GROUP_EVENT
      ? RootFolder.socialEventsImages
      : RootFolder.walkImages;
    this.uploader = this.fileUploadService.createUploaderFor(rootFolder);
    this.uploadSubscription?.unsubscribe();
    this.uploadSubscription = this.uploader.response.subscribe((response: string | HttpErrorResponse) =>
      this.onImageUploaded(response));
    this.imageFileInput.nativeElement.value = null;
    this.imageFileInput.nativeElement.click();
  }

  protected onImageSelected(files: File[]): void {
    this.uploadingImage = true;
    this.notify.progress({title: "Image upload", message: `Uploading ${files?.[0]?.name} - please wait`});
  }

  private async onImageUploaded(response: string | HttpErrorResponse): Promise<void> {
    try {
      const uploaded: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
      const awsFileName = uploaded?.fileNameData?.awsFileName;
      if (awsFileName && this.eventId) {
        await this.socialPublishService.attachEventImage(this.eventId, awsFileName);
        this.event = await this.socialPublishService.publishableEvent(this.eventId);
        if (this.instagramAvailable && !this.isSelected(SocialNetwork.INSTAGRAM)) {
          this.toggle(SocialNetwork.INSTAGRAM);
        }
        this.notify.success({title: "Image added", message: "The image is now on the event, so Instagram is available"});
      } else {
        this.notify.warning({title: "Image not added", message: "The upload did not return a file name"});
      }
    } catch (error) {
      this.notify.error({title: "Could not add the image", message: error?.error?.error || error?.message || error});
    } finally {
      this.uploadingImage = false;
    }
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

  protected onSeparateCaptionsChange(): void {
    if (this.separateCaptions) {
      this.captionFacebook = this.captionFacebook || this.caption;
      this.captionInstagram = this.captionInstagram || this.caption;
    }
  }

  private captionsForSelectedNetworks(): Partial<Record<SocialNetwork, string>> {
    return this.selectedNetworks.reduce((captions, network) => ({
      ...captions,
      [network]: this.separateCaptions
        ? (network === SocialNetwork.FACEBOOK ? this.captionFacebook : this.captionInstagram)
        : this.caption
    }), {} as Partial<Record<SocialNetwork, string>>);
  }

  async publish(): Promise<void> {
    this.publishing = true;
    this.results = [];
    this.notify.progress({title: "Posting", message: "Sending to social media"});
    try {
      this.results = await this.socialPublishService.publishEvents([this.eventId], this.selectedNetworks, true, this.captionsForSelectedNetworks());
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
    this.open = false;
  }
}
