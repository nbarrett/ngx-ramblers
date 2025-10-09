import { Component, computed, effect, inject, signal } from "@angular/core";
import { DuplicateContentService } from "./duplicate-content-service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { PageComponent } from "../../../page/page.component";
import { DuplicatePageContent, EM_DASH_WITH_SPACES, PageContent } from "../../../models/content-text.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ALERT_SUCCESS, AlertTarget } from "../../../models/alert-target.model";
import { DynamicContentViewComponent } from "../../../modules/common/dynamic-content/dynamic-content-view";
import { StringUtilsService } from "../../../services/string-utils.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faList, faTrash, faWarning } from "@fortawesome/free-solid-svg-icons";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { UiSwitchModule } from "ngx-ui-switch";
import { PageContentService } from "../../../services/page-content.service";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { AlertComponent } from "ngx-bootstrap/alert";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { FormControl, FormGroup } from "@angular/forms";
import { VisibilityObserverDirective } from "../../../notifications/common/visibility-observer.directive";

@Component({
  selector: "app-duplicate-page-content-navigator",
  template: `
    <app-page autoTitle>
      <app-markdown-editor category="admin" name="duplicate-page-content-navigator"/>
      <div class="mb-3 d-flex align-items-center flex-nowrap">
        <label class="me-2 text-nowrap">View Mode: </label>
        <button class="btn btn-sm btn-primary me-2 text-nowrap"
                [class.active]="viewMode() === 'duplicates'"
                (click)="viewMode.set('duplicates')">
          <fa-icon [icon]="faWarning"/> Duplicates
        </button>
        <button class="btn btn-sm btn-primary me-3 text-nowrap"
                [class.active]="viewMode() === 'all'"
                (click)="viewMode.set('all')">
          <fa-icon [icon]="faList"/> All Content
        </button>
        <input class="form-control flex-grow-1" style="min-width: 0" type="text" placeholder="Filter by path"
                [ngModel]="searchTerm()" (ngModelChange)="onSearchChange($event)">
      </div>
      @if (filteredContentItems().length > 0) {
        <section>
          <form [formGroup]="selectionForm">
            <div class="mb-3">
              <select multiple class="form-control"
                      formControlName="selectedIds"
                      size="10">
                @for (item of filteredAllContentItems(); track item.id) {
                  <option [ngValue]="item.id">
                    {{ item.path }}
                  </option>
                }
              </select>
              @if (selectedIds().length > 0) {
                <button class="btn btn-danger mt-2" (click)="bulkDelete()">
                  Delete Selected ({{ selectedIds().length }})
                </button>
              }
            </div>
          </form>
          @for (item of filteredContentItems(); track $index) {
            <h3>
              @if (viewMode() === 'duplicates') {
                <fa-icon class="fa-icon-sunrise me-1" [icon]="faWarning"/>
                Duplicate {{ $index + 1 }} of {{ filteredContentItems().length }}:
              } @else {
                Content Item {{ $index + 1 }} of {{ filteredContentItems().length }}:
              }
              <a class="rams-text-decoration-pink" [href]="item.path">{{ item.path }}</a>
              @if (viewMode() === 'duplicates') {
                {{ EM_DASH_WITH_SPACES }} {{ stringUtils.pluraliseWithCount(getDuplicateCount(item), "duplicate") }}
              }
            </h3>
            @for (content of getContentItems(item); track content.id; let contentIndex = $index) {
              <div class="dotted-content">
                <div class="row align-items-start d-flex">
                  <div class="col-auto">
                    <button (click)="deleteDuplicate(content.id, $event)" class="btn btn-sm btn-primary btn-danger">
                      <fa-icon [icon]="faTrash"/>
                    </button>
                  </div>
                  <div class="col-auto flex-grow-1">
                    <form>
                      <input id="move-or-copy-to-path"
                             [typeahead]="pageContentService.siteLinks"
                             name="destinationPath"
                             autocomplete="nope"
                             [typeaheadMinLength]="0"
                             [(ngModel)]="content.path"
                             type="text" class="form-control">
                    </form>
                  </div>
                  <div class="col-auto">
                    <button class="btn btn-primary mb-3"
                            (click)="changePath(content.id, content.path)">
                      Change Path {{ getContentItems(item).indexOf(content) + 1 }}
                      of {{ getContentItems(item).length }}
                    </button>
                  </div>
                  <div class="col-auto">
                    <button class="btn btn-outline-secondary mb-3"
                            (click)="toggleRender(content.id)">
                      {{ shouldRender(content) ? "Hide Content" : "Show Content" }}
                    </button>
                  </div>
                </div>
                <div [app-visibility-observer]="visibilityLabel(item, content, contentIndex)"
                     (visible)="markVisible(content.id)" style="height:1px"></div>
                @if (shouldRender(content)) {
                  <app-dynamic-content-view [pageContent]="content"
                                            [notify]="notify"
                                            [contentPath]="content.path"
                                            [contentDescription]="content.path"/>
                }
              </div>
            }
          }
        </section>
      } @else {
        <alert type="success" class="flex-grow-1">
          <fa-icon [icon]="ALERT_SUCCESS.icon"/>
          <strong class="ms-2">No content found</strong>
          <div class="ms-2">
            @if (viewMode() === 'duplicates') {
              Looks like your page content has no duplicates!
            } @else {
              No page content found on the site!
            }
          </div>
        </alert>
      }
    </app-page>
  `,
  imports: [
    MarkdownEditorComponent,
    PageComponent,
    DynamicContentViewComponent,
    FontAwesomeModule,
    FormsModule,
    ReactiveFormsModule,
    UiSwitchModule,
    TypeaheadDirective,
    AlertComponent,
    VisibilityObserverDirective
  ]
})
export class DuplicatePageContentNavigatorComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("DuplicatePageContentNavigatorComponent", NgxLoggerLevel.ERROR);
  constructor() {
    effect(async () => {
      await this.loadAndReset();
    });

    this.selectionForm.get("selectedIds")?.valueChanges.subscribe(() => {
      this.onSelectionChange();
    });
  }

  protected pageContentService = inject(PageContentService);
  private notifierService: NotifierService = inject(NotifierService);
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private duplicateContentService = inject(DuplicateContentService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  protected readonly faWarning = faWarning;
  protected readonly faTrash = faTrash;
  protected readonly faList = faList;

  viewMode = signal<"duplicates" | "all">("duplicates");
  contentItems = signal<DuplicatePageContent[]>([]);
  selectedIds = signal<string[]>([]);
  allContentItems = signal<PageContent[]>([]);
  rendered = signal<Record<string, boolean>>({});
  searchTerm = signal<string>("");
  filteredContentItems = computed<DuplicatePageContent[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.contentItems();
    return this.contentItems().filter(item => (item.path || "").toLowerCase().includes(term));
  });
  filteredAllContentItems = computed<PageContent[]>(() => this.filteredContentItems().flatMap(item => item.duplicatePageContents || []));
  private searchDebounce: any;

  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;

  selectionForm = new FormGroup({
    selectedIds: new FormControl<string[]>([])
  });

  async deleteDuplicate(contentPathId: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.duplicateContentService.deleteDuplicate(contentPathId);
    this.refreshContent();
  }

  async changePath(contentPathId: string, changedPath: string): Promise<void> {
    await this.duplicateContentService.changePath(contentPathId, changedPath);
    this.refreshContent();
  }

  onSelectionChange(): void {
    this.selectedIds.set(this.selectionForm.get("selectedIds")?.value || []);
    this.logger.info("Selection changed:", this.selectedIds());
  }

  async bulkDelete(): Promise<void> {
    if (this.selectedIds().length > 0) {
      for (const id of this.selectedIds()) {
        await this.duplicateContentService.deleteDuplicate(id);
      }
      this.selectedIds.set([]);
      this.refreshContent();
    }
  }

  private async refreshContent(): Promise<void> {
    await this.loadAndReset();
  }

  getContentItems(item: DuplicatePageContent): PageContent[] {
    return item.duplicatePageContents || [];
  }

  getDuplicateCount(item: DuplicatePageContent): number {
    return item.duplicatePageContents?.length || 0;
  }

  private updateAllContentItems(): void {
    const flattenedItems = this.contentItems().flatMap(item => item.duplicatePageContents || []);
    this.allContentItems.set(flattenedItems);
  }

  markVisible(id?: string): void {
    if (!id) return;
    const next = { ...this.rendered() };
    next[id] = true;
    this.rendered.set(next);
  }

  toggleRender(id?: string): void {
    if (!id) return;
    const next = { ...this.rendered() };
    next[id] = !next[id];
    this.rendered.set(next);
  }

  shouldRender(content: PageContent): boolean {
    return !!(content?.id && this.rendered()[content.id]);
  }

  private async loadAndReset(): Promise<void> {
    await this.loadForViewMode();
    this.afterLoad();
  }

  private async loadForViewMode(): Promise<void> {
    if (this.viewMode() === "duplicates") {
      this.contentItems.set(await this.duplicateContentService.findDuplicates());
    } else {
      const allContent = await this.pageContentService.all();
      this.contentItems.set(this.wrapAsDuplicatePageContent(allContent));
    }
  }

  private afterLoad(): void {
    this.updateAllContentItems();
    this.rendered.set({});
    this.selectionForm.patchValue({ selectedIds: this.selectedIds() });
  }

  private wrapAsDuplicatePageContent(allContent: PageContent[]): DuplicatePageContent[] {
    return allContent.map(item => ({ path: item.path, duplicatePageContents: [item] } as DuplicatePageContent));
  }

  onSearchChange(value: string) {
    const v = value || "";
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
    this.searchDebounce = setTimeout(() => this.searchTerm.set(v), 300);
  }

  visibilityLabel(item: DuplicatePageContent, content: PageContent, index: number): string {
    const base = item.path || content.path || "";
    const count = this.getContentItems(item).length;
    const position = index + 1;
    const tail = content.id || "";
    const qualifier = count === 1 ? "unduplicated item" : `duplicate ${position}/${count}`;
    return `${base} — ${qualifier} — ${tail}`;
  }
}
