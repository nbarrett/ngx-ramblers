import { Component, inject, Input, OnInit } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faNoteSticky, faPaperPlane, faTrash } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { MeetingNote } from "../../models/video-meeting.model";

@Component({
  selector: "app-video-meeting-notes",
  imports: [FormsModule, FontAwesomeModule, DatePipe],
  styleUrls: ["./video-meeting-notes.sass"],
  template: `
    <div class="meeting-notes">
      <div class="meeting-notes-header">
        <fa-icon [icon]="faNoteSticky"/>
        <span>Meeting notes</span>
      </div>
      <div class="meeting-notes-list">
        @for (note of notes; track note.id) {
          <div class="meeting-note">
            <div class="meeting-note-meta">
              <span class="author">{{ note.authorName }}</span>
              <span class="time">{{ note.createdAt | date: "shortTime" }}</span>
              @if (canDelete(note)) {
                <button type="button" class="meeting-note-delete" aria-label="Delete note" (click)="deleteNote(note)">
                  <fa-icon [icon]="faTrash"/>
                </button>
              }
            </div>
            <div class="meeting-note-text">{{ note.text }}</div>
          </div>
        } @empty {
          <p class="meeting-notes-empty">No notes yet. Capture decisions and actions as you go — they are saved to the group,
            not the meeting, so they are still here afterwards.</p>
        }
      </div>
      <div class="meeting-notes-compose">
        <textarea [(ngModel)]="draft" rows="3" aria-label="Add a note"
                  placeholder="Add a note… (Ctrl+Enter to save)" (keydown.control.enter)="addNote()"></textarea>
        <button type="button" class="btn btn-primary btn-sm w-100" (click)="addNote()"><fa-icon [icon]="faPaperPlane" class="me-2"/>Add note</button>
      </div>
    </div>`
})
export class VideoMeetingNotesComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingNotesComponent", NgxLoggerLevel.ERROR);
  private videoMeetingsService = inject(VideoMeetingsService);
  private memberLoginService = inject(MemberLoginService);
  private dateUtils = inject(DateUtilsService);

  @Input() room: string;

  notes: MeetingNote[] = [];
  draft = "";

  protected readonly faNoteSticky = faNoteSticky;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faTrash = faTrash;

  async ngOnInit(): Promise<void> {
    await this.refresh();
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
        createdAt: this.dateUtils.nowAsValue()
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
