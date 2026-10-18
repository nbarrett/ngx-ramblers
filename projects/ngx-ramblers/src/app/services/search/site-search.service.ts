import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { SiteMapPagesApiResponse, SiteMapPagesOutcome, SiteSearchApiResponse, SiteSearchGroup, SiteSearchIndexStatus, SiteSearchIndexStatusApiResponse, SiteSearchOutcome, SiteSearchResult, SiteSearchResultType } from "../../models/site-search.model";
import { RecentSearchesService } from "./recent-searches.service";
import { escapeHtml, isQuoted, unquote } from "../../functions/strings";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class SiteSearchService {

  private logger: Logger = inject(LoggerFactory).createLogger("SiteSearchService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private sanitizer = inject(DomSanitizer);
  private history = inject(RecentSearchesService);
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
    return {results, indexing: !!apiResponse?.indexing, failed: !!apiResponse?.failed, total: apiResponse?.total ?? results.length};
  }

  async indexStatus(): Promise<SiteSearchIndexStatus> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<SiteSearchIndexStatusApiResponse>(`${this.BASE_URL}/status`));
    const status = apiResponse?.response as SiteSearchIndexStatus;
    return {
      indexed: !!status?.indexed,
      building: !!status?.building,
      failed: !!status?.failed,
      pages: status?.pages ?? 0,
      events: status?.events ?? 0,
      builtAtMillis: status?.builtAtMillis ?? null,
      ageMinutes: status?.ageMinutes ?? null,
      ttlMinutes: status?.ttlMinutes ?? 0
    };
  }

  async siteMapPages(): Promise<SiteMapPagesOutcome> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<SiteMapPagesApiResponse>(`${this.BASE_URL}/site-map`));
    return {paths: (apiResponse?.response as string[]) || [], indexing: !!apiResponse?.indexing};
  }

  groupResults(results: SiteSearchResult[]): SiteSearchGroup[] {
    return this.groupTitles
      .map(group => ({...group, results: this.orderGroup(group.type, results.filter(result => result.type === group.type))}))
      .filter(group => group.results.length > 0);
  }

  private orderGroup(type: SiteSearchResultType, results: SiteSearchResult[]): SiteSearchResult[] {
    if (type === SiteSearchResultType.PAGE) {
      return results;
    }
    return [...results].sort((left, right) => this.startMillis(right) - this.startMillis(left));
  }

  private startMillis(result: SiteSearchResult): number {
    const parsed = result.date ? Date.parse(result.date) : NaN;
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  }

  recentSearches(): string[] {
    return this.history.recentSearches();
  }

  addRecentSearch(query: string): void {
    this.history.addRecentSearch(query);
  }

  clearRecentSearches(): void {
    this.history.clearRecentSearches();
  }

  highlight(text: string, query: string): SafeHtml {
    const escaped = escapeHtml(text || "");
    const trimmed = (query || "").trim();
    const sources = isQuoted(trimmed) ? [unquote(trimmed)].filter(source => source.length > 0) : trimmed.split(/\s+/).filter(source => source.length > 0);
    const terms = sources.map(source => this.escapeRegExp(escapeHtml(source)));
    if (terms.length === 0) {
      return this.sanitizer.bypassSecurityTrustHtml(escaped);
    }
    const regex = new RegExp(`(${terms.join("|")})`, "gi");
    return this.sanitizer.bypassSecurityTrustHtml(escaped.replace(regex, "<mark>$1</mark>"));
  }


  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
