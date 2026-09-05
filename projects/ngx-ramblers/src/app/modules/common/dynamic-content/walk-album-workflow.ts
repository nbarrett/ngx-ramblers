import { Location } from "@angular/common";
import { Component, inject, Input, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp, faCircleCheck, faImages, faPersonWalking } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlbumContributor, AlbumEditRole, ContentMetadata, contributorOwnsItem, draftFiles, publishedFiles, WalkAlbumWorkflowStage } from "../../../models/content-metadata.model";
import { FormsModule } from "@angular/forms";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { ContentText, PageContent, PageContentRow } from "../../../models/content-text.model";
import { SystemConfig } from "../../../models/system.model";
import { socialPublishingEnabled } from "../../../functions/social-publishing";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { CreateWalkAlbumService } from "../../../services/walks/create-walk-album.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { ContentTextEditor } from "../tiptap-editor/content-text-editor";
import { ImageListEditComponent } from "../../../carousel/edit/image-list-edit/image-list-edit";
import { SocialShareAlbumComponent } from "../../../carousel/edit/social-share-album/social-share-album";

@Component({
  selector: "app-walk-album-workflow",
  template: `
    <div class="walk-album-workflow">
      @if (stage === WalkAlbumWorkflowStage.PHOTOS) {
        <div class="alert alert-warning walk-album-workflow-intro mb-3">
          <fa-icon [icon]="faImages" class="flex-shrink-0 mt-1"/>
          <div class="ms-2 min-w-0">
            <strong class="d-block">Walk photo album</strong>
            @if (curator()) {
              <span class="d-none d-md-inline">Check the walk report, then add photos. Save when you finish and you can share the album straight away.</span>
              <span class="d-md-none">Review the report, add photos, then save.</span>
            } @else {
              <span>Add your photos, then save. They will appear on the site once the walk leader or an administrator has approved them.</span>
            }
          </div>
        </div>
        @if (curator()) {
          <section class="walk-album-workflow-report mb-3">
            <button type="button"
                    class="walk-album-workflow-report-toggle"
                    [attr.aria-expanded]="workflowReportExpanded"
                    (click)="toggleWorkflowReport()">
              <span class="min-w-0">
                <span class="d-block fw-semibold">Walk report</span>
                <span class="small text-muted">{{ workflowReportToggleHint() }}</span>
              </span>
              <fa-icon [icon]="workflowReportExpanded ? faChevronUp : faChevronDown"/>
            </button>
            @if (workflowReportExpanded) {
              <div class="walk-album-workflow-report-body">
                <app-content-text-editor [data]="{text: row.carousel.preAlbumText, name: 'walk report'}"
                                         (changed)="onWorkflowPreAlbumTextChanged($event)"/>
              </div>
            }
          </section>
        }
        @if (needsContributorDetails()) {
          <section class="walk-album-workflow-report mb-3">
            <div class="walk-album-workflow-report-body">
              <p class="fw-semibold mb-2">Before you add photos, tell us who you are</p>
              <div class="row g-2">
                <div class="col-md-6">
                  <label for="contributor-name">Your name</label>
                  <input id="contributor-name" type="text" class="form-control input-sm" [(ngModel)]="contributorName" autocomplete="name">
                </div>
                <div class="col-md-6">
                  <label for="contributor-email">Your email address</label>
                  <input id="contributor-email" type="email" class="form-control input-sm" [(ngModel)]="contributorEmail" autocomplete="email">
                </div>
              </div>
              <small class="text-muted d-block mt-2">Your name and email address are recorded against the photos so the walk leader knows who sent them.</small>
              <button type="button" class="btn btn-primary btn-sm mt-3" [disabled]="!contributorDetailsValid()" (click)="confirmContributorDetails()">
                <fa-icon [icon]="faImages" class="me-2"/>Continue to add photos
              </button>
            </div>
          </section>
        } @else {
          <section class="walk-album-workflow-photos">
            <h5 class="walk-album-workflow-photos-title">Photos</h5>
            <app-image-list-edit [name]="row?.carousel?.name"
                                 [workflowMode]="true"
                                 [role]="role"
                                 [contributorIdentity]="contributor"
                                 (exit)="onWorkflowImageExit($event)"/>
          </section>
        }
      } @else {
        <div class="alert alert-success walk-album-workflow-intro mb-3">
          <fa-icon [icon]="faCircleCheck" class="flex-shrink-0 mt-1"/>
          <div class="ms-2 min-w-0">
            <strong class="d-block">Photos saved</strong>
            <span>Share the album on social media now, or go back to the walk.</span>
          </div>
        </div>
        <app-social-share-album [contentMetadata]="savedAlbum"
                                [caption]="shareCaption()"
                                [eventDate]="row?.carousel?.eventDate"
                                [walkTitle]="row?.carousel?.subtitle"
                                (done)="finish()"/>
        <button type="button" class="btn btn-quiet mt-3" (click)="finish()">
          <fa-icon [icon]="faPersonWalking" class="me-2"/>Back to the walk
        </button>
      }
    </div>`,
  styles: [`
    .walk-album-workflow
      padding-bottom: 0

    .walk-album-workflow-intro
      display: flex
      align-items: flex-start
      margin-bottom: 0.75rem
      padding: 0.75rem 0.85rem

    .walk-album-workflow-report
      border: 1px solid #dee2e6
      border-radius: 12px
      background: #fff
      overflow: hidden

    .walk-album-workflow-report-toggle
      width: 100%
      min-height: 52px
      display: flex
      align-items: center
      justify-content: space-between
      gap: 0.75rem
      border: 0
      background: #f8f9fa
      color: var(--ramblers-colour-granite, #404143)
      text-align: left
      padding: 0.75rem 0.9rem
      touch-action: manipulation
      -webkit-tap-highlight-color: transparent

    .walk-album-workflow-report-toggle .fw-semibold
      color: var(--ramblers-colour-granite, #404143)

    .walk-album-workflow-report-toggle fa-icon
      color: var(--ramblers-colour-granite, #404143)

    .walk-album-workflow-report-body
      padding: 0.75rem 0.85rem 0.9rem
      border-top: 1px solid #dee2e6

    .walk-album-workflow-photos-title
      font-size: 1.05rem
      font-weight: 700
      margin: 0 0 0.65rem
  `],
  imports: [FontAwesomeModule, FormsModule, ContentTextEditor, ImageListEditComponent, SocialShareAlbumComponent]
})
export class WalkAlbumWorkflow implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkAlbumWorkflow", NgxLoggerLevel.ERROR);
  private location: Location = inject(Location);
  private pageContentService = inject(PageContentService);
  private contentMetadataService = inject(ContentMetadataService);
  private createWalkAlbumService = inject(CreateWalkAlbumService);
  private siteEditService = inject(SiteEditService);
  private systemConfigService = inject(SystemConfigService);
  private memberLoginService = inject(MemberLoginService);
  private config: SystemConfig;
  @Input() row: PageContentRow;
  @Input() pageContent: PageContent;
  @Input() role: AlbumEditRole = AlbumEditRole.CURATOR;
  public workflowReportExpanded = true;
  public stage: WalkAlbumWorkflowStage = WalkAlbumWorkflowStage.PHOTOS;
  public savedAlbum: ContentMetadata | null = null;
  public contributor: AlbumContributor | null = null;
  public contributorName = "";
  public contributorEmail = "";
  protected readonly WalkAlbumWorkflowStage = WalkAlbumWorkflowStage;
  protected readonly faImages = faImages;
  protected readonly faChevronUp = faChevronUp;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faPersonWalking = faPersonWalking;

  constructor() {
    this.systemConfigService.events().subscribe(config => this.config = config);
  }

  ngOnInit(): void {
    if (this.row?.carousel && this.curator()) {
      this.row.carousel.showPreAlbumText = true;
    }
    const member = this.memberLoginService.memberLoggedIn() ? this.memberLoginService.loggedInMember() : null;
    if (member) {
      this.contributor = {memberId: member.memberId, name: [member.firstName, member.lastName].filter(Boolean).join(" ")};
    }
  }

  needsContributorDetails(): boolean {
    return !this.curator() && !this.contributor;
  }

  contributorDetailsValid(): boolean {
    return this.contributorName.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.contributorEmail.trim());
  }

  confirmContributorDetails(): void {
    if (this.contributorDetailsValid()) {
      this.contributor = {name: this.contributorName.trim(), email: this.contributorEmail.trim()};
    }
  }

  curator(): boolean {
    return this.role === AlbumEditRole.CURATOR;
  }

  toggleWorkflowReport(): void {
    this.workflowReportExpanded = !this.workflowReportExpanded;
  }

  workflowReportToggleHint(): string {
    const text = this.row?.carousel?.preAlbumText || "";
    if (this.workflowReportExpanded) {
      return "Tap to hide while you add photos";
    } else if (!text.trim()) {
      return "No report yet - tap to write one";
    } else {
      return "Tap to review or edit the walk report";
    }
  }

  shareCaption(): string {
    return this.row?.carousel?.preAlbumText || this.row?.carousel?.introductoryText || "";
  }

  onWorkflowPreAlbumTextChanged(event: ContentText): void {
    if (this.row?.carousel) {
      this.row.carousel.preAlbumText = event?.text || "";
      this.row.carousel.showPreAlbumText = true;
      this.saveWorkflowPageContent();
    }
  }

  async onWorkflowImageExit(saved?: ContentMetadata | null): Promise<void> {
    const albumName = this.row?.carousel?.name;
    if (saved) {
      if (this.curator()) {
        await this.saveWorkflowPageContent();
      }
      this.createWalkAlbumService.clearPendingAlbum(saved.name || albumName);
      this.notifyCuratorsOfNewDrafts(saved);
      if (this.shareAvailable(saved)) {
        this.savedAlbum = this.contentMetadataService.withoutDrafts(saved);
        this.stage = WalkAlbumWorkflowStage.SHARE;
      } else {
        await this.finish();
      }
    } else {
      await this.finish();
    }
  }

  async finish(): Promise<void> {
    const albumName = this.row?.carousel?.name;
    const returnedToWalk = await this.createWalkAlbumService.navigateBackToWalkIfNeeded(albumName);
    if (!returnedToWalk) {
      if (this.siteEditService.active()) {
        this.siteEditService.toggle(false);
      }
      this.location.back();
    }
  }

  private notifyCuratorsOfNewDrafts(saved: ContentMetadata): void {
    const eventId = this.row?.carousel?.eventId;
    const myDrafts = draftFiles(saved?.files).filter(file => contributorOwnsItem(this.contributor, file) && !!file.image);
    if (!this.curator() && eventId && myDrafts.length > 0) {
      this.createWalkAlbumService.notifyPhotosAdded({
        walkId: eventId,
        albumPath: this.pageContent?.path || saved?.name,
        photoCount: myDrafts.length,
        contributorName: this.contributor?.name,
        contributorEmail: this.contributor?.email
      })
        .then(response => this.logger.info("photo notification sent:", response.sent, "to", response.recipients.length, "recipients"))
        .catch(error => this.logger.warn("photo notification failed", error));
    }
  }

  private shareAvailable(saved: ContentMetadata): boolean {
    return this.curator()
      && this.row?.carousel?.allowSocialShare !== false
      && socialPublishingEnabled(this.config)
      && publishedFiles(saved?.files).some(file => !!file?.image);
  }

  private async saveWorkflowPageContent(): Promise<void> {
    if (this.pageContent?.path) {
      try {
        await this.pageContentService.createOrUpdate(this.pageContent);
        this.logger.info("saved walk report page content for", this.pageContent.path);
      } catch (error) {
        this.logger.warn("failed to save walk report page content", error);
      }
    }
  }
}
