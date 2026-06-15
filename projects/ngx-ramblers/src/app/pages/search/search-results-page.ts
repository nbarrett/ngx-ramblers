import { Component, ElementRef, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faCalendarDays, faFileLines, faMagnifyingGlass, faPersonWalking, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SiteSearchGroup, SiteSearchIndexStatus, SiteSearchRelevance, SiteSearchResult, SiteSearchResultType } from "../../models/site-search.model";
import { isQuoted } from "../../functions/strings";
import { DateUtilsService } from "../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageService } from "../../services/page.service";
import { SiteSearchService } from "../../services/search/site-search.service";
import { StringUtilsService } from "../../services/string-utils.service";

const MIN_QUERY_LENGTH = 2;
const INDEXING_POLL_MS = 600;

@Component({
  selector: "app-search-results-page",
  template: `
    <div class="search-results-page py-3">
      <h1 class="mb-1">Search</h1>
      <div class="input-group search-refine mb-4">
        <div class="search-refine-input-wrapper">
          <input type="text" class="form-control" placeholder="Search pages, walks and events"
                 aria-label="Search query"
                 [(ngModel)]="query"
                 (keyup.enter)="submit()">
          @if (query.length) {
            <button type="button" class="search-refine-clear" aria-label="Clear search" (click)="clear()">
              <fa-icon [icon]="faXmark"/>
            </button>
          }
        </div>
        <button type="button" class="btn btn-primary px-4 text-nowrap search-refine-button" (click)="submit()">
          <fa-icon [icon]="faMagnifyingGlass" class="me-2"/>Search
        </button>
      </div>
      @if (scopePath || phraseModeRelevant()) {
        <div class="search-toolbar mb-4">
          @if (scopePath) {
            <div class="search-scope">
              <span class="search-scope-label">Search in:</span>
              <button type="button" class="search-scope-option" [class.active]="!scopeActive" (click)="setScope(false)">Whole site</button>
              <button type="button" class="search-scope-option" [class.active]="scopeActive" (click)="setScope(true)">{{ scopeLabel }} and below</button>
            </div>
          }
          @if (phraseModeRelevant()) {
            <div class="search-scope">
              <span class="search-scope-label">Match:</span>
              <button type="button" class="search-scope-option" [class.active]="!phraseMode" (click)="setPhraseMode(false)">Any words</button>
              <button type="button" class="search-scope-option" [class.active]="phraseMode" (click)="setPhraseMode(true)">Exact phrase</button>
            </div>
          }
        </div>
      }
      @if (searching) {
        <p>Searching…</p>
      } @else if (indexing) {
        <p class="search-indexing">
          <span class="search-spinner"></span>
          <span>Building the search index for the first time. Your results will appear automatically when it's ready…</span>
        </p>
      } @else if (submittedQuery.length >= minQueryLength) {
        @if (results.length) {
          <p class="text-muted mb-4">{{ summaryText() }} for "{{ submittedQuery }}"</p>
          @for (group of groups; track group.type) {
            <h2 class="h5 search-group-heading mb-3">
              <fa-icon [icon]="iconFor(group.type)" class="me-2"/>{{ group.title }}
              <span class="search-count">{{ group.results.length }}</span>
            </h2>
            <div class="mb-4">
              @for (result of group.results; track result.path) {
                <a class="search-result" [routerLink]="'/' + result.path">
                  <span class="search-result-type" [class]="'type-' + result.type">
                    <fa-icon [icon]="iconFor(result.type)" class="me-1"/>{{ typeLabel(result.type) }}
                  </span>
                  <span class="search-result-title" [innerHTML]="highlight(result.title)"></span>
                  @if (result.breadcrumb) {
                    <span class="search-result-path">{{ result.breadcrumb }}</span>
                  }
                  @if (result.excerpt) {
                    <div class="search-result-excerpt" [innerHTML]="highlight(result.excerpt)"></div>
                  }
                  <div class="search-result-meta">
                    <span class="relevance" [class]="'relevance-' + result.relevance">{{ relevanceLabel(result.relevance) }}</span>
                    <span class="meta-sep">·</span>
                    <span>Matched in {{ result.matchedIn }}</span>
                    @if (eventDate(result)) {
                      <span class="meta-sep">·</span>
                      <span>{{ eventDate(result) }}</span>
                    }
                  </div>
                </a>
              }
            </div>
          }
        } @else {
          <p>No results for "{{ submittedQuery }}". Try a different word or spelling.</p>
        }
      } @else {
        <p>Enter at least {{ minQueryLength }} characters to search the site.</p>
      }
      @if (statusText) {
        <p class="search-index-status">{{ statusText }}</p>
      }
    </div>`,
  styleUrls: ["./search-results-page.sass"],
  imports: [FormsModule, RouterLink, FontAwesomeModule]
})
export class SearchResultsPageComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SearchResultsPageComponent", NgxLoggerLevel.ERROR);
  private siteSearchService = inject(SiteSearchService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pageService = inject(PageService);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);
  private elementRef = inject(ElementRef);

  faMagnifyingGlass = faMagnifyingGlass;
  faXmark = faXmark;
  minQueryLength = MIN_QUERY_LENGTH;
  query = "";
  submittedQuery = "";
  results: SiteSearchResult[] = [];
  groups: SiteSearchGroup[] = [];
  searching = false;
  indexing = false;
  total = 0;
  statusText = "";
  scopePath = "";
  scopeLabel = "";
  scopeActive = false;
  phraseMode = false;
  private indexingTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: Subscription[] = [];

  private readonly typeIcons: Record<SiteSearchResultType, IconProp> = {
    [SiteSearchResultType.PAGE]: faFileLines,
    [SiteSearchResultType.WALK]: faPersonWalking,
    [SiteSearchResultType.EVENT]: faCalendarDays
  };

  private readonly typeLabels: Record<SiteSearchResultType, string> = {
    [SiteSearchResultType.PAGE]: "Page",
    [SiteSearchResultType.WALK]: "Walk",
    [SiteSearchResultType.EVENT]: "Event"
  };

  private readonly relevanceLabels: Record<SiteSearchRelevance, string> = {
    [SiteSearchRelevance.HIGH]: "Strong match",
    [SiteSearchRelevance.MEDIUM]: "Good match",
    [SiteSearchRelevance.LOW]: "Mention"
  };

  ngOnInit(): void {
    this.pageService.setTitle("Search");
    this.loadStatus();
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      this.query = params.get("q") || "";
      this.scopePath = params.get("section") || "";
      this.scopeLabel = this.scopePath ? this.stringUtils.asTitle(this.stringUtils.lastItemFrom(this.scopePath)) : "";
      this.scopeActive = params.get("scope") === "1";
      this.phraseMode = params.get("exact") === "1";
      this.runSearch(this.query);
    }));
  }

  phraseModeRelevant(): boolean {
    const trimmed = this.submittedQuery.trim();
    return trimmed.length >= MIN_QUERY_LENGTH && trimmed.split(/\s+/).length > 1;
  }

  setScope(active: boolean): void {
    this.navigateWith(active, this.phraseMode);
  }

  setPhraseMode(active: boolean): void {
    this.navigateWith(this.scopeActive, active);
  }

  private navigateWith(scopeActive: boolean, phraseMode: boolean): void {
    const queryParams: Record<string, string> = {q: this.query.trim()};
    if (this.scopePath) {
      queryParams.section = this.scopePath;
      if (scopeActive) {
        queryParams.scope = "1";
      }
    }
    if (phraseMode) {
      queryParams.exact = "1";
    }
    this.router.navigate(["/search"], {queryParams});
  }

  ngOnDestroy(): void {
    this.clearIndexingPoll();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  submit(): void {
    this.navigateWith(this.scopeActive, this.phraseMode);
  }

  clear(): void {
    this.query = "";
    this.router.navigate(["/search"]);
    setTimeout(() => this.focusInput(), 0);
  }

  private focusInput(): void {
    const input: HTMLInputElement = this.elementRef.nativeElement.querySelector(".search-refine .form-control");
    input?.focus();
  }

  highlight(text: string) {
    return this.siteSearchService.highlight(text, this.highlightQuery());
  }

  private highlightQuery(): string {
    const trimmed = this.submittedQuery.trim();
    return this.phraseMode && trimmed.length > 0 && !isQuoted(trimmed) ? `"${trimmed}"` : this.submittedQuery;
  }

  iconFor(type: SiteSearchResultType): IconProp {
    return this.typeIcons[type];
  }

  typeLabel(type: SiteSearchResultType): string {
    return this.typeLabels[type];
  }

  relevanceLabel(relevance: SiteSearchRelevance): string {
    return this.relevanceLabels[relevance];
  }

  eventDate(result: SiteSearchResult): string {
    return result.date ? this.dateUtils.displayDate(result.date) : "";
  }

  summaryText(): string {
    const noun = this.total === 1 ? "result" : "results";
    return this.total > this.results.length ? `Showing first ${this.results.length} of ${this.total} ${noun}` : `${this.total} ${noun}`;
  }

  private async loadStatus(): Promise<void> {
    try {
      this.statusText = this.statusTextFrom(await this.siteSearchService.indexStatus());
    } catch (error) {
      this.logger.error("failed to load search index status:", error);
    }
  }

  private statusTextFrom(status: SiteSearchIndexStatus): string {
    if (!status) {
      return "";
    } else if (status.building && !status.indexed) {
      return "Search index is building for the first time. Results will be available shortly.";
    } else if (!status.indexed) {
      return "Search index will build on the first search.";
    } else {
      const age = status.ageMinutes === 0 ? "just now" : `${status.ageMinutes} minute${status.ageMinutes === 1 ? "" : "s"} ago`;
      const rebuilding = status.building ? ", refreshing now" : "";
      return `Search index: ${status.pages} pages and ${status.events} walks and events, updated ${age}${rebuilding}. It refreshes every ${status.ttlMinutes} minutes.`;
    }
  }

  private async runSearch(query: string, wait = false): Promise<void> {
    this.clearIndexingPoll();
    const trimmed = (query || "").trim();
    this.submittedQuery = trimmed;
    if (trimmed.length < MIN_QUERY_LENGTH) {
      this.results = [];
      this.groups = [];
      return;
    }
    if (!wait) {
      this.searching = true;
    }
    try {
      const outcome = await this.siteSearchService.search(trimmed, this.scopeActive && this.scopePath ? this.scopePath : undefined, this.phraseMode, wait);
      this.results = outcome.results;
      this.groups = this.siteSearchService.groupResults(outcome.results);
      this.indexing = outcome.indexing;
      this.total = outcome.total;
      if (!this.indexing) {
        this.loadStatus();
      }
      this.scheduleIndexingPoll();
    } catch (error) {
      this.logger.error("search failed:", error);
      this.results = [];
      this.groups = [];
    } finally {
      this.searching = false;
    }
  }

  private scheduleIndexingPoll(): void {
    this.clearIndexingPoll();
    if (this.indexing && this.results.length === 0 && this.submittedQuery.length >= MIN_QUERY_LENGTH) {
      this.indexingTimer = setTimeout(() => this.runSearch(this.submittedQuery, true), INDEXING_POLL_MS);
    }
  }

  private clearIndexingPoll(): void {
    if (this.indexingTimer) {
      clearTimeout(this.indexingTimer);
      this.indexingTimer = null;
    }
  }
}
