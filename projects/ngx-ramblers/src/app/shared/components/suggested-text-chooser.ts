import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faWandMagicSparkles, faXmark } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MarkdownComponent } from "ngx-markdown";
import { DescriptionTidyView } from "../../models/text-diff.model";
import { SectionToggleTab } from "../../models/section-toggle.model";
import { StoredValue } from "../../models/ui-actions";
import { NormaliseMarkdownPipe } from "../../pipes/normalise-markdown.pipe";
import { SectionToggle } from "./section-toggle";

@Component({
  selector: "app-suggested-text-chooser",
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
    @if (checking) {
      <small class="text-muted d-block mt-2"><span class="spinner-border spinner-border-sm me-2"></span>Checking the wording…</small>
    }
    @if (suggestion) {
      @if (showActions) {
        <div class="alert alert-warning py-2 mb-2">
          <div class="d-flex align-items-start gap-2">
            <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1"/>
            <div><strong>{{heading}}</strong> {{prompt}}</div>
          </div>
          <div class="d-flex align-items-center flex-wrap gap-2 mt-2">
            <app-section-toggle small stackOnMobile [tabs]="views" [selectedTab]="view" (selectedTabChange)="viewChange.emit($event)"
                                [queryParamKey]="queryParamKey"/>
            <div class="d-flex gap-1 ms-sm-auto">
              <button type="button" class="tidy-action" [disabled]="disabled" (click)="applied.emit()"
                      tooltip="Use this wording" container="body" aria-label="Use this wording">
                <fa-icon [icon]="faWandMagicSparkles"/>
              </button>
              <button type="button" class="tidy-action" (click)="kept.emit()"
                      tooltip="Keep existing" container="body" aria-label="Keep existing">
                <fa-icon [icon]="faXmark"/>
              </button>
            </div>
          </div>
        </div>
      }
      @if (view === DescriptionTidyView.CHANGES) {
        <div class="tidy-preview" markdown [data]="changesMarkdown"></div>
      } @else if (view === DescriptionTidyView.PROPOSED) {
        <div class="tidy-preview" markdown [data]="suggestion | normaliseMarkdown"></div>
      }
    }
    <div [class.d-none]="suggestion && view !== DescriptionTidyView.ORIGINAL">
      <ng-content/>
    </div>
  `
})
export class SuggestedTextChooserComponent {
  @Input() suggestion = "";
  @Input() changesMarkdown = "";
  @Input() checking = false;
  @Input() disabled = false;
  @Input() showActions = true;
  @Input() heading = "Suggested tidy-up:";
  @Input() prompt = "use the icons on the right to take this wording or keep your own.";
  @Input() view: DescriptionTidyView = DescriptionTidyView.ORIGINAL;
  @Input() views: SectionToggleTab[] = [];
  @Input() queryParamKey: StoredValue = StoredValue.TIDY_VIEW;
  @Output() viewChange = new EventEmitter<string>();
  @Output() applied = new EventEmitter<void>();
  @Output() kept = new EventEmitter<void>();
  protected readonly DescriptionTidyView = DescriptionTidyView;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly faXmark = faXmark;
}
