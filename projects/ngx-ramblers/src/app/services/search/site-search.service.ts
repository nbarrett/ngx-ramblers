import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { uniq } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { SiteMapPagesApiResponse, SiteMapPagesOutcome, SiteSearchApiResponse, SiteSearchGroup, SiteSearchIndexStatus, SiteSearchIndexStatusApiResponse, SiteSearchOutcome, SiteSearchResult, SiteSearchResultType } from "../../models/site-search.model";
import { StoredValue } from "../../models/ui-actions";
import { isQuoted, unquote } from "../../functions/strings";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

const RECENT_SEARCH_LIMIT = 5;

@Injectable({
  providedIn: "root"
})
export class SiteSearchService {

  private logger: Logger = inject(LoggerFactory).createLogger("SiteSearchService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private sanitizer = inject(DomSanitizer);
  private readonly BASE_URL = "/api/database/search";

  private readonly groupTitles: { type: SiteSearchResultType; title: string }[] = [
    {type: SiteSearchResultType.PAGE, title: "Pages"},
    {type: SiteSearchResultType.WALK, title: "Walks"},
    {type: SiteSearchResultType.EVENT, title: "Events"}
  ];

  async search(query: string, scope?: string, exact?: boolean): Promise<SiteSearchOutcome> {
    const base = new HttpParams().set("q", query);
    const withScope = scope ? base.set("scope", scope) : base;
    const params = exact ? withScope.set("exact", "1") : withScope;
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<SiteSearchApiResponse>(this.BASE_URL, {params}));
    this.logger.info("search for", query, "scope", scope, "returned", apiResponse?.response);
    const results = (apiResponse?.response as SiteSearchResult[]) || [];
    return {results, indexing: !!apiResponse?.indexing, total: apiResponse?.total ?? results.length};
  }

  async indexStatus(): Promise<SiteSearchIndexStatus> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<SiteSearchIndexStatusApiResponse>(`${this.BASE_URL}/status`));
    return apiResponse?.response as SiteSearchIndexStatus;
  }

  async siteMapPages(): Promise<SiteMapPagesOutcome> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<SiteMapPagesApiResponse>(`${this.BASE_URL}/site-map`));
    return {paths: (apiResponse?.response as string[]) || [], indexing: !!apiResponse?.indexing};
  }

  groupResults(results: SiteSearchResult[]): SiteSearchGroup[] {
    return this.groupTitles
      .map(group => ({...group, results: results.filter(result => result.type === group.type)}))
      .filter(group => group.results.length > 0);
  }

  recentSearches(): string[] {
    try {
      const stored = localStorage.getItem(StoredValue.SITE_SEARCH_RECENT);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      this.logger.error("failed to read recent searches:", error);
      return [];
    }
  }

  addRecentSearch(query: string): void {
    const trimmed = (query || "").trim();
    if (trimmed.length > 0) {
      const recent = uniq([trimmed, ...this.recentSearches()]).slice(0, RECENT_SEARCH_LIMIT);
      localStorage.setItem(StoredValue.SITE_SEARCH_RECENT, JSON.stringify(recent));
    }
  }

  clearRecentSearches(): void {
    localStorage.removeItem(StoredValue.SITE_SEARCH_RECENT);
  }

  highlight(text: string, query: string): SafeHtml {
    const escaped = this.escapeHtml(text || "");
    const trimmed = (query || "").trim();
    const sources = isQuoted(trimmed) ? [unquote(trimmed)].filter(source => source.length > 0) : trimmed.split(/\s+/).filter(source => source.length > 0);
    const terms = sources.map(source => this.escapeRegExp(this.escapeHtml(source)));
    if (terms.length === 0) {
      return this.sanitizer.bypassSecurityTrustHtml(escaped);
    }
    const regex = new RegExp(`(${terms.join("|")})`, "gi");
    return this.sanitizer.bypassSecurityTrustHtml(escaped.replace(regex, "<mark>$1</mark>"));
  }

  private escapeHtml(text: string): string {
    const replacements: Record<string, string> = {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"};
    return text.replace(/[&<>"']/g, character => replacements[character]);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
