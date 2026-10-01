import { Injectable } from "@angular/core";
import { InboxThread, InboxGroupingMode } from "../../models/inbox.model";
import { inboxThreadId } from "../../functions/inbox-thread";
@Injectable()
export class InboxConversationsService {
  private siblingsByConversationKey = new Map<string, InboxThread[]>();
  siblingConversationThreads(thread: InboxThread): InboxThread[] {
    const key = thread.conversationKey;
    return key ? (this.siblingsByConversationKey.get(key) ?? [thread]) : [thread];
  }
  index(threads: InboxThread[]): void {
    const byKey = new Map<string, InboxThread[]>();
    threads.forEach(thread => {
      const key = thread.conversationKey;
      if (key) {
        const group = byKey.get(key);
        if (group) {
          group.push(thread);
        }
        else {
          byKey.set(key, [thread]);
        }
      }
    });
    this.siblingsByConversationKey = byKey;
  }
  representativeThread(threads: InboxThread[]): InboxThread {
    return threads.reduce((latest, candidate) => (candidate.lastSeenAt ?? candidate.firstSeenAt ?? 0) > (latest.lastSeenAt ?? latest.firstSeenAt ?? 0) ? candidate : latest);
  }
  conversationRepresentatives(threads: InboxThread[], groupingMode: InboxGroupingMode, viewingSent: boolean): InboxThread[] {
    if (groupingMode === InboxGroupingMode.MESSAGES) {
      return threads;
    }
    else if (viewingSent) {
      const seenKeys = new Set<string>();
      return threads.filter(thread => {
        const key = thread.conversationKey || thread.normalisedSubject || inboxThreadId(thread);
        if (seenKeys.has(key)) {
          return false;
        }
        else {
          seenKeys.add(key);
          return true;
        }
      });
    }
    else {
      const seenKeys = new Set<string>();
      const representatives: InboxThread[] = [];
      threads.forEach(thread => {
        const key = thread.conversationKey;
        if (!key) {
          representatives.push(thread);
        }
        else if (!seenKeys.has(key)) {
          seenKeys.add(key);
          representatives.push(this.representativeThread(this.siblingsByConversationKey.get(key) ?? [thread]));
        }
      });
      return representatives;
    }
  }
}
