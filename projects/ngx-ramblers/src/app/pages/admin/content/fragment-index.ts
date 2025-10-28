import { Component, computed, effect, inject, signal } from "@angular/core";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { PageComponent } from "../../../page/page.component";
import { PageContent, PageContentRow } from "../../../models/content-text.model";
import { DynamicContentViewComponent } from "../../../modules/common/dynamic-content/dynamic-content-view";
import { PageContentService } from "../../../services/page-content.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Component({
  selector: "app-fragment-index",
  template: `
    <app-page autoTitle>
      <app-markdown-editor standalone category="admin" name="fragment-index"/>
      <div class="mb-3 d-flex align-items-center flex-nowrap">
        <input class="form-control flex-grow-1" style="min-width: 0" type="text" placeholder="Filter by path"
               [ngModel]="searchTerm()" (ngModelChange)="onSearchChange($event)">
      </div>

      @if (filteredFragments().length > 0) {
        <section>
          @for (frag of filteredFragments(); track frag.path; let idx = $index) {
            <h3>Fragment {{ idx + 1 }} of {{ filteredFragments().length }}: <a class="rams-text-decoration-pink"
                                                                               [href]="'/' + (frag.path || '')">{{ frag.path }}</a>
            </h3>
            <div class="dotted-content">
              <app-dynamic-content-view [pageContent]="frag" [contentPath]="frag.path" [forceView]="true"/>
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
        <div class="alert alert-success">No fragments found</div>
      }
    </app-page>
  `,
  imports: [MarkdownEditorComponent, PageComponent, DynamicContentViewComponent, FormsModule]
})
export class FragmentIndexComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("PageContentNavigatorComponent", NgxLoggerLevel.ERROR);
  constructor() {
    this.logger.info("PageContentNavigatorComponent created");
    effect(async () => {
      await this.load();
    });
  }

  private pageContentService = inject(PageContentService);
  private urlService = inject(UrlService);
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
  filteredFragments = computed<PageContent[]>(() => {
    const term = (this.searchTerm() || "").toLowerCase();
    if (!term) return this.fragments();
    return this.fragments().filter(f => (f.path || "").toLowerCase().includes(term));
  });
  private searchDebounce: any;

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
    this.searchDebounce = setTimeout(() => this.searchTerm.set(v), 300);
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
}
