import { inject, Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { isArray, isString, uniq } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { StoredValue } from "../../models/ui-actions";
import { LoggerFactory } from "../logger-factory.service";

const RECENT_SEARCH_LIMIT = 5;

@Injectable({providedIn: "root"})
export class RecentSearchesService {
  private logger = inject(LoggerFactory).createLogger("RecentSearchesService", NgxLoggerLevel.ERROR);
  private histories = new Map<StoredValue, BehaviorSubject<string[]>>();

  recentSearches(key = StoredValue.SITE_SEARCH_RECENT): string[] {
    return [...this.history(key).value];
  }

  events(key = StoredValue.SITE_SEARCH_RECENT): Observable<string[]> {
    return this.history(key).asObservable();
  }

  addRecentSearch(query: string, key = StoredValue.SITE_SEARCH_RECENT): void {
    const trimmed = (query || "").trim();
    if (trimmed) {
      const recent = uniq([trimmed, ...this.recentSearches(key)]).slice(0, RECENT_SEARCH_LIMIT);
      this.history(key).next(recent);
      try {
        localStorage.setItem(key, JSON.stringify(recent));
      } catch (error) {
        this.logger.warn("Could not save recent searches:", error);
      }
    }
  }

  clearRecentSearches(key = StoredValue.SITE_SEARCH_RECENT): void {
    this.history(key).next([]);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      this.logger.warn("Could not clear saved recent searches:", error);
    }
  }

  private history(key: StoredValue): BehaviorSubject<string[]> {
    if (!this.histories.has(key)) {
      this.histories.set(key, new BehaviorSubject(this.read(key)));
    }
    return this.histories.get(key);
  }

  private read(key: StoredValue): string[] {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      return isArray(stored) ? stored.filter(isString).filter(value => value.trim()).slice(0, RECENT_SEARCH_LIMIT) : [];
    } catch (error) {
      this.logger.warn("Could not read recent searches:", error);
      return [];
    }
  }
}
