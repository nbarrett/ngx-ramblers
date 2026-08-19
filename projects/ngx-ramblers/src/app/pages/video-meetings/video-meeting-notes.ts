import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { faPaperPlane, faTrash, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { AiService } from "../../services/ai/ai.service";
import { MeetingNote, MeetingNoteSource, MeetingSpeechCapture } from "../../models/video-meeting.model";
import { ThumbnailHeadingFrameComponent } from "../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { DisplayTimePipe } from "../../pipes/display-time.pipe";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";

@Component({
  selector: "app-video-meeting-notes",
  imports: [FormsModule, FontAwesomeModule, TooltipModule, ThumbnailHeadingFrameComponent, DisplayTimePipe, AlertPanelComponent],
  template: `
    <app-thumbnail-heading-frame heading="Meeting notes">
      @if (canUseAi && !guest) {
        <div class="form-check">
          <input [(ngModel)]="autoWrite"
                 type="checkbox" class="form-check-input"
                 id="auto-meeting-notes"
                 (ngModelChange)="autoWriteChange($event)">
          <label class="form-check-label"
                 for="auto-meeting-notes">Write notes from the call automatically
          </label>
        </div>
        <div class="form-group">
          <button type="button" class="btn btn-primary" [disabled]="writing" (click)="writeMinutes()">
            <fa-icon [icon]="faWandMagicSparkles" class="me-2"/>{{ writing ? "Writing notes…" : "Write notes now" }}
          </button>
        </div>
        @if (aiStatus) {
          <p class="form-text text-muted">{{ aiStatus }}</p>
        }
      } @else if (!guest && aiChecked && !canUseAi) {
        <app-alert-panel title="Automatic notes are unavailable">
          Automatic notes need AI to be switched on for this site.
        </app-alert-panel>
      }
      @for (note of notes; track note.id) {
        <div class="form-group">
          <div class="small">
            <strong>{{ note.authorName }}</strong>
            @if (note.source === MeetingNoteSource.AI) {
              <span> AI</span>
            }
            <span> {{ note.createdAt | displayTime }}</span>
            @if (canDelete(note)) {
              <button type="button" class="btn btn-icon" tooltip="Delete note" (click)="deleteNote(note)">
                <fa-icon [icon]="faTrash"/>
              </button>
            }
          </div>
          <div>{{ note.text }}</div>
        </div>
      } @empty {
        <p class="form-text text-muted">No notes yet. Capture decisions and actions as you go. They are saved to the group,
          not the meeting, so they are still here afterwards.</p>
      }
      <div class="form-group">
        <label for="meeting-note-draft">Add a note</label>
        <textarea id="meeting-note-draft" class="form-control input-sm" [(ngModel)]="draft" rows="3"
                  placeholder="Add a note… (Ctrl+Enter to save)" (keydown.control.enter)="addNote()"></textarea>
      </div>
      <button type="button" class="btn btn-primary" (click)="addNote()">
        <fa-icon [icon]="faPaperPlane" class="me-2"/>Add note
      </button>
    </app-thumbnail-heading-frame>`
})
export class VideoMeetingNotesComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingNotesComponent", NgxLoggerLevel.ERROR);
  private videoMeetingsService = inject(VideoMeetingsService);
  private memberLoginService = inject(MemberLoginService);
  private dateUtils = inject(DateUtilsService);
  private aiService = inject(AiService);

  @Input() room: string;
  @Input() guest = false;

  private speech: MeetingSpeechCapture = {transcript: "", chat: ""};
  private autoTimer: number | null = null;
  private lastWrittenLength = 0;

  @Input() set capture(value: MeetingSpeechCapture) {
    this.speech = value || {transcript: "", chat: ""};
  }

  notes: MeetingNote[] = [];
  draft = "";
  autoWrite = true;
  writing = false;
  canUseAi = false;
  aiChecked = false;
  aiStatus = "";

  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faTrash = faTrash;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly MeetingNoteSource = MeetingNoteSource;

  async ngOnInit(): Promise<void> {
    await this.refresh();
    try {
      this.canUseAi = (await this.aiService.status())?.connected === true;
    } catch (error) {
      this.logger.error("failed to check AI status for meeting notes", error);
      this.canUseAi = false;
    }
    this.aiChecked = true;
    if (this.canUseAi && !this.guest && this.autoWrite) {
      this.startAutoWrite();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoWrite();
  }

  autoWriteChange(enabled: boolean): void {
    this.autoWrite = enabled;
    if (enabled) {
      this.startAutoWrite();
    } else {
      this.stopAutoWrite();
    }
  }

  private startAutoWrite(): void {
    this.stopAutoWrite();
    this.autoTimer = window.setInterval(() => {
      void this.writeMinutes(true);
    }, 180000);
  }

  private stopAutoWrite(): void {
    if (this.autoTimer !== null) {
      window.clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  private async refresh(): Promise<void> {
    if (this.room) {
      try {
        this.notes = await this.videoMeetingsService.notesForRoom(this.room);
      } catch (error) {
        this.logger.error("failed to load notes for room", this.room, error);
      }
    }
  }

  async writeMinutes(automatic = false): Promise<void> {
    const captureLength = (this.speech.transcript || "").length + (this.speech.chat || "").length;
    const handwritten = this.notes
      .filter(note => note.source !== MeetingNoteSource.AI)
      .map(note => `${note.authorName}: ${note.text}`)
      .join("\n");
    const skip = this.writing || (automatic && captureLength < this.lastWrittenLength + 80 && !handwritten);
    const empty = !this.speech.transcript.trim() && !this.speech.chat.trim() && !handwritten.trim();
    if (!skip && empty && !automatic) {
      this.aiStatus = "Nothing to write up yet. Talk in the meeting, use chat, or add a note first.";
    } else if (!skip && !empty) {
      this.writing = true;
      this.aiStatus = automatic ? "Updating notes from the call…" : "Writing notes…";
      try {
        const saved = await this.videoMeetingsService.writeMinutes(this.room, this.speech);
        if (saved) {
          this.notes = [...this.notes.filter(note => note.source !== MeetingNoteSource.AI), saved];
          this.lastWrittenLength = captureLength;
          this.aiStatus = "Notes updated from the call.";
        } else {
          this.aiStatus = "The notes came back empty. Try again in a moment.";
        }
      } catch (error) {
        this.logger.error("failed to write meeting minutes", error);
        this.aiStatus = "We could not write the notes. Try again in a moment.";
      }
      this.writing = false;
    }
  }

  async addNote(): Promise<void> {
    const text = this.draft.trim();
    if (text) {
      const member = this.memberLoginService.loggedInMember();
      const authorName = [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName || "Member";
      const note: MeetingNote = {
        room: this.room,
        memberId: member?.memberId,
        authorName,
        text,
        createdAt: this.dateUtils.nowAsValue(),
        source: MeetingNoteSource.MEMBER
      };
      try {
        const saved = await this.videoMeetingsService.addNote(note);
        this.notes = [...this.notes, saved];
        this.draft = "";
      } catch (error) {
        this.logger.error("failed to add note", error);
      }
    }
  }

  canDelete(note: MeetingNote): boolean {
    const member = this.memberLoginService.loggedInMember();
    return note.memberId === member?.memberId || this.memberLoginService.isAdmin();
  }

  async deleteNote(note: MeetingNote): Promise<void> {
    if (note.id) {
      try {
        await this.videoMeetingsService.deleteNote(note.id);
        this.notes = this.notes.filter(item => item.id !== note.id);
      } catch (error) {
        this.logger.error("failed to delete note", error);
      }
    }
  }
}
