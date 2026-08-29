import { booleanAttribute, ChangeDetectorRef, Component, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { faPaperPlane, faTrash } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { AiService } from "../../services/ai/ai.service";
import { MeetingNote, MeetingNoteSource, MeetingNotesWriteOutcome, MeetingSpeechCapture } from "../../models/video-meeting.model";
import { DisplayTimePipe } from "../../pipes/display-time.pipe";
import { meetingMinutesWriteError, meetingMinutesWriteIsEmpty, meetingNotesUpdatedMessage } from "../../functions/video-meeting-minutes";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { AlertPanelVariant } from "../../models/alert-panel.model";
import { ThumbnailHeadingFrameComponent } from "../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { DraggableModalComponent } from "../../modules/common/draggable-modal/draggable-modal";

@Component({
  selector: "app-video-meeting-notes",
  imports: [FormsModule, FontAwesomeModule, TooltipModule, DisplayTimePipe, AlertPanelComponent, ThumbnailHeadingFrameComponent, DraggableModalComponent],
  styleUrls: ["./video-meeting-notes.sass"],
  template: `
    <app-draggable-modal [open]="open" contentWidth="min(1040px, 96vw)" [showCloseButton]="false"
                         [minimiseTarget]="minimiseTarget"
                         (closed)="dismiss.emit()">
      <span modalTitle>Meeting notes</span>
      <div modalBody class="notes-modal-body">
        @if (canUseAi && !guest) {
          <app-thumbnail-heading-frame heading="From the call" [compact]="true">
            <p class="notes-capture">Notes are captured automatically from everyone's voice and the chat while the meeting is on, and written up for you. {{ captureSummary }}</p>
          </app-thumbnail-heading-frame>
        } @else if (!guest && aiChecked && !canUseAi) {
          <app-alert-panel title="Automatic notes are unavailable">
            Automatic notes need AI to be switched on for this site. You can still type a note below.
          </app-alert-panel>
        }

        <app-thumbnail-heading-frame heading="Saved notes" [compact]="true">
          <div class="notes-list" #notesList>
            @for (note of notes; track note.id) {
              <article class="note-card" [class.note-card-ai]="note.source === MeetingNoteSource.AI"
                       [attr.data-note-id]="note.id">
                <div class="note-meta">
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
                <div class="note-text">{{ note.text }}</div>
              </article>
            } @empty {
              <p class="notes-empty">No notes yet. They are saved for the group, so they are still here after the call.</p>
            }
          </div>
          <div class="notes-compose">
            <label class="form-label" for="meeting-note-draft">Manually add a note</label>
            <textarea id="meeting-note-draft" class="form-control notes-draft" [(ngModel)]="draft" rows="5"
                      placeholder="Type a decision or action"
                      (keydown.control.enter)="addNote()"
                      (keydown.meta.enter)="addNote()"></textarea>
            <button type="button" class="btn btn-primary notes-action" [disabled]="adding" (click)="addNote()">
              <fa-icon [icon]="faPaperPlane" class="me-2"/>Manually add note
            </button>
          </div>
        </app-thumbnail-heading-frame>
        @if (writeOutcome === MeetingNotesWriteOutcome.FAILED) {
          <app-alert-panel class="mt-3" [title]="writeTitle" [variant]="alertDanger">
            {{ writeMessage }}
          </app-alert-panel>
        }
      </div>
      @if (writeOutcome && writeOutcome !== MeetingNotesWriteOutcome.FAILED) {
        <span modalFooter class="notes-write-status me-auto">{{ writeMessage }}</span>
      }
      <button modalFooter type="button" class="btn btn-quiet" (click)="dismiss.emit()">Close</button>
    </app-draggable-modal>`
})
export class VideoMeetingNotesComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingNotesComponent", NgxLoggerLevel.DEBUG);
  private videoMeetingsService = inject(VideoMeetingsService);
  private memberLoginService = inject(MemberLoginService);
  private dateUtils = inject(DateUtilsService);
  private aiService = inject(AiService);
  private changeDetector = inject(ChangeDetectorRef);
  private hostElement = inject(ElementRef);

  @ViewChild("notesList") private notesList: ElementRef<HTMLDivElement>;

  @Input() room: string;
  @Input() guest = false;
  @Input() minimiseTarget: HTMLElement | null = null;
  @Output() dismiss = new EventEmitter<void>();
  @Output() capturing = new EventEmitter<boolean>();
  notesOpen = false;

  @Input({transform: booleanAttribute}) set open(value: boolean) {
    this.notesOpen = value;
    if (value) {
      void this.refresh();
    }
  }

  get open(): boolean {
    return this.notesOpen;
  }

  private speech: MeetingSpeechCapture = {transcript: "", chat: "", startedAt: null};
  private autoTimer: number | null = null;
  private lastWrittenLength = 0;
  private capturingPulse = {token: 0, until: 0};

  @Input() set capture(value: MeetingSpeechCapture) {
    this.speech = value || {transcript: "", chat: "", startedAt: null};
  }

  notes: MeetingNote[] = [];
  draft = "";
  autoWrite = true;
  writing = false;
  manualWrite = false;
  adding = false;
  canUseAi = false;
  aiChecked = false;
  writeOutcome: MeetingNotesWriteOutcome | null = null;
  writeTitle = "";
  writeMessage = "";

  private writeAttempt = {id: 0};

  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faTrash = faTrash;
  protected readonly MeetingNoteSource = MeetingNoteSource;
  protected readonly MeetingNotesWriteOutcome = MeetingNotesWriteOutcome;
  protected readonly alertDanger = AlertPanelVariant.DANGER;

  get captureSummary(): string {
    const spoken = this.lineCount(this.speech.transcript);
    const chat = this.lineCount(this.speech.chat);
    if (spoken === 0 && chat === 0) {
      return "Waiting to hear the conversation. As people talk or use chat, it is captured for you.";
    } else if (spoken > 0 && chat > 0) {
      return `Heard ${this.lineLabel(spoken)} from the call and ${this.lineLabel(chat)} from chat.`;
    } else if (spoken > 0) {
      return `Heard ${this.lineLabel(spoken)} from the call.`;
    } else {
      return `Heard ${this.lineLabel(chat)} from chat.`;
    }
  }

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
    this.capturingPulse = {token: this.capturingPulse.token + 1, until: 0};
    this.capturing.emit(false);
  }

  private startAutoWrite(): void {
    this.stopAutoWrite();
    void this.writeMinutes(true);
    this.autoTimer = window.setInterval(() => {
      void this.writeMinutes(true);
    }, 60000);
  }

  private stopAutoWrite(): void {
    if (this.autoTimer !== null) {
      window.clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  private startCapturingPulse(): void {
    this.capturingPulse = {token: this.capturingPulse.token + 1, until: this.dateUtils.dateTimeNowAsValue() + 2200};
    this.capturing.emit(true);
  }

  private stopCapturingPulse(): void {
    const token = this.capturingPulse.token;
    const remaining = this.capturingPulse.until - this.dateUtils.dateTimeNowAsValue();
    if (remaining <= 0) {
      this.capturing.emit(false);
    } else {
      window.setTimeout(() => {
        if (this.capturingPulse.token === token) {
          this.capturing.emit(false);
        }
      }, remaining);
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
    if (!automatic && this.draft.trim()) {
      await this.addNote();
    }
    const draftNotSaved = !automatic && !!this.draft.trim();
    const captureLength = (this.speech.transcript || "").length + (this.speech.chat || "").length;
    const handwritten = this.notes
      .filter(note => note.source !== MeetingNoteSource.AI)
      .map(note => `${note.authorName}: ${note.text}`)
      .join("\n");
    const skipAutomatic = automatic && (this.writing || (captureLength < this.lastWrittenLength + 80 && !handwritten));
    const empty = !(this.speech.transcript || "").trim() && !(this.speech.chat || "").trim() && !handwritten.trim();
    this.logger.debug("writeMinutes:", {
      room: this.room,
      automatic,
      writing: this.writing,
      draftNotSaved,
      skipAutomatic,
      empty,
      transcriptChars: (this.speech.transcript || "").length,
      chatChars: (this.speech.chat || "").length,
      handwrittenChars: handwritten.length,
      captureLength
    });
    if (draftNotSaved) {
      this.logger.info("did not write minutes because the new note was not saved");
    } else if (skipAutomatic || (automatic && empty)) {
      this.logger.info("skipped automatic meeting notes write");
      if (automatic && empty && this.notesOpen) {
        this.writeOutcome = MeetingNotesWriteOutcome.EMPTY;
        this.writeMessage = "Waiting for the call to be turned into text, or a typed note.";
      }
    } else if (this.writing) {
      this.manualWrite = true;
      this.writeOutcome = MeetingNotesWriteOutcome.WRITING;
      this.writeMessage = "Capturing notes…";
      this.startCapturingPulse();
    } else if (empty) {
      this.writeOutcome = MeetingNotesWriteOutcome.EMPTY;
      this.writeMessage = "There is no chat or typed note to capture yet. Manually add a note or use chat, then try again.";
    } else {
      const attempt = {id: this.writeAttempt.id + 1};
      this.writeAttempt = attempt;
      this.writing = true;
      this.startCapturingPulse();
      if (!automatic) {
        this.manualWrite = true;
        this.writeOutcome = MeetingNotesWriteOutcome.WRITING;
        this.writeMessage = "Capturing notes…";
      }
      try {
        const saved = await this.videoMeetingsService.writeMinutes(this.room, this.speech, handwritten);
        this.logger.debug("writeMinutes response:", {
          room: this.room,
          automatic,
          attempt: attempt.id,
          currentAttempt: this.writeAttempt.id,
          savedId: saved?.id,
          savedChars: (saved?.text || "").length
        });
        if (this.writeAttempt.id === attempt.id) {
          if (saved) {
            this.showWrittenNotes(saved, captureLength);
          } else if (!automatic || this.manualWrite) {
            this.writeOutcome = MeetingNotesWriteOutcome.EMPTY;
            this.writeMessage = "The notes came back empty. Try again in a moment.";
          }
          this.writing = false;
          this.manualWrite = false;
          this.stopCapturingPulse();
        }
      } catch (error) {
        this.logger.error("failed to write meeting minutes", error);
        if (this.writeAttempt.id === attempt.id) {
          if (!automatic || this.manualWrite) {
            this.writeOutcome = meetingMinutesWriteIsEmpty(error)
              ? MeetingNotesWriteOutcome.EMPTY
              : MeetingNotesWriteOutcome.FAILED;
            this.writeTitle = "Could not write the notes";
            this.writeMessage = meetingMinutesWriteError(error);
          }
          this.writing = false;
          this.manualWrite = false;
          this.stopCapturingPulse();
        }
      }
    }
  }

  async addNote(): Promise<void> {
    const text = this.draft.trim();
    if (this.adding || !text) {
      this.logger.info("did not add a meeting note");
    } else {
      const member = this.memberLoginService.loggedInMember();
      const authorName = [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName || "Member";
      const createdAt = this.dateUtils.nowAsValue();
      const pending: MeetingNote = {
        id: `pending-${createdAt}`,
        room: this.room,
        memberId: member?.memberId,
        authorName,
        text,
        createdAt,
        source: MeetingNoteSource.MEMBER
      };
      this.adding = true;
      this.notes = [...this.notes, pending];
      this.draft = "";
      this.changeDetector.detectChanges();
      this.scrollNotesToLatest();
      try {
        const saved = await this.videoMeetingsService.addNote({
          room: pending.room,
          memberId: pending.memberId,
          authorName: pending.authorName,
          text: pending.text,
          createdAt: pending.createdAt,
          source: pending.source
        });
        if (saved?.id) {
          this.notes = this.notes.map(item => item.id === pending.id ? saved : item);
        } else {
          this.notes = this.notes.filter(item => item.id !== pending.id);
          await this.refresh();
        }
        this.changeDetector.detectChanges();
        this.scrollNotesToLatest();
      } catch (error) {
        this.logger.error("failed to add note", error);
        this.notes = this.notes.filter(item => item.id !== pending.id);
        this.draft = text;
        this.writeOutcome = MeetingNotesWriteOutcome.FAILED;
        this.writeTitle = "Could not save that note";
        this.writeMessage = "Please try again in a moment.";
      }
      this.adding = false;
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

  private showWrittenNotes(saved: MeetingNote, captureLength: number): void {
    this.notes = [saved, ...this.notes.filter(note => note.source !== MeetingNoteSource.AI)];
    this.lastWrittenLength = captureLength;
    this.writeOutcome = MeetingNotesWriteOutcome.UPDATED;
    this.writeMessage = meetingNotesUpdatedMessage(
      this.speech.startedAt
        ? this.dateUtils.formatDuration(this.speech.startedAt, this.dateUtils.dateTimeNowAsValue())
        : ""
    );
    this.changeDetector.detectChanges();
    this.scrollNoteIntoView(saved.id);
  }

  private scrollNotesToLatest(): void {
    const list = this.notesList?.nativeElement || this.hostElement.nativeElement;
    const latest = list?.querySelector?.(".note-card:last-of-type") as HTMLElement;
    this.scrollElementIntoView(latest, "nearest");
  }

  private scrollNoteIntoView(noteId: string): void {
    const root = this.hostElement.nativeElement as HTMLElement;
    const card = noteId ? root.querySelector(`[data-note-id="${noteId}"]`) as HTMLElement : null;
    this.scrollElementIntoView(card, "start");
  }

  private scrollElementIntoView(element: HTMLElement | null, block: ScrollLogicalPosition): void {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (element) {
          element.scrollIntoView({block, inline: "nearest"});
        }
      });
    });
  }

  private lineCount(text: string): number {
    return (text || "").split("\n").filter(line => line.trim()).length;
  }

  private lineLabel(count: number): string {
    if (count === 1) {
      return "1 line";
    } else {
      return `${count} lines`;
    }
  }
}
