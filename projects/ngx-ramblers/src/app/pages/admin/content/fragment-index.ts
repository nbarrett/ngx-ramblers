import { Component, computed, effect, inject, signal } from "@angular/core";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { PageComponent } from "../../../page/page.component";
import { PageContent } from "../../../models/content-text.model";
import { DynamicContentViewComponent } from "../../../modules/common/dynamic-content/dynamic-content-view";
import { PageContentService } from "../../../services/page-content.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-fragment-index",
  template: `
    <app-page autoTitle>
      <app-markdown-editor category="admin" name="fragment-index"/>

      <div class="mb-3 d-flex align-items-center flex-nowrap">
        <input class="form-control flex-grow-1" style="min-width: 0" type="text" placeholder="Filter by path"
               [ngModel]="searchTerm()" (ngModelChange)="onSearchChange($event)">
      </div>

      @if (filteredFragments().length > 0) {
        <section>
          @for (frag of filteredFragments(); track frag.path; let idx = $index) {
            <h3>Fragment {{ idx + 1 }} of {{ filteredFragments().length }}: <a class="rams-text-decoration-pink" [href]="frag.path">{{ frag.path }}</a></h3>
            <div class="dotted-content">
              <app-dynamic-content-view [pageContent]="frag" [contentPath]="frag.path" [forceView]="true"/>
            </div>
            <div class="mt-2">
              <div class="mb-1">Usages ({{ usagesFor(frag.path).length }}):</div>
              @for (u of usagesFor(frag.path); track u) {
                <a class="me-2 rams-text-decoration-pink" [href]="u">{{ u }}</a>
              }
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
  constructor() {
    effect(async () => {
      await this.load();
    });
  }

  private pageContentService = inject(PageContentService);
  private urlService = inject(UrlService);
  stringUtils = inject(StringUtilsService);

  all = signal<PageContent[]>([]);
  fragments = computed<PageContent[]>(() => this.all().filter(p => (p.path || "").startsWith("fragments/")));
  searchTerm = signal<string>("");
  filteredFragments = computed<PageContent[]>(() => {
    const term = (this.searchTerm() || "").toLowerCase();
    if (!term) return this.fragments();
    return this.fragments().filter(f => (f.path || "").toLowerCase().includes(term));
  });
  private searchDebounce: any;

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
    const normalised = this.urlService.reformatLocalHref(fragmentPath);
    const refers = this.all().filter(p => !(p.path || "").startsWith("fragments/") && (p.rows || []).some(r => (r as any)?.fragment?.path && this.urlService.reformatLocalHref((r as any).fragment.path) === normalised));
    return refers.map(p => p.path);
  }
}

