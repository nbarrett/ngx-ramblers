import { Component, computed, effect, inject, OnInit, signal } from "@angular/core";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { PageComponent } from "../../../page/page.component";
import { ContentTemplateType, PageContent, PageContentRow, USER_TEMPLATES_PATH_PREFIX } from "../../../models/content-text.model";
import { DynamicContentViewComponent } from "../../../modules/common/dynamic-content/dynamic-content-view";
import { PageContentService } from "../../../services/page-content.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { ActivatedRoute, Router } from "@angular/router";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { isNull, isUndefined } from "es-toolkit/compat";

@Component({
  selector: "app-content-templates",
  template: `
    <app-page autoTitle>
      <app-markdown-editor standalone category="admin" name="content-templates"/>
      <div class="mb-3 d-flex align-items-center flex-wrap gap-2">
        <label class="me-2 mb-0 text-nowrap">View:</label>
        @for (category of categories; track category.id) {
          <button type="button"
                  class="btn btn-sm btn-primary text-nowrap"
                  [class.active]="categorySelection() === category.id"
                  (click)="selectCategory(category.id)">
            {{ category.label }} ({{ categoryCount(category.id) }})
          </button>
        }
      </div>
      <div class="mb-3 d-flex align-items-center flex-nowrap">
        <input class="form-control flex-grow-1" style="min-width: 0" type="text" placeholder="Filter by path"
               [ngModel]="searchTerm()" (ngModelChange)="onSearchChange($event)">
      </div>

      @if (filteredFragments().length > 0) {
        <section>
          @for (frag of filteredFragments(); track frag.path; let idx = $index) {
            <h3>{{ entryLabel(frag) }} {{ idx + 1 }} of {{ filteredFragments().length }}: <a class="rams-text-decoration-pink"
                                                                                             [href]="'/' + (frag.path || '')">{{ frag.path }}</a>
              @if (isMigrationTemplate(frag)) {
                <span class="badge bg-warning text-dark ms-2">Migration template</span>
              } @else if (isUserTemplate(frag)) {
                <span class="badge bg-info text-dark ms-2">User template</span>
              }
            </h3>
            <div class="dotted-content">
              <app-dynamic-content-view [pageContent]="frag" [contentPath]="frag.path" [forceView]="true"/>
              @if (isMigrationTemplate(frag) || isUserTemplate(frag)) {
                <div class="mt-2">
                  <div><strong>Template name:</strong> {{ templateName(frag) }}</div>
                  @if (frag.migrationTemplate?.templateDescription) {
                    <div><strong>Description:</strong> {{ frag.migrationTemplate?.templateDescription }}</div>
                  }
                </div>
                <div class="row g-2 align-items-end mt-2 mb-3">
                  <div class="col-sm-6">
                    <label class="form-label-sm" [for]="destinationInputId(frag)">Destination path</label>
                    <input type="text"
                           class="form-control form-control-sm"
                           [id]="destinationInputId(frag)"
                           placeholder="/example/path"
                           [ngModel]="destinationPathFor(frag)"
                           (ngModelChange)="updateDestinationPath(frag, $event)">
                  </div>
                  <div class="col-sm-3">
                    <button type="button" class="btn btn-sm btn-outline-primary w-100"
                            (click)="createPageFromTemplate(frag)"
                            [disabled]="templateCreationBusy(frag)">
                      {{ templateCreationBusy(frag) ? "Creating…" : "Create page" }}
                    </button>
                  </div>
                  <div class="col-sm-3 small text-muted">
                    {{ templateMessageFor(frag) }}
                  </div>
                </div>
              }
              <div class="mt-2 mb-3">
                <div class="mb-1">Usages ({{ usagesFor(frag.path).length }}):</div>
                @for (u of usagesFor(frag.path); track u) {
                  <a class="me-2 rams-text-decoration-pink" [href]="'/' + u">{{ u }}</a>
                }
              </div>
            </div>
          }
        </section>
      } @else {
        <div class="alert alert-success">No templates or fragments found</div>
      }
    </app-page>
  `,
  imports: [MarkdownEditorComponent, PageComponent, DynamicContentViewComponent, FormsModule]
})
export class ContentTemplatesComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("ContentTemplatesComponent", NgxLoggerLevel.ERROR);
  constructor() {
    this.logger.info("ContentTemplatesComponent created");
    effect(async () => {
      await this.load();
    });
  }

  private pageContentService = inject(PageContentService);
  private urlService = inject(UrlService);
  private actions = inject(PageContentActionsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private uiActionsService = inject(UiActionsService);
  stringUtils = inject(StringUtilsService);

  all = signal<PageContent[]>([]);
  fragments = computed<PageContent[]>(() => this.all().filter(p => (p.path || "").replace(/^\/+/, "").startsWith("fragments/")));
  fragmentIdsByPath = computed<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const f of this.fragments()) {
      const key = this.normaliseFragmentPath(f.path || "");
      const id = f.id || "";
      if (!map[key]) {
        map[key] = [];
      }
      if (id) {
        map[key].push(id);
      }
    }
    return map;
  });
  searchTerm = signal<string>("");
  categories = [
    {id: "fragments", label: "Shared fragments"},
    {id: "userTemplates", label: "User templates"},
    {id: "migrationTemplates", label: "Migration templates"}
  ];
  categorySelection = signal<string>("fragments");
  filteredFragments = computed<PageContent[]>(() => {
    const selection = this.categorySelection();
    const term = (this.searchTerm() || "").toLowerCase();
    return this.fragments()
      .filter(fragment => this.matchesCategory(fragment, selection))
      .filter(f => (f.path || "").toLowerCase().includes(term));
  });
  categoryCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    this.categories.forEach(cat => counts[cat.id] = 0);
    for (const fragment of this.fragments()) {
      this.categories.forEach(cat => {
        if (this.matchesCategory(fragment, cat.id)) {
          counts[cat.id] = (counts[cat.id] || 0) + 1;
        }
      });
    }
    return counts;
  });
  private searchDebounce: any;
  private destinationPaths: Record<string, string> = {};
  private templateMessages: Record<string, string> = {};
  private templateCreationState: Record<string, boolean> = {};

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const viewParam = params.get(this.stringUtils.kebabCase(StoredValue.CONTENT_VIEW_MODE)) ||
        params.get(this.stringUtils.kebabCase(StoredValue.CONTENT_TEMPLATE_VIEW));
      if (viewParam && this.categories.some(cat => cat.id === viewParam)) {
        this.categorySelection.set(viewParam);
        this.uiActionsService.saveValueFor(StoredValue.CONTENT_TEMPLATE_VIEW, viewParam);
      }
      const search = params.get(this.stringUtils.kebabCase(StoredValue.SEARCH));
      if (!isNull(search)) {
        this.searchTerm.set(search);
      }
    });
  }

  private normaliseFragmentPath(value: string): string {
    const reformatted = this.urlService.reformatLocalHref(value || "");
    return reformatted.replace(/^\/+/, "");
  }

  async load(): Promise<void> {
    const content = await this.pageContentService.all();
    this.all.set(content || []);
  }

  onSearchChange(value: string) {
    const v = value || "";
    if (this.searchDebounce) { clearTimeout(this.searchDebounce); }
    this.searchDebounce = setTimeout(() => {
      this.searchTerm.set(v);
      this.replaceQueryParams({ [this.stringUtils.kebabCase(StoredValue.SEARCH)]: v || undefined });
    }, 300);
  }

  selectCategory(category: string) {
    if (!this.categories.some(cat => cat.id === category)) {
      return;
    }
    this.categorySelection.set(category);
    this.uiActionsService.saveValueFor(StoredValue.CONTENT_TEMPLATE_VIEW, category);
    this.replaceQueryParams({ [this.stringUtils.kebabCase(StoredValue.CONTENT_VIEW_MODE)]: category });
  }

  usagesFor(fragmentPath: string): string[] {
    const normalised = this.normaliseFragmentPath(fragmentPath);
    const ids = new Set((this.fragmentIdsByPath()[normalised] || []).filter(v => !!v));
    const refers = this.all().filter(p => {
      const isFragment = (p.path || "").startsWith("fragments/");
      if (isFragment) return false;
      return this.hasFragmentUsage(p.rows || [], normalised, ids);
    });
    return refers.map(p => p.path);
  }

  private hasFragmentUsage(rows: PageContentRow[], normalised: string, ids: Set<string>): boolean {
    for (const row of rows) {
      const frag = (row as any)?.fragment;
      const rowPath = frag?.path ? this.normaliseFragmentPath(frag.path) : "";
      const rowId = frag?.pageContentId || "";
      if ((rowPath && rowPath === normalised) || (rowId && ids.has(rowId))) {
        return true;
      }
      for (const col of row.columns || []) {
        const nested = (col as any)?.rows as PageContentRow[] | undefined;
        if (nested && this.hasFragmentUsage(nested, normalised, ids)) {
          return true;
        }
      }
    }
    return false;
  }

  private matchesCategory(fragment: PageContent, category: string): boolean {
    switch (category) {
      case "userTemplates":
        return this.isUserTemplate(fragment);
      case "migrationTemplates":
        return this.isMigrationTemplate(fragment);
      case "fragments":
      default:
        return this.isSharedTemplate(fragment);
    }
  }

  isMigrationTemplate(fragment: PageContent): boolean {
    return this.templateType(fragment) === ContentTemplateType.MIGRATION_TEMPLATE;
  }

  isUserTemplate(fragment: PageContent): boolean {
    return this.templateType(fragment) === ContentTemplateType.USER_TEMPLATE;
  }

  private isSharedTemplate(fragment: PageContent): boolean {
    const type = this.templateType(fragment);
    if (type) {
      return type === ContentTemplateType.SHARED_FRAGMENT;
    }
    return !this.isUserTemplate(fragment) && !this.isMigrationTemplate(fragment);
  }

  private templateType(fragment: PageContent): ContentTemplateType | "" {
    const type = fragment?.migrationTemplate?.templateType;
    if (type) {
      return type;
    }
    if (fragment?.migrationTemplate?.isTemplate) {
      return ContentTemplateType.MIGRATION_TEMPLATE;
    }
    const normalised = this.normaliseFragmentPath(fragment?.path || "");
    if (normalised.startsWith(USER_TEMPLATES_PATH_PREFIX)) {
      return ContentTemplateType.USER_TEMPLATE;
    }
    return "";
  }

  templateName(fragment: PageContent): string {
    return fragment?.migrationTemplate?.templateName || fragment?.path || "Template";
  }

  destinationPathFor(fragment: PageContent): string {
    return this.destinationPaths[this.fragmentKey(fragment)] || "";
  }

  updateDestinationPath(fragment: PageContent, value: string) {
    this.destinationPaths[this.fragmentKey(fragment)] = value;
  }

  destinationInputId(fragment: PageContent): string {
    return this.stringUtils.kebabCase("template-destination", fragment.id || fragment.path);
  }

  templateCreationBusy(fragment: PageContent): boolean {
    return !!this.templateCreationState[this.fragmentKey(fragment)];
  }

  templateMessageFor(fragment: PageContent): string {
    return this.templateMessages[this.fragmentKey(fragment)] || "";
  }

  async createPageFromTemplate(fragment: PageContent): Promise<void> {
    const destination = (this.destinationPathFor(fragment) || "").trim();
    const normalised = this.urlService.reformatLocalHref(destination);
    if (!normalised) {
      this.templateMessages[this.fragmentKey(fragment)] = "Enter a destination path";
      return;
    }
    const key = this.fragmentKey(fragment);
    this.templateCreationState[key] = true;
    this.templateMessages[key] = "";
    try {
      const rows = await this.actions.copyContentTextIdsInRows(fragment.rows || []);
      const payload: PageContent = {
        path: normalised,
        rows
      };
      await this.pageContentService.createOrUpdate(payload);
      this.templateMessages[key] = `Created/updated ${normalised}`;
      this.destinationPaths[key] = "";
    } catch (error) {
      this.templateMessages[key] = `Failed: ${error}`;
    } finally {
      delete this.templateCreationState[key];
    }
  }

  categoryCount(categoryId: string): number {
    return this.categoryCounts()[categoryId] || 0;
  }

  private replaceQueryParams(params: { [key: string]: any }) {
    const queryParams = Object.fromEntries(Object.entries(params).filter(([, value]) => !isUndefined(value)));
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: "merge" });
  }

  private fragmentKey(fragment: PageContent): string {
    return fragment?.id || fragment?.path || "";
  }

  entryLabel(fragment: PageContent): string {
    if (this.isMigrationTemplate(fragment)) {
      return "Migration template";
    }
    if (this.isUserTemplate(fragment)) {
      return "User template";
    }
    if (this.templateType(fragment) === ContentTemplateType.SHARED_FRAGMENT) {
      return "Shared fragment";
    }
    return "Fragment";
  }
}
