import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faWandMagicSparkles, faXmark } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MarkdownComponent } from "ngx-markdown";
import { DescriptionTidyView } from "../../models/text-diff.model";
import { TidyTextApplied, TidyTextItem, TidyTextState } from "../../models/ai.model";
import { SectionToggleTab } from "../../models/section-toggle.model";
import { StoredValue } from "../../models/ui-actions";
import { NormaliseMarkdownPipe } from "../../pipes/normalise-markdown.pipe";
import { WalkTextTidyService } from "../../services/ai/walk-text-tidy.service";
import { SectionToggle } from "./section-toggle";

@Component({
  selector: "app-walk-text-tidy",
  imports: [FontAwesomeModule, SectionToggle, MarkdownComponent, NormaliseMarkdownPipe, TooltipDirective],
  styles: [`
    .tidy-preview
      background: #fff
      border: 1px solid rgba(0, 0, 0, 0.1)
      border-radius: var(--ngx-radius-sm, 4px)
      padding: 0.75rem 1rem
      margin-bottom: 1rem
    .tidy-action
      background: transparent
      border: 0
      padding: 0.25rem
      line-height: 1
      cursor: pointer
      color: #1d3557
    .tidy-action:hover
      color: #000
    .tidy-action:disabled
      opacity: 0.4
      cursor: default
  `],
  template: `
    @if (checking()) {
      <small class="text-muted d-block mt-2"><span class="spinner-border spinner-border-sm me-2"></span>Checking the wording…</small>
    }
    @if (state(); as current) {
      @if (tidy.firstShowingKind() === current.item.kind) {
        <div class="alert alert-warning py-2 mb-2">
          <div class="d-flex align-items-start gap-2">
            <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1"/>
            <div><strong>Suggested tidy-up:</strong> use the icons on the right to take this wording or keep your own.</div>
          </div>
          <div class="d-flex align-items-center flex-wrap gap-2 mt-2">
            <app-section-toggle small stackOnMobile [tabs]="views()" [selectedTab]="tidy.view" (selectedTabChange)="tidy.view = $event"
                                [queryParamKey]="StoredValue.TIDY_VIEW"/>
            <div class="d-flex gap-1 ms-sm-auto">
              <button type="button" class="tidy-action" [disabled]="disabled" (click)="apply(current)"
                      tooltip="Use this wording" container="body" aria-label="Use this wording">
                <fa-icon [icon]="faWandMagicSparkles"/>
              </button>
              <button type="button" class="tidy-action" (click)="keep(current)"
                      tooltip="Keep existing" container="body" aria-label="Keep existing">
                <fa-icon [icon]="faXmark"/>
              </button>
            </div>
          </div>
        </div>
      }
      @if (tidy.view === DescriptionTidyView.CHANGES) {
        <div class="tidy-preview" markdown [data]="current.changesMarkdown"></div>
      } @else if (tidy.view === DescriptionTidyView.PROPOSED) {
        <div class="tidy-preview" markdown [data]="current.suggestion | normaliseMarkdown"></div>
      }
    }
    <div [class.d-none]="showingPreview()">
      <ng-content/>
    </div>
  `
})
export class WalkTextTidyComponent {
  @Input() disabled = false;
  @Output() applied = new EventEmitter<TidyTextApplied>();
  @Output() kept = new EventEmitter<TidyTextApplied>();
  protected tidy = inject(WalkTextTidyService);
  protected readonly StoredValue = StoredValue;
  protected readonly DescriptionTidyView = DescriptionTidyView;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly faXmark = faXmark;
  private itemValue: TidyTextItem | null = null;

  @Input() set item(item: TidyTextItem) {
    this.itemValue = item;
    this.tidy.register(item);
  }

  protected state(): TidyTextState | null {
    const state = this.itemValue ? this.tidy.stateFor(this.itemValue.kind) : null;
    return state?.suggestion ? state : null;
  }

  protected checking(): boolean {
    return !!this.itemValue && this.tidy.checking(this.itemValue.kind);
  }

  protected showingPreview(): boolean {
    return !!this.state() && this.tidy.view !== DescriptionTidyView.ORIGINAL;
  }

  protected views(): SectionToggleTab[] {
    return [
      {value: DescriptionTidyView.ORIGINAL, label: this.disabled ? "Original" : "Edit"},
      {value: DescriptionTidyView.CHANGES, label: "Show differences"},
      {value: DescriptionTidyView.PROPOSED, label: "Show proposed changes"}
    ];
  }

  apply(state: TidyTextState): void {
    this.applied.emit({kind: state.item.kind, text: this.tidy.apply(state)});
  }

  keep(state: TidyTextState): void {
    this.tidy.dismiss(state);
    this.kept.emit({kind: state.item.kind, text: state.item.text});
  }
}
