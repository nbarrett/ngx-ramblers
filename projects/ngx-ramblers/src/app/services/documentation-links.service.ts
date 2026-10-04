import { DOCUMENT } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { documentationFeaturePath, documentationFeatureUrl } from "../functions/documentation-links";
import { DocumentationSite } from "../models/documentation-links.model";
import { StoredValue } from "../models/ui-actions";
import { UiActionsService } from "./ui-actions.service";

@Injectable({providedIn: "root"})
export class DocumentationLinksService {
  private http = inject(HttpClient);
  private uiActions = inject(UiActionsService);
  private document = inject(DOCUMENT);
  readonly selection = new BehaviorSubject<string | null>(this.uiActions.initialValueFor(StoredValue.DOCUMENTATION_SITE, null));
  private request: Promise<DocumentationSite[]> | null = null;

  sites(): Promise<DocumentationSite[]> {
    if (!this.request) {
      this.request = firstValueFrom(this.http.get<DocumentationSite[]>("/api/documentation/sites")).catch(error => {
        this.request = null;
        throw error;
      });
    }
    return this.request;
  }

  pageOrigin(): string {
    return this.document.defaultView?.location?.origin || this.document.baseURI;
  }

  destinationPath(href: string, origins: string[] = []): string | null {
    return documentationFeaturePath(href, origins, this.pageOrigin());
  }

  destinationUrl(href: string, siteUrl: string, origins: string[] = []): string | null {
    return documentationFeatureUrl(href, siteUrl, origins, this.pageOrigin());
  }

  select(name: string | null): void {
    if (name) {
      this.uiActions.saveValueFor(StoredValue.DOCUMENTATION_SITE, name);
    } else {
      this.uiActions.removeItemFor(StoredValue.DOCUMENTATION_SITE);
    }
    this.selection.next(name || null);
    void this.uiActions.updateQueryParameter(StoredValue.DOCUMENTATION_SITE, name || null);
  }
}
