import { Injectable } from "@angular/core";
import { VideoMeetingInviteHandoff } from "../../models/video-meeting.model";

@Injectable({
  providedIn: "root"
})
export class VideoMeetingInviteHandoffService {

  private pending: VideoMeetingInviteHandoff | null = null;

  queue(payload: VideoMeetingInviteHandoff): void {
    this.pending = payload;
  }

  consume(): VideoMeetingInviteHandoff | null {
    const payload = this.pending;
    this.pending = null;
    return payload;
  }

  peek(): VideoMeetingInviteHandoff | null {
    return this.pending;
  }
}
