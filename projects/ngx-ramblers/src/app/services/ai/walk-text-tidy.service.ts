import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { AiService } from "./ai.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { textFingerprint, wordDiffHtml } from "../../functions/text-diff";
import { DescriptionTidyView } from "../../models/text-diff.model";
import { TidyTextItem, TidyTextKind, TidyTextState } from "../../models/ai.model";
import { normaliseMarkdownText } from "../../functions/markdown";
import { decodeHtmlEntities } from "../../functions/strings";

const TIDY_DEBOUNCE_MS = 300;
const KIND_ORDER: TidyTextKind[] = [TidyTextKind.TITLE, TidyTextKind.DESCRIPTION];

@Injectable()
export class WalkTextTidyService {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkTextTidyService", NgxLoggerLevel.ERROR);
  private aiService = inject(AiService);
  private states = new Map<TidyTextKind, TidyTextState>();
  private available = false;
  private availabilityChecked = false;
  private lastShowing: TidyTextKind[] = [];
  private showingSubject = new Subject<TidyTextKind[]>();
  enabled = true;
  view: DescriptionTidyView = DescriptionTidyView.ORIGINAL;

  showingChanges(): Observable<TidyTextKind[]> {
    return this.showingSubject.asObservable();
  }

  register(item: TidyTextItem): void {
    this.ensureAvailabilityChecked();
    const existing = this.states.get(item.kind);
    const state = existing || this.newState(item);
    const previousText = state.item.text;
    state.item = item;
    if (item.text.trim() !== state.dismissedFor) {
      state.dismissedFor = "";
    }
    if (existing && item.text !== previousText && state.suggestion) {
      this.setSuggestion(state, "");
    }
    if (!existing) {
      state.changes.next(item.text);
    }
    this.states.set(item.kind, state);
  }

  requestCheck(kind: TidyTextKind): void {
    const state = this.states.get(kind);
    if (state) {
      state.changes.next(state.item.text);
    }
  }

  stateFor(kind: TidyTextKind): TidyTextState | null {
    return this.states.get(kind) || null;
  }

  showing(): TidyTextState[] {
    return KIND_ORDER
      .map(kind => this.states.get(kind))
      .filter((state): state is TidyTextState => !!state && state.suggestion.length > 0);
  }

  firstShowingKind(): TidyTextKind | null {
    return this.showing()[0]?.item.kind || null;
  }

  checking(kind: TidyTextKind): boolean {
    return !!this.states.get(kind)?.checking;
  }

  apply(state: TidyTextState): string {
    const tidied = state.suggestion;
    state.dismissedFor = tidied.trim();
    this.setSuggestion(state, "");
    return tidied;
  }

  dismiss(state: TidyTextState): void {
    state.dismissedFor = state.item.text.trim();
    this.setSuggestion(state, "");
  }

  destroy(): void {
    this.states.forEach(state => state.subscription.unsubscribe());
    this.states.clear();
  }

  private ensureAvailabilityChecked(): void {
    if (!this.availabilityChecked) {
      this.availabilityChecked = true;
      this.aiService.status().then(status => {
        this.available = !!status?.connected;
        if (this.available) {
          this.states.forEach(state => state.changes.next(state.item.text));
        }
      }).catch(error => this.logger.warn("AI status check failed", error));
    }
  }

  private newState(item: TidyTextItem): TidyTextState {
    const changes = new Subject<string>();
    const state: TidyTextState = {item, changes, subscription: null, dismissedFor: "", lastChecked: "", checking: false, suggestion: "", changesMarkdown: ""};
    state.subscription = changes.pipe(debounceTime(TIDY_DEBOUNCE_MS)).subscribe(text => void this.check(state, text));
    return state;
  }

  private async check(state: TidyTextState, text: string): Promise<void> {
    const source = text.trim();
    if (!this.available || source === state.lastChecked) {
      this.logger.debug("check skipped for", state.item.kind, "available:", this.available, "alreadyChecked:", source === state.lastChecked);
    } else if (!this.enabled || source.length === 0 || source === state.dismissedFor || textFingerprint(source) === state.item.acceptedFingerprint) {
      state.lastChecked = source;
      this.setSuggestion(state, "");
    } else {
      state.lastChecked = source;
      state.checking = true;
      try {
        const tidied = (await this.aiService.tidyDescription(decodeHtmlEntities(source), state.item.kind)).trim();
        if (state.item.text.trim() === source) {
          this.setSuggestion(state, tidied && tidied !== decodeHtmlEntities(source) ? tidied : "");
        }
      } catch (error) {
        this.logger.warn("tidy check failed", error);
        this.setSuggestion(state, "");
      } finally {
        state.checking = false;
      }
    }
  }

  private setSuggestion(state: TidyTextState, suggestion: string): void {
    state.suggestion = suggestion;
    state.changesMarkdown = suggestion ? wordDiffHtml(normaliseMarkdownText(decodeHtmlEntities(state.item.text.trim())) || "", normaliseMarkdownText(decodeHtmlEntities(suggestion)) || "") : "";
    const showing = this.showing().map(candidate => candidate.item.kind);
    if (showing.join() !== this.lastShowing.join()) {
      this.lastShowing = showing;
      this.showingSubject.next(showing);
    }
    if (showing.length === 0) {
      this.view = DescriptionTidyView.ORIGINAL;
    }
  }
}
