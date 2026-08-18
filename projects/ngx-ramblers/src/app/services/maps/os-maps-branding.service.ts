import { inject, Injectable } from "@angular/core";
import * as L from "leaflet";
import { DateUtilsService } from "../date-utils.service";
import { UIDateFormat } from "../../models/date-format.model";
import {
  OS_MAPS_ATTRIBUTION_LEAD,
  OsMapsBrandingHref
} from "../../models/os-maps-branding.model";

const LOGO_CLASS = "os-api-branding logo";

@Injectable({providedIn: "root"})
export class OsMapsBrandingService {
  private dateUtils = inject(DateUtilsService);

  copyrightYear(): string {
    return this.dateUtils.asString(this.dateUtils.dateTimeNow(), undefined, UIDateFormat.YEAR);
  }

  attributionHtml(): string {
    const year = this.copyrightYear();
    return `${OS_MAPS_ATTRIBUTION_LEAD} ${year}<span class="os-attr-links"><a href="${OsMapsBrandingHref.TERMS}" target="_blank" rel="noopener">Terms</a> · <a href="${OsMapsBrandingHref.ERROR_REPORTING}" target="_blank" rel="noopener">Report an error</a></span>`;
  }

  attachTo(map: L.Map): void {
    if (map.attributionControl) {
      map.attributionControl.setPrefix(false);
    }
    const container = map.getContainer();
    if (!container.querySelector(".os-api-branding.logo")) {
      const logo = document.createElement("div");
      logo.className = LOGO_CLASS;
      logo.setAttribute("aria-hidden", "true");
      const credit = document.createElement("div");
      credit.className = "os-api-branding copyright";
      credit.innerHTML = this.attributionHtml();
      container.appendChild(logo);
      container.appendChild(credit);
    }
  }

  detachFrom(map: L.Map): void {
    const marks = map.getContainer().querySelectorAll(".os-api-branding");
    marks.forEach(node => node.remove());
  }
}
