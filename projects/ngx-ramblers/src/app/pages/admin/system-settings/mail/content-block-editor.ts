import { NgTemplateOutlet } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import {
  NotificationConfig,
  overrideKeyToLabel,
  TemplateOverrideState,
  TemplateOverrideType,
  TemplateOverrides
} from "../../../../models/mail.model";
import { MergeFieldGroup } from "../../../../models/email-composer.model";
import { TiptapMarkdownEditor } from "../../../../modules/common/tiptap-editor/tiptap-markdown-editor";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../../models/section-toggle.model";
import { StoredValue } from "../../../../models/ui-actions";

export function contentBlockStateTabs(omitAllowed: boolean): SectionToggleTab[] {
  const tabs: SectionToggleTab[] = [
    { value: TemplateOverrideState.DEFAULT, label: "Standard wording" },
    { value: TemplateOverrideState.CUSTOM, label: "Customise" }
  ];
  if (omitAllowed) {
    tabs.push({ value: TemplateOverrideState.OMITTED, label: "Leave out" });
  }
  return tabs;
}

export function contentBlockState(notificationConfig: NotificationConfig, key: string): TemplateOverrideState {
  const override = notificationConfig?.templateOverrides?.[key];
  if (override?.state === TemplateOverrideState.CUSTOM && override.content?.trim()) {
    return TemplateOverrideState.CUSTOM;
  }
  if (override?.state === TemplateOverrideState.OMITTED) {
    return TemplateOverrideState.OMITTED;
  }
  return TemplateOverrideState.DEFAULT;
}

export function setContentBlockState(notificationConfig: NotificationConfig, key: string, state: TemplateOverrideState, blockDefaults: Record<string, string>): void {
  const overrides = ensureContentBlockOverrides(notificationConfig);
  if (state === TemplateOverrideState.DEFAULT) {
    delete overrides[key];
  } else {
    const startingContent = state === TemplateOverrideState.CUSTOM
      ? overrides[key]?.content || blockDefaults[key] || ""
      : overrides[key]?.content || "";
    overrides[key] = {
      type: TemplateOverrideType.CONTENT,
      state,
      content: startingContent
    };
  }
}

function ensureContentBlockOverrides(notificationConfig: NotificationConfig): TemplateOverrides {
  if (!notificationConfig.templateOverrides) {
    notificationConfig.templateOverrides = {};
  }
  return notificationConfig.templateOverrides;
}

@Component({
  selector: "app-content-block-editor",
  standalone: true,
  imports: [FontAwesomeModule, TiptapMarkdownEditor, SectionToggle, NgTemplateOutlet],
  template: `
    @if (blockKeys.length > 0) {
      <div [class.col-sm-12]="!frameless" [class.mt-2]="!frameless">
        <div [class.row]="!frameless" [class.thumbnail-heading-frame]="!frameless">
          @if (!frameless) {
            <div class="thumbnail-heading">Content Blocks</div>
            <div class="col-sm-12 mb-2">
              <small class="text-muted">Each section of this email can use the standard wording, your
                own wording, or be left out entirely. Untouched sections keep tracking the centrally
                maintained version.</small>
            </div>
          }
          @for (key of blockKeys; track key) {
            @if (!frameless) {
              <div class="col-sm-12 mb-3">
          <div class="border rounded">
                  <button type="button"
                          class="btn text-start text-decoration-none w-100 d-flex justify-content-between align-items-center px-3 py-2"
                          (click)="toggleAccordion(key)">
                    <span>
                      <span class="fw-bold">{{ labelForKey(key) }}</span>
                      <span class="ms-2 small text-muted">{{ stateLabel(key) }}</span>
                    </span>
                    <fa-icon [icon]="activeAccordion === key ? faChevronUp : faChevronDown"/>
                  </button>
                  @if (activeAccordion === key) {
                    <div class="p-3 border-top">
                      <ng-container [ngTemplateOutlet]="blockEditor" [ngTemplateOutletContext]="{$implicit: key}"/>
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="mb-3">
                <ng-container [ngTemplateOutlet]="blockEditor" [ngTemplateOutletContext]="{$implicit: key}"/>
              </div>
            }
          }
        </div>
      </div>
      <ng-template #blockEditor let-key>
        @if (showStateToggle) {
          <app-section-toggle [tabs]="stateTabs()" [selectedTab]="blockState(key)"
                              (selectedTabChange)="setBlockState(key, $event)" [fullWidth]="false"
                              [queryParamKey]="stateQueryParamKey"/>
        }
        @switch (blockState(key)) {
          @case (TemplateOverrideState.CUSTOM) {
            <app-tiptap-markdown-editor [value]="blockContent(key)"
                                        [showMergeFields]="true"
                                        [mergeFieldCatalogue]="mergeFieldCatalogue"
                                        [stickyToolbar]="true"
                                        placeholder="Write this section in your own words…"
                                        (valueChange)="blockContentChanged(key, $event)"/>
          }
          @case (TemplateOverrideState.OMITTED) {
            <div class="mt-2">
              <small class="text-muted">This section will not appear in the email.</small>
            </div>
          }
          @default {
            <div class="mt-2">
              @if (blockDefaults[key]) {
                <app-tiptap-markdown-editor [value]="blockDefaults[key]"
                                            [showMergeFields]="true"
                                            [mergeFieldCatalogue]="mergeFieldCatalogue"
                                            [editable]="false"
                                            [constrainToEmailWidth]="false"/>
              } @else {
                <small class="text-muted">Using the standard wording, maintained centrally and
                  kept up to date for you.</small>
              }
            </div>
          }
        }
      </ng-template>
    }`
})
export class ContentBlockEditorComponent {
  @Input() notificationConfig: NotificationConfig;
  @Input() blockKeys: string[] = [];
  @Input() blockDefaults: Record<string, string> = {};
  @Input() omitAllowed: boolean = true;
  @Input() stateQueryParamKey: StoredValue | null = null;
  @Input() frameless: boolean = false;
  @Input() mergeFieldCatalogue: MergeFieldGroup[] | undefined;
  @Input() showStateToggle: boolean = true;

  protected activeAccordion: string = null;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronUp = faChevronUp;
  protected readonly TemplateOverrideState = TemplateOverrideState;

  labelForKey(key: string): string {
    return overrideKeyToLabel(key);
  }

  stateTabs(): SectionToggleTab[] {
    return contentBlockStateTabs(this.omitAllowed);
  }

  toggleAccordion(key: string): void {
    this.activeAccordion = this.activeAccordion === key ? null : key;
  }

  blockState(key: string): TemplateOverrideState {
    return contentBlockState(this.notificationConfig, key);
  }

  stateLabel(key: string): string {
    switch (this.blockState(key)) {
      case TemplateOverrideState.CUSTOM:
        return "customised";
      case TemplateOverrideState.OMITTED:
        return "left out";
      default:
        return "standard wording";
    }
  }

  blockContent(key: string): string {
    return this.notificationConfig?.templateOverrides?.[key]?.content || "";
  }

  setBlockState(key: string, state: TemplateOverrideState): void {
    setContentBlockState(this.notificationConfig, key, state, this.blockDefaults);
  }

  blockContentChanged(key: string, content: string): void {
    this.ensureOverrides()[key] = {
      type: TemplateOverrideType.CONTENT,
      state: TemplateOverrideState.CUSTOM,
      content
    };
  }

  private ensureOverrides() {
    return ensureContentBlockOverrides(this.notificationConfig);
  }
}
