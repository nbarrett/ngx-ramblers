import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { DescriptionTidyView } from "../../models/text-diff.model";
import { TidyTextApplied, TidyTextItem, TidyTextState } from "../../models/ai.model";
import { SectionToggleTab } from "../../models/section-toggle.model";
import { StoredValue } from "../../models/ui-actions";
import { WalkTextTidyService } from "../../services/ai/walk-text-tidy.service";
import { SuggestedTextChooserComponent } from "./suggested-text-chooser";

@Component({
  selector: "app-walk-text-tidy",
  imports: [SuggestedTextChooserComponent],
  template: `
    <app-suggested-text-chooser
      [suggestion]="state()?.suggestion || ''"
      [showActions]="firstShowing()"
      [changesMarkdown]="state()?.changesMarkdown || ''"
      [checking]="checking()"
      [disabled]="disabled"
      [view]="tidy.view"
      [views]="views()"
      [queryParamKey]="StoredValue.TIDY_VIEW"
      (viewChange)="onViewChange($event)"
      (applied)="apply()"
      (kept)="keep()">
      <ng-content/>
    </app-suggested-text-chooser>
  `
})
export class WalkTextTidyComponent {
  @Input() disabled = false;
  @Output() applied = new EventEmitter<TidyTextApplied>();
  @Output() kept = new EventEmitter<TidyTextApplied>();
  protected tidy = inject(WalkTextTidyService);
  protected readonly StoredValue = StoredValue;
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

  protected firstShowing(): boolean {
    const current = this.state();
    return !!current && this.tidy.firstShowingKind() === current.item.kind;
  }

  onViewChange(view: string): void {
    this.tidy.view = view as DescriptionTidyView;
  }

  protected views(): SectionToggleTab[] {
    return [
      {value: DescriptionTidyView.ORIGINAL, label: this.disabled ? "Original" : "Edit"},
      {value: DescriptionTidyView.CHANGES, label: "Show differences"},
      {value: DescriptionTidyView.PROPOSED, label: "Show proposed changes"}
    ];
  }

  apply(): void {
    const current = this.state();
    if (current) {
      this.applied.emit({kind: current.item.kind, text: this.tidy.apply(current)});
    }
  }

  keep(): void {
    const current = this.state();
    if (current) {
      this.tidy.dismiss(current);
      this.kept.emit({kind: current.item.kind, text: current.item.text});
    }
  }
}
