import { Component, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import {
  NotificationConfig,
  overrideKeyToLabel,
  TemplateOverrideState,
  TemplateOverrideType
} from "../../../../models/mail.model";
import { TiptapMarkdownEditor } from "../../../../modules/common/tiptap-editor/tiptap-markdown-editor";

@Component({
  selector: "app-content-block-editor",
  standalone: true,
  imports: [FontAwesomeModule, TiptapMarkdownEditor],
  template: `
    @if (blockKeys.length > 0) {
      <div class="col-sm-12 mt-2">
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Content Blocks</div>
          <div class="col-sm-12 mb-2">
            <small class="text-muted">Each section of this email can use the standard wording, your
              own wording, or be left out entirely. Untouched sections keep tracking the centrally
              maintained version.</small>
          </div>
          @for (key of blockKeys; track key) {
            <div class="col-sm-12 mb-3">
              <div class="border rounded overflow-hidden">
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
                    <div class="btn-group mb-3" role="group">
                      <button type="button" class="btn btn-sm"
                              [class.btn-primary]="blockState(key) === TemplateOverrideState.DEFAULT"
                              [class.btn-outline-secondary]="blockState(key) !== TemplateOverrideState.DEFAULT"
                              (click)="setBlockState(key, TemplateOverrideState.DEFAULT)">Standard wording
                      </button>
                      <button type="button" class="btn btn-sm"
                              [class.btn-primary]="blockState(key) === TemplateOverrideState.CUSTOM"
                              [class.btn-outline-secondary]="blockState(key) !== TemplateOverrideState.CUSTOM"
                              (click)="setBlockState(key, TemplateOverrideState.CUSTOM)">Customise
                      </button>
                      <button type="button" class="btn btn-sm"
                              [class.btn-primary]="blockState(key) === TemplateOverrideState.OMITTED"
                              [class.btn-outline-secondary]="blockState(key) !== TemplateOverrideState.OMITTED"
                              (click)="setBlockState(key, TemplateOverrideState.OMITTED)">Leave out
                      </button>
                    </div>
                    @switch (blockState(key)) {
                      @case (TemplateOverrideState.CUSTOM) {
                        <app-tiptap-markdown-editor [value]="blockContent(key)"
                                                    [showMergeFields]="true"
                                                    placeholder="Write this section in your own words…"
                                                    (valueChange)="blockContentChanged(key, $event)"/>
                      }
                      @case (TemplateOverrideState.OMITTED) {
                        <small class="text-muted">This section will not appear in the email.</small>
                      }
                      @default {
                        <small class="text-muted">Using the standard wording, maintained centrally and
                          kept up to date for you.</small>
                      }
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }`
})
export class ContentBlockEditorComponent {
  @Input() notificationConfig: NotificationConfig;
  @Input() blockKeys: string[] = [];
  @Input() blockDefaults: Record<string, string> = {};

  protected activeAccordion: string = null;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronUp = faChevronUp;
  protected readonly TemplateOverrideState = TemplateOverrideState;

  labelForKey(key: string): string {
    return overrideKeyToLabel(key);
  }

  toggleAccordion(key: string): void {
    this.activeAccordion = this.activeAccordion === key ? null : key;
  }

  blockState(key: string): TemplateOverrideState {
    return this.notificationConfig?.templateOverrides?.[key]?.state || TemplateOverrideState.DEFAULT;
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
    const overrides = this.ensureOverrides();
    if (state === TemplateOverrideState.DEFAULT) {
      delete overrides[key];
    } else {
      const startingContent = state === TemplateOverrideState.CUSTOM
        ? overrides[key]?.content || this.blockDefaults[key] || ""
        : overrides[key]?.content || "";
      overrides[key] = {
        type: TemplateOverrideType.CONTENT,
        state,
        content: startingContent
      };
    }
  }

  blockContentChanged(key: string, content: string): void {
    this.ensureOverrides()[key] = {
      type: TemplateOverrideType.CONTENT,
      state: TemplateOverrideState.CUSTOM,
      content
    };
  }

  private ensureOverrides() {
    if (!this.notificationConfig.templateOverrides) {
      this.notificationConfig.templateOverrides = {};
    }
    return this.notificationConfig.templateOverrides;
  }
}
