import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { BroadcastService } from "./broadcast-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

export interface ContentTextUnsavedEntry {
  id: string;
  description: string;
  discard: () => void;
}

@Injectable({
  providedIn: "root"
})
export class ContentTextUnsavedChangesService {
  private logger: Logger = inject(LoggerFactory).createLogger("ContentTextUnsavedChangesService", NgxLoggerLevel.ERROR);
  private broadcastService = inject<BroadcastService<ContentTextUnsavedEntry[]>>(BroadcastService);
  private unsaved = new Map<string, ContentTextUnsavedEntry>();

  setUnsaved(entry: ContentTextUnsavedEntry): void {
    this.unsaved.set(entry.id, entry);
    this.logger.info("setUnsaved:", entry.id, entry.description, "count:", this.unsaved.size);
    this.emit();
  }

  clear(id: string): void {
    if (this.unsaved.delete(id)) {
      this.logger.info("clear:", id, "count:", this.unsaved.size);
      this.emit();
    }
  }

  hasUnsaved(): boolean {
    return this.unsaved.size > 0;
  }

  entries(): ContentTextUnsavedEntry[] {
    return Array.from(this.unsaved.values());
  }

  descriptions(): string[] {
    return this.entries().map(entry => entry.description).filter(Boolean);
  }

  summary(): string {
    const labels = this.descriptions();
    if (labels.length === 0) {
      return "unsaved content";
    }
    if (labels.length === 1) {
      return labels[0];
    }
    return labels.join(", ");
  }

  saveOrDiscardMessage(): string {
    return `Save content first using the editor save button (${this.summary()}), or discard those changes to close.`;
  }

  discardAlongsideMessage(): string {
    if (!this.hasUnsaved()) {
      return "";
    }
    return ` Unsaved content will also be discarded: ${this.summary()}.`;
  }

  discardAll(): void {
    const entries = this.entries();
    entries.forEach(entry => entry.discard());
    this.unsaved.clear();
    this.logger.info("discardAll:", entries.length);
    this.emit();
  }

  private emit(): void {
    this.broadcastService.broadcast(
      NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_UNSAVED, this.entries())
    );
  }
}
