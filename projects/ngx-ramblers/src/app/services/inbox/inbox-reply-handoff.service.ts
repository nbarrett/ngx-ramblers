import { Injectable } from "@angular/core";
import { InboxReplyComposeResponse } from "../../models/inbox.model";

@Injectable({
  providedIn: "root"
})
export class InboxReplyHandoffService {

  private pending: InboxReplyComposeResponse | null = null;

  queue(payload: InboxReplyComposeResponse): void {
    this.pending = payload;
  }

  consume(): InboxReplyComposeResponse | null {
    const payload = this.pending;
    this.pending = null;
    return payload;
  }

  peek(): InboxReplyComposeResponse | null {
    return this.pending;
  }
}
