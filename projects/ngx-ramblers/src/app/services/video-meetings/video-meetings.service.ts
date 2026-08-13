import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom } from "rxjs";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";
import { GuestInviteResponse, MeetingNote, VideoMeeting, VideoMeetingRuntimeConfig, VideoMeetingTokenResponse } from "../../models/video-meeting.model";

@Injectable({providedIn: "root"})
export class VideoMeetingsService {
  private http = inject(HttpClient);
  private urlService = inject(UrlService);
  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingsService", NgxLoggerLevel.ERROR);
  private apiUrl = "/api/video-meetings";
  private notesUrl = "/api/database/meeting-notes";
  private meetingsUrl = "/api/database/video-meetings";
  private externalApiPromises = new Map<string, Promise<void>>();

  config(): Promise<VideoMeetingRuntimeConfig> {
    return firstValueFrom(this.http.get<VideoMeetingRuntimeConfig>(`${this.apiUrl}/config`));
  }

  requestToken(room: string): Promise<VideoMeetingTokenResponse> {
    return firstValueFrom(this.http.post<VideoMeetingTokenResponse>(`${this.apiUrl}/token`, {room}));
  }

  inviteGuest(room: string, email: string, name: string): Promise<GuestInviteResponse> {
    return firstValueFrom(this.http.post<GuestInviteResponse>(`${this.apiUrl}/invite`, {room, email, name}));
  }

  async createPlannedMeeting(meeting: VideoMeeting): Promise<VideoMeeting> {
    const response = await firstValueFrom(this.http.post<{ response: VideoMeeting }>(this.meetingsUrl, meeting));
    return response?.response;
  }

  async guestToken(room: string): Promise<string> {
    const response = await firstValueFrom(this.http.post<{ token: string }>(`${this.apiUrl}/guest-token`, {room}));
    return response?.token;
  }

  async notesForRoom(room: string): Promise<MeetingNote[]> {
    const response = await firstValueFrom(this.http.get<{ response: MeetingNote[] }>(`${this.notesUrl}/room/${encodeURIComponent(room)}`));
    return response?.response || [];
  }

  async addNote(note: MeetingNote): Promise<MeetingNote> {
    const response = await firstValueFrom(this.http.post<{ response: MeetingNote }>(this.notesUrl, note));
    return response?.response;
  }

  async deleteNote(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.notesUrl}/${id}`));
  }

  generateRoomName(prefix: string): string {
    const slug = Array.from({length: 3}, () => Math.random().toString(36).slice(2, 8)).join("-");
    return `${prefix || "ngx"}-${slug}`;
  }

  guestPath(room: string): string {
    return `/video-meetings/guest/${encodeURIComponent(room)}`;
  }

  guestUrl(room: string): string {
    return `${this.urlService.publicBaseUrl()}${this.guestPath(room)}`;
  }

  calendarPath(room: string): string {
    return `/api/calendar/meeting/${encodeURIComponent(room)}.ics`;
  }

  calendarUrl(room: string): string {
    return `${this.urlService.publicBaseUrl()}${this.calendarPath(room)}`;
  }

  loadExternalApi(host: string): Promise<void> {
    if ((window as any).JitsiMeetExternalAPI) {
      return Promise.resolve();
    } else if (this.externalApiPromises.has(host)) {
      return this.externalApiPromises.get(host);
    } else {
      const promise = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `${host}/external_api.js`;
        script.async = true;
        script.onload = () => {
          this.logger.info("loaded Jitsi external API from", host);
          resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load Jitsi external API from ${host}`));
        document.body.appendChild(script);
      });
      this.externalApiPromises.set(host, promise);
      return promise;
    }
  }
}
