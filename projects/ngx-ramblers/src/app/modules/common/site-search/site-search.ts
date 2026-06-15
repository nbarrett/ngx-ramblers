import { Component, ElementRef, HostListener, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { SafeHtml } from "@angular/platform-browser";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faClockRotateLeft, faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { from, of, Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, switchMap, tap } from "rxjs/operators";
import { SiteSearchGroup, SiteSearchOutcome, SiteSearchResult, SiteSearchResultType } from "../../../models/site-search.model";
import { isQuoted } from "../../../functions/strings";
import { SiteSearchService } from "../../../services/search/site-search.service";
import { UrlService } from "../../../services/url.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";

const MIN_QUERY_LENGTH = 2;
const INDEXING_POLL_MS = 600;
const PANEL_MARGIN = 16;

@Component({
  selector: "app-site-search",
  template: `
    <div class="site-search">
      <button type="button" class="site-search-toggle" aria-label="Search this site" (click)="toggle()">
        <fa-icon [icon]="faMagnifyingGlass"/>
      </button>
      @if (open) {
        <div class="site-search-panel" [style.left.px]="panelLeft" [style.width.px]="panelWidth" [style.top.px]="panelTop">
          <div class="site-search-input-wrapper">
            <fa-icon [icon]="faMagnifyingGlass" class="site-search-input-icon"/>
            <input #searchInput type="text" class="form-control site-search-input"
                   placeholder="Search pages, walks and events"
                   aria-label="Search query"
                   [ngModel]="query"
                   (ngModelChange)="onQueryChange($event)"
                   (keydown)="onKeydown($event)">
            <button type="button" class="site-search-clear" [attr.aria-label]="query.length ? 'Clear search' : 'Close search'" (click)="clearOrClose()">
              <fa-icon [icon]="faXmark"/>
            </button>
          </div>
          @if (scopePath || query.trim().length >= minQueryLength) {
            <div class="site-search-toolbar">
              @if (scopePath) {
                <div class="site-search-scope">
                  <span class="site-search-scope-label">Search in:</span>
                  <button type="button" class="site-search-scope-option" [class.active]="!scopeActive" (click)="setScope(false)">Whole site</button>
                  <button type="button" class="site-search-scope-option" [class.active]="scopeActive" (click)="setScope(true)">{{ scopeLabel }} and below</button>
                </div>
              }
              @if (phraseModeRelevant()) {
                <div class="site-search-scope">
                  <span class="site-search-scope-label">Match:</span>
                  <button type="button" class="site-search-scope-option" [class.active]="!phraseMode" (click)="setPhraseMode(false)">Any words</button>
                  <button type="button" class="site-search-scope-option" [class.active]="phraseMode" (click)="setPhraseMode(true)">Exact phrase</button>
                </div>
              }
              @if (hasResultSummary()) {
                <span class="site-search-summary">{{ summaryText() }}</span>
              }
            </div>
          }
          <div class="site-search-results">
            @if (searching) {
              <div class="site-search-message">Searching…</div>
            } @else if (indexing) {
              <div class="site-search-message site-search-indexing">
                <span class="site-search-spinner"></span>
                <span>Building the search index for the first time. Your results will appear here automatically when it's ready…</span>
              </div>
            } @else if (query.trim().length >= minQueryLength) {
              @if (results.length) {
                @for (group of groups; track group.type) {
                  <div class="site-search-group-title">{{ group.title }}<span class="site-search-group-count">{{ group.results.length }}</span></div>
                  @for (result of group.results; track result.path) {
                    <a class="site-search-result"
                       [class.active]="isActive(result)"
                       [routerLink]="'/' + result.path"
                       (click)="selectResult()">
                      <div class="site-search-result-title" [innerHTML]="highlight(result.title)"></div>
                      @if (resultMeta(result)) {
                        <div class="site-search-result-breadcrumb">{{ resultMeta(result) }}</div>
                      }
                      @if (result.excerpt) {
                        <div class="site-search-result-excerpt" [innerHTML]="highlight(result.excerpt)"></div>
                      }
                    </a>
                  }
                }
                <button type="button" class="site-search-view-all" [class.active]="activeIndex === results.length"
                   (click)="viewAllResults()">View all results for "{{ query.trim() }}"</button>
              } @else {
                <div class="site-search-message">No results for "{{ query.trim() }}". Try a different word or spelling.</div>
              }
            } @else if (recent.length) {
              <div class="site-search-group-title">Recent searches</div>
              @for (term of recent; track term) {
                <button type="button" class="site-search-result site-search-recent" (click)="applyRecent(term)">
                  <fa-icon [icon]="faClockRotateLeft" class="me-2"/>{{ term }}
                </button>
              }
            } @else {
              <div class="site-search-message">Type at least {{ minQueryLength }} characters to search.</div>
            }
          </div>
        </div>
      }
    </div>`,
  styleUrls: ["./site-search.sass"],
  imports: [FormsModule, RouterLink, FontAwesomeModule]
})
export class SiteSearchComponent implements OnInit, OnDestroy {

  private siteSearchService = inject(SiteSearchService);
  private router = inject(Router);
  private urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private elementRef = inject(ElementRef);

  faMagnifyingGlass = faMagnifyingGlass;
  faXmark = faXmark;
  faClockRotateLeft = faClockRotateLeft;
  minQueryLength = MIN_QUERY_LENGTH;

  open = false;
  query = "";
  results: SiteSearchResult[] = [];
  groups: SiteSearchGroup[] = [];
  recent: string[] = [];
  searching = false;
  indexing = false;
  total = 0;
  activeIndex = -1;
  scopePath = "";
  scopeLabel = "";
  scopeActive = false;
  phraseMode = false;
  panelLeft = 0;
  panelWidth = 0;
  panelTop = 0;
  private pressStartedInside = false;
  private queryChanged = new Subject<string>();
  private indexingTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(this.queryChanged.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      tap(query => this.searching = query.trim().length >= MIN_QUERY_LENGTH),
      switchMap(query => query.trim().length >= MIN_QUERY_LENGTH ? from(this.siteSearchService.search(query, this.currentScope(), this.phraseMode)) : of({results: [], indexing: false, total: 0} as SiteSearchOutcome))
    ).subscribe(outcome => this.applyOutcome(outcome)));
  }

  private applyOutcome(outcome: SiteSearchOutcome): void {
    this.results = outcome.results;
    this.groups = this.siteSearchService.groupResults(outcome.results);
    this.indexing = outcome.indexing;
    this.total = outcome.total;
    this.searching = false;
    this.activeIndex = -1;
    this.scheduleIndexingPoll();
  }

  phraseModeRelevant(): boolean {
    const trimmed = this.query.trim();
    return trimmed.length >= MIN_QUERY_LENGTH && trimmed.split(/\s+/).length > 1;
  }

  hasResultSummary(): boolean {
    return !this.searching && !this.indexing && this.results.length > 0 && this.query.trim().length >= MIN_QUERY_LENGTH;
  }

  summaryText(): string {
    const noun = this.total === 1 ? "result" : "results";
    return this.total > this.results.length ? `Showing first ${this.results.length} of ${this.total} ${noun}` : `${this.total} ${noun}`;
  }

  private scheduleIndexingPoll(): void {
    this.clearIndexingPoll();
    if (this.indexing && this.results.length === 0 && this.query.trim().length >= MIN_QUERY_LENGTH) {
      this.indexingTimer = setTimeout(() => {
        this.siteSearchService.search(this.query, this.currentScope(), this.phraseMode, true).then(outcome => this.applyOutcome(outcome));
      }, INDEXING_POLL_MS);
    }
  }

  private clearIndexingPoll(): void {
    if (this.indexingTimer) {
      clearTimeout(this.indexingTimer);
      this.indexingTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearIndexingPoll();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  toggle(): void {
    if (this.open) {
      this.closeSearch();
    } else {
      this.openSearch();
    }
  }

  openSearch(): void {
    this.open = true;
    this.recent = this.siteSearchService.recentSearches();
    this.scopePath = this.urlService.pathSegments().filter(segment => segment.length > 0).join("/");
    this.scopeLabel = this.scopePath ? this.stringUtils.asTitle(this.urlService.lastPathSegment()) : "";
    this.scopeActive = false;
    this.positionPanel();
    setTimeout(() => this.focusInput(), 0);
  }

  private currentScope(): string | undefined {
    return this.scopeActive && this.scopePath ? this.scopePath : undefined;
  }

  setScope(active: boolean): void {
    this.scopeActive = active;
    this.rerunCurrentQuery();
  }

  setPhraseMode(active: boolean): void {
    this.phraseMode = active;
    this.rerunCurrentQuery();
  }

  private rerunCurrentQuery(): void {
    if (this.query.trim().length >= MIN_QUERY_LENGTH) {
      this.searching = true;
      this.siteSearchService.search(this.query, this.currentScope(), this.phraseMode).then(outcome => this.applyOutcome(outcome));
    }
  }

  private highlightQuery(): string {
    const trimmed = this.query.trim();
    return this.phraseMode && trimmed.length > 0 && !isQuoted(trimmed) ? `"${trimmed}"` : this.query;
  }

  @HostListener("window:resize")
  onResize(): void {
    if (this.open) {
      this.positionPanel();
    }
  }

  private positionPanel(): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    const container = (host.closest(".container") || host.closest("nav")) as HTMLElement;
    this.panelTop = host.getBoundingClientRect().bottom + 8;
    if (container) {
      const rect = container.getBoundingClientRect();
      this.panelLeft = rect.left;
      this.panelWidth = rect.width;
    } else {
      this.panelLeft = PANEL_MARGIN;
      this.panelWidth = window.innerWidth - PANEL_MARGIN * 2;
    }
  }

  closeSearch(): void {
    this.open = false;
    this.activeIndex = -1;
    this.clearIndexingPoll();
  }

  clearOrClose(): void {
    if (this.query.length > 0) {
      this.query = "";
      this.results = [];
      this.groups = [];
      this.indexing = false;
      this.activeIndex = -1;
      this.clearIndexingPoll();
      this.recent = this.siteSearchService.recentSearches();
      this.queryChanged.next("");
      setTimeout(() => this.focusInput(), 0);
    } else {
      this.closeSearch();
    }
  }

  onQueryChange(value: string): void {
    this.query = value;
    this.clearIndexingPoll();
    this.queryChanged.next(value);
  }

  onKeydown(event: KeyboardEvent): void {
    const viewAllAvailable = this.results.length > 0;
    const lastIndex = viewAllAvailable ? this.results.length : this.results.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, lastIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, -1);
    } else if (event.key === "Enter") {
      this.onEnter();
    } else if (event.key === "Escape") {
      this.closeSearch();
    }
  }

  private onEnter(): void {
    if (this.activeIndex >= 0 && this.activeIndex < this.results.length) {
      this.goToResult(this.results[this.activeIndex]);
    } else if (this.query.trim().length >= MIN_QUERY_LENGTH) {
      this.viewAllResults();
    }
  }

  isActive(result: SiteSearchResult): boolean {
    return this.results.indexOf(result) === this.activeIndex;
  }

  selectResult(): void {
    this.siteSearchService.addRecentSearch(this.query);
    setTimeout(() => this.closeSearch());
  }

  private goToResult(result: SiteSearchResult): void {
    this.siteSearchService.addRecentSearch(this.query);
    this.closeSearch();
    this.router.navigateByUrl("/" + result.path);
  }

  viewAllResults(): void {
    const query = this.query.trim();
    this.siteSearchService.addRecentSearch(query);
    this.closeSearch();
    const queryParams: Record<string, string> = {q: query};
    if (this.scopePath) {
      queryParams.section = this.scopePath;
      if (this.scopeActive) {
        queryParams.scope = "1";
      }
    }
    if (this.phraseMode) {
      queryParams.exact = "1";
    }
    this.router.navigate(["/search"], {queryParams});
  }

  applyRecent(term: string): void {
    this.query = term;
    this.searching = true;
    this.siteSearchService.search(term, this.currentScope(), this.phraseMode).then(outcome => this.applyOutcome(outcome));
    setTimeout(() => this.focusInput(), 0);
  }

  highlight(text: string): SafeHtml {
    return this.siteSearchService.highlight(text, this.highlightQuery());
  }

  eventDate(result: SiteSearchResult): string {
    return result.date ? this.dateUtils.displayDate(result.date) : "";
  }

  resultMeta(result: SiteSearchResult): string {
    return [result.breadcrumb, this.eventDate(result), this.contactSummary(result)].filter(part => !!part).join(" · ");
  }

  private contactSummary(result: SiteSearchResult): string {
    return result.contactName ? `${this.contactLabel(result)}: ${result.contactName}` : "";
  }

  private contactLabel(result: SiteSearchResult): string {
    return result.type === SiteSearchResultType.EVENT ? "Coordinator" : "Leader";
  }

  @HostListener("document:mousedown", ["$event"])
  onDocumentMouseDown(event: MouseEvent): void {
    this.pressStartedInside = event.composedPath().includes(this.elementRef.nativeElement);
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    const clickedOutside = !event.composedPath().includes(this.elementRef.nativeElement);
    if (this.open && clickedOutside && !this.pressStartedInside) {
      this.closeSearch();
    }
  }

  private focusInput(): void {
    const input: HTMLInputElement = this.elementRef.nativeElement.querySelector(".site-search-input");
    input?.focus();
  }
}
