import { inject, Injectable } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { SystemConfigService } from "./system/system-config.service";

@Injectable({
  providedIn: "root"
})
export class CanonicalLinkService {

  private logger: Logger = inject(LoggerFactory).createLogger("CanonicalLinkService", NgxLoggerLevel.ERROR);
  private document = inject(DOCUMENT);
  private router = inject(Router);
  private systemConfigService = inject(SystemConfigService);
  private baseHref: string;

  initialise(): void {
    this.systemConfigService.events().subscribe(config => {
      this.baseHref = (config?.group?.href || "").replace(/\/+$/, "");
      this.updateCanonicalLink();
    });
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateCanonicalLink());
  }

  private updateCanonicalLink(): void {
    if (this.baseHref) {
      const path = this.router.url.split("?")[0].split("#")[0].replace(/\/+$/, "");
      const canonicalUrl = path && path !== "/" ? `${this.baseHref}${path}` : this.baseHref;
      const link = this.canonicalLinkElement();
      link.setAttribute("href", canonicalUrl);
      this.logger.info("canonical link set to", canonicalUrl);
    }
  }

  private canonicalLinkElement(): HTMLLinkElement {
    const existing: HTMLLinkElement = this.document.head.querySelector("link[rel='canonical']");
    if (existing) {
      return existing;
    } else {
      const link = this.document.createElement("link");
      link.setAttribute("rel", "canonical");
      this.document.head.appendChild(link);
      return link;
    }
  }
}
