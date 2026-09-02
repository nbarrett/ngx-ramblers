import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faAlignLeft, faArrowLeft, faArrowUpRightFromSquare, faCheck, faEye, faFloppyDisk, faPen, faRotateRight, faTrash } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { MEETING_MINUTES_TEMPLATE_ID, MeetingMinutesView, MeetingTranscriptEntry } from "../../models/video-meeting.model";
import { CommitteeFile, CommitteeMeetingFormat } from "../../models/committee.model";
import { AdminPath } from "../../models/admin-route-paths.model";
import { StoredValue } from "../../models/ui-actions";
import { UIDateFormat } from "../../models/date-format.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { meetingMinutesDocumentSlug, preferredCommitteeDocumentsPagePath } from "../../functions/committee-documents-page";
import { CommitteeDocumentsPageChoice } from "../../models/content-text.model";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { AlertPanelVariant } from "../../models/alert-panel.model";
import { ThumbnailHeadingFrameComponent } from "../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { TiptapMarkdownEditor } from "../../modules/common/tiptap-editor/tiptap-markdown-editor";
import { CommitteeDocumentView } from "../committee/document/committee-document-view";
import { SectionToggle } from "../../shared/components/section-toggle";
import { SectionToggleTab } from "../../models/section-toggle.model";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-video-meeting-minutes",
  imports: [
    FormsModule,
    FontAwesomeModule,
    AlertPanelComponent,
    ThumbnailHeadingFrameComponent,
    RouterLink,
    TiptapMarkdownEditor,
    CommitteeDocumentView,
    SectionToggle,
    TooltipDirective
  ],
  styles: [`
    .transcript-entry
      margin: 0 0 1rem
    .transcript-entry:last-child
      margin-bottom: 0
    .transcript-speaker
      font-weight: 700
    .transcript-time
      margin-left: 0.5rem
      font-size: 0.8rem
      color: #6c757d
    .transcript-text
      margin: 0.15rem 0 0
      white-space: pre-wrap
      line-height: 1.5
  `],
  template: `
    <div class="container mt-3 mb-4">
      <a class="btn btn-quiet mb-3" [routerLink]="'/' + meetingsPath">
        <fa-icon [icon]="faArrowLeft" class="me-2"/>Back to meetings
      </a>
      <h1 class="mb-3">Draft minutes — {{ displayTitle }}</h1>
      @if (loading) {
        <p>Loading…</p>
      } @else if (!file) {
        <app-alert-panel title="No minutes yet">
          No written minutes have been captured for this meeting yet. Capture notes during a meeting with the Record
          button, then leave the call.
        </app-alert-panel>
      } @else {
        @if (onCommitteePage) {
          <app-alert-panel class="mb-3" title="Published" [variant]="alertSuccess" actionsEnd>
            These minutes are on {{ onCommitteePageLabel }}. Changes saved here update that document.
            <button alertActions type="button" class="btn btn-quiet text-nowrap" [disabled]="busy"
                    (click)="openCommitteeDocument()" tooltip="Go to these minutes on their committee page" container="body">
              <fa-icon [icon]="faArrowUpRightFromSquare" class="me-2"/>Go to committee page
            </button>
          </app-alert-panel>
        } @else {
          <app-alert-panel class="mb-3" title="This is a draft" [variant]="alertWarning">
            Edit the minutes here, then save them onto a committee documents page on this site.
          </app-alert-panel>
        }
        @if (destinationPages.length > 1) {
          <div class="form-group mb-3">
            <label for="minutes-destination">Save to</label>
            <select id="minutes-destination" class="form-control" [(ngModel)]="selectedPagePath">
              @for (page of destinationPages; track page.path) {
                <option [ngValue]="page.path">{{ page.label }}</option>
              }
            </select>
          </div>
        } @else if (destinationPages.length === 1) {
          <p class="text-muted mb-3">These will be saved onto <strong>{{ destinationPages[0].label }}</strong>.</p>
        } @else {
          <app-alert-panel class="mb-3" title="No committee documents page" [variant]="alertWarning">
            This site has no committee documents list yet. You can still save a draft here. Add a committee documents
            row to a page, then come back and save the minutes onto it.
          </app-alert-panel>
        }
        <div class="d-flex flex-nowrap align-items-stretch gap-2 mb-3">
          @if (onCommitteePage) {
            <div class="col d-flex" [class.not-allowed]="busy || !publishRequired" [tooltip]="publishTooltip" container="body">
              <button type="button" class="btn btn-quiet w-100 text-nowrap" [disabled]="busy || !publishRequired" (click)="saveToCommittee()">
                <fa-icon [icon]="faCheck" class="me-2"/>Publish
              </button>
            </div>
            <button type="button" class="btn btn-quiet col text-nowrap" [disabled]="busy" (click)="saveDraft()"
                    tooltip="Save changes to the existing committee document" container="body">
              <fa-icon [icon]="faFloppyDisk" class="me-2"/>Save draft
            </button>
          } @else {
            <div class="col d-flex" [class.not-allowed]="busy || !publishRequired" [tooltip]="publishTooltip" container="body">
              <button type="button" class="btn btn-primary w-100 text-nowrap" [disabled]="busy || !publishRequired" (click)="saveToCommittee()">
                <fa-icon [icon]="faCheck" class="me-2"/>Publish
              </button>
            </div>
            <button type="button" class="btn btn-quiet col text-nowrap" [disabled]="busy" (click)="saveDraft()"
                    tooltip="Save changes without adding the minutes to a committee documents page" container="body">
              <fa-icon [icon]="faFloppyDisk" class="me-2"/>Save draft
            </button>
          }
          <button type="button" class="btn btn-quiet col text-nowrap" [disabled]="busy || !transcript.trim()" (click)="rewriteFromTranscript()"
                  tooltip="Replace the draft with newly generated minutes from the transcript" container="body">
            <fa-icon [icon]="faRotateRight" class="me-2"/>Rewrite
          </button>
          <button type="button" class="btn btn-quiet col text-nowrap" [disabled]="busy" (click)="confirmingDelete = true"
                  tooltip="Delete the minutes while retaining the transcript" container="body">
            <fa-icon [icon]="faTrash" class="me-2"/>Delete
          </button>
          <div class="col-4 d-flex flex-shrink-1">
            <app-section-toggle fullWidth [tabs]="viewTabs" [(selectedTab)]="view"
                                [queryParamKey]="minutesViewParam"/>
          </div>
        </div>
        @if (confirmingDelete) {
          <app-alert-panel class="mb-3" title="Delete these minutes?" [variant]="alertWarning" actionsEnd>
            This removes the draft and its committee document entry. The transcript is retained so minutes can be
            generated again.
            <button alertActions type="button" class="btn btn-quiet" [disabled]="busy" (click)="confirmingDelete = false">
              Cancel
            </button>
            <button alertActions type="button" class="btn btn-danger" [disabled]="busy" (click)="deleteMinutes()">
              <fa-icon [icon]="faTrash" class="me-2"/>{{ busy ? "Deleting…" : "Delete minutes" }}
            </button>
          </app-alert-panel>
        }
        @if (statusMessage) {
          <app-alert-panel class="mb-3" [title]="statusTitle" [variant]="statusVariant">
            {{ statusMessage }}
          </app-alert-panel>
        }
        @if (view === meetingMinutesView.TRANSCRIPT) {
          <app-thumbnail-heading-frame heading="Transcript" class="d-block">
            @if (transcriptEntries.length) {
              @for (entry of transcriptEntries; track $index) {
                <div class="transcript-entry">
                  <span class="transcript-speaker">{{ entry.authorName || "Speaker" }}</span>
                  @if (entry.at) {
                    <span class="transcript-time">{{ transcriptTime(entry.at) }}</span>
                  }
                  <p class="transcript-text">{{ entry.text }}</p>
                </div>
              }
            } @else {
              <p class="text-muted mb-0">Nothing was recorded for this meeting.</p>
            }
          </app-thumbnail-heading-frame>
        } @else {
          <app-thumbnail-heading-frame heading="Minutes" class="d-block">
            @if (view === meetingMinutesView.PREVIEW) {
              <app-committee-document-view [committeeFile]="file"/>
            } @else {
              <app-tiptap-markdown-editor
                showPageBreak
                [value]="file.document.markdown"
                placeholder="Write the minutes here…"
                (valueChange)="markdownChanged($event)"/>
            }
          </app-thumbnail-heading-frame>
        }
      }
    </div>`
})
export class VideoMeetingMinutesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private videoMeetingsService = inject(VideoMeetingsService);
  private committeeFileService = inject(CommitteeFileService);
  private committeeConfigService = inject(CommitteeConfigService);
  private dateUtils = inject(DateUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingMinutesComponent", NgxLoggerLevel.ERROR);

  room = "";
  displayTitle = "";
  file: CommitteeFile | null = null;
  transcript = "";
  transcriptEntries: MeetingTranscriptEntry[] = [];
  loading = true;
  busy = false;
  confirmingDelete = false;
  view = MeetingMinutesView.EDIT;
  readonly viewTabs: SectionToggleTab[] = [
    {value: MeetingMinutesView.EDIT, label: "Edit", icon: faPen, aliases: ["minutes"]},
    {value: MeetingMinutesView.PREVIEW, label: "Preview", icon: faEye},
    {value: MeetingMinutesView.TRANSCRIPT, label: "Transcript", icon: faAlignLeft}
  ];
  statusTitle = "";
  statusMessage = "";
  statusVariant = AlertPanelVariant.SUCCESS;
  destinationPages: CommitteeDocumentsPageChoice[] = [];
  selectedPagePath: string | null = null;

  protected readonly meetingsPath = AdminPath.MEETINGS;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faCheck = faCheck;
  protected readonly faFloppyDisk = faFloppyDisk;
  protected readonly faRotateRight = faRotateRight;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  protected readonly faTrash = faTrash;
  protected readonly meetingMinutesView = MeetingMinutesView;
  protected readonly minutesViewParam = StoredValue.MEETING_MINUTES_VIEW;
  protected readonly alertWarning = AlertPanelVariant.WARNING;
  protected readonly alertSuccess = AlertPanelVariant.SUCCESS;

  get onCommitteePage(): boolean {
    return !!this.file?.meeting?.committeePagePath;
  }

  get onCommitteePageLabel(): string {
    const path = this.file?.meeting?.committeePagePath;
    return this.destinationPages.find(page => page.path === path)?.label || path || "the committee documents page";
  }

  get publishRequired(): boolean {
    return !this.onCommitteePage && !!this.selectedPagePath;
  }

  get publishTooltip(): string {
    if (this.onCommitteePage) {
      return "Already published on the committee documents page";
    } else if (!this.selectedPagePath) {
      return "Choose a committee documents page before publishing";
    } else {
      return "Save the draft and add it to the selected committee documents page";
    }
  }

  async ngOnInit(): Promise<void> {
    this.room = this.route.snapshot.paramMap.get("room") || "";
    const roomTitle = this.room.replace(/-\d+$/, "").replace(/-/g, " ").trim();
    this.displayTitle = roomTitle.charAt(0).toUpperCase() + roomTitle.slice(1);
    try {
      const files = await this.committeeFileService.all({
        criteria: {"meeting.room": this.room, "document.templateId": MEETING_MINUTES_TEMPLATE_ID}
      });
      this.file = (files || [])[0] || null;
      this.displayTitle = this.file?.meeting?.title || this.displayTitle;
      if (this.file && !this.file.document) {
        this.file.document = {title: this.file.fileType || "Meeting minutes", markdown: ""};
      } else if (this.file?.document && !this.file.document.markdown) {
        this.file.document.markdown = "";
      }
      const transcriptResponse = await this.videoMeetingsService.transcriptForRoom(this.room);
      this.transcript = transcriptResponse?.transcript || "";
      this.transcriptEntries = transcriptResponse?.entries || [];
      this.destinationPages = await this.committeeFileService.committeeDocumentsPages();
      const year = this.file?.eventDate
        ? this.dateUtils.asString(this.file.eventDate, undefined, UIDateFormat.YEAR)
        : this.dateUtils.asString(this.dateUtils.nowAsValue(), undefined, UIDateFormat.YEAR);
      this.selectedPagePath = preferredCommitteeDocumentsPagePath(
        this.destinationPages,
        this.committeeConfigService.committeeConfig()?.documentsPagePath || null,
        this.file?.meeting?.committeePagePath || null,
        year
      );
    } catch (error) {
      this.logger.error("failed to load meeting minutes", this.room, error);
    }
    this.loading = false;
  }

  markdownChanged(markdown: string): void {
    if (this.file?.document) {
      this.file.document.markdown = markdown;
    }
  }

  async saveDraft(): Promise<boolean> {
    if (!this.file) {
      return false;
    } else {
      this.busy = true;
      this.statusMessage = "";
      try {
        if (this.file.meeting) {
          this.file.meeting = {...this.file.meeting, minutesSummaryPending: false};
        }
        this.file = await this.committeeFileService.createOrUpdate(this.file);
        this.statusTitle = "Draft saved";
        this.statusVariant = AlertPanelVariant.SUCCESS;
        if (this.file.meeting?.committeePagePath) {
          this.statusMessage = "Your edits are saved on the committee document.";
        } else {
          this.statusMessage = "Your edits are saved. They are not on the committee documents page yet.";
        }
        this.busy = false;
        return true;
      } catch (error) {
        this.logger.error("failed to save draft minutes", this.room, error);
        this.statusTitle = "Could not save";
        this.statusMessage = "Please try again in a moment.";
        this.statusVariant = AlertPanelVariant.DANGER;
        this.busy = false;
        return false;
      }
    }
  }

  async saveToCommittee(): Promise<void> {
    const saved = await this.saveDraft();
    if (saved && this.file) {
      this.busy = true;
      try {
        const path = await this.committeeFileService.addToCommitteeDocumentsPage(this.file, this.selectedPagePath);
        if (!path) {
          this.statusTitle = "Could not add to the committee page";
          this.statusMessage = "The draft is saved, but there is no committee documents page to put it on.";
          this.statusVariant = AlertPanelVariant.WARNING;
          this.busy = false;
        } else {
          const meeting = this.file.meeting || {format: CommitteeMeetingFormat.ONLINE, room: this.room};
          this.file = await this.committeeFileService.createOrUpdate({
            ...this.file,
            meeting: {...meeting, committeePagePath: path}
          });
          this.busy = false;
          this.openCommitteeDocument();
        }
      } catch (error) {
        this.logger.error("failed to save minutes to the committee page", this.room, error);
        this.statusTitle = "Could not add to the committee page";
        this.statusMessage = "The draft is saved. Please try again in a moment.";
        this.statusVariant = AlertPanelVariant.DANGER;
        this.busy = false;
      }
    }
  }

  openCommitteeDocument(): void {
    const path = this.file?.meeting?.committeePagePath;
    if (this.file && path) {
      this.router.navigate(["/" + path], {
        queryParams: {[StoredValue.DOCUMENT]: meetingMinutesDocumentSlug(this.file.meeting?.room)}
      });
    }
  }

  transcriptTime(at: number): string {
    return this.dateUtils.displayTime(at);
  }

  async rewriteFromTranscript(): Promise<void> {
    if (!this.room || !this.transcript.trim()) {
      this.statusTitle = "Nothing to rewrite";
      this.statusMessage = "There is no call transcript to write minutes from.";
      this.statusVariant = AlertPanelVariant.WARNING;
    } else {
      this.busy = true;
      this.statusMessage = "";
      try {
        await this.videoMeetingsService.writeMinutes(this.room, {
          transcript: this.transcript,
          chat: "",
          startedAt: null
        }, "", false);
        const files = await this.committeeFileService.all({
          criteria: {"meeting.room": this.room, "document.templateId": MEETING_MINUTES_TEMPLATE_ID}
        });
        this.file = (files || [])[0] || this.file;
        const transcriptResponse = await this.videoMeetingsService.transcriptForRoom(this.room);
        this.transcript = transcriptResponse?.transcript || this.transcript;
        this.statusTitle = "Minutes rewritten";
        this.statusMessage = "The draft now follows the call transcript.";
        this.statusVariant = AlertPanelVariant.SUCCESS;
        this.view = MeetingMinutesView.EDIT;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {[StoredValue.MEETING_MINUTES_VIEW]: MeetingMinutesView.EDIT},
          queryParamsHandling: "merge",
          replaceUrl: true
        });
        this.busy = false;
      } catch (error) {
        this.logger.error("failed to rewrite minutes from transcript", this.room, error);
        this.statusTitle = "Could not rewrite";
        this.statusMessage = "Please try again in a moment.";
        this.statusVariant = AlertPanelVariant.DANGER;
        this.busy = false;
      }
    }
  }

  async deleteMinutes(): Promise<void> {
    if (this.file) {
      this.busy = true;
      this.statusMessage = "";
      try {
        await this.committeeFileService.removeFromCommitteeDocumentsPage(this.file);
        await this.committeeFileService.delete(this.file);
        this.file = null;
        this.confirmingDelete = false;
        await this.router.navigate(["/" + this.meetingsPath]);
      } catch (error) {
        this.logger.error("failed to delete meeting minutes", this.room, error);
        this.statusTitle = "Minutes not deleted";
        this.statusMessage = "Please try again in a moment.";
        this.statusVariant = AlertPanelVariant.DANGER;
        this.busy = false;
      }
    }
  }
}
