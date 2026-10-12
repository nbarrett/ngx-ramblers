import { Component, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoxArchive,
  faBriefcase,
  faBuilding,
  faChartLine,
  faDatabase,
  faDesktop,
  faExternalLinkAlt,
  faFolderOpen,
  faGlobe,
  faHouse,
  faIdCard,
  faKey,
  faPlay,
  faPlug,
  faServer,
  faShieldHalved,
  faUser,
  faUserLock
} from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { ConsoleAccessResolvedUrlInfo, ConsoleAccessUrlIconKey } from "../../../models/environment-setup.model";

@Component({
  selector: "app-console-access-links",
  imports: [FontAwesomeModule, TooltipDirective],
  template: `
    <div class="console-table-links">
      @for (link of links; track link.url) {
        <a [href]="link.url"
           target="_blank"
           rel="noopener noreferrer"
           class="console-table-link"
           [tooltip]="link.label"
           container="body">
          <fa-icon [icon]="iconFor(link)"></fa-icon>
          <span class="console-table-link-text">{{ link.label }}</span>
        </a>
      }
      @if (!links.length && showEmpty) {
        <span class="text-muted">—</span>
      }
    </div>
  `,
  styles: [`
    .console-table-links
      display: flex
      flex-direction: row
      flex-wrap: wrap
      align-items: center
      gap: 0.35rem 0.85rem
      min-width: 0
    .console-table-link
      display: inline-flex
      align-items: center
      gap: 0.4rem
      font-size: inherit
      line-height: 1.35
      white-space: nowrap
    .console-table-link-text
      min-width: 0
  `]
})
export class ConsoleAccessLinksComponent {
  @Input() links: ConsoleAccessResolvedUrlInfo[] = [];
  @Input() showEmpty = true;

  private readonly icons: Record<ConsoleAccessUrlIconKey, IconDefinition> = {
    [ConsoleAccessUrlIconKey.OVERVIEW]: faFolderOpen,
    [ConsoleAccessUrlIconKey.NETWORK]: faShieldHalved,
    [ConsoleAccessUrlIconKey.USERS]: faUserLock,
    [ConsoleAccessUrlIconKey.DASHBOARD]: faDesktop,
    [ConsoleAccessUrlIconKey.METRICS]: faChartLine,
    [ConsoleAccessUrlIconKey.SECRETS]: faKey,
    [ConsoleAccessUrlIconKey.ORGANISATION]: faBuilding,
    [ConsoleAccessUrlIconKey.CONSOLE]: faDesktop,
    [ConsoleAccessUrlIconKey.BUCKET]: faBoxArchive,
    [ConsoleAccessUrlIconKey.ACCOUNT]: faUser,
    [ConsoleAccessUrlIconKey.ZONE]: faGlobe,
    [ConsoleAccessUrlIconKey.DNS]: faServer,
    [ConsoleAccessUrlIconKey.APIS]: faPlug,
    [ConsoleAccessUrlIconKey.CREDENTIALS]: faIdCard,
    [ConsoleAccessUrlIconKey.BUSINESS]: faBriefcase,
    [ConsoleAccessUrlIconKey.REPOSITORIES]: faBoxArchive,
    [ConsoleAccessUrlIconKey.ACTIONS]: faPlay,
    [ConsoleAccessUrlIconKey.HOME]: faHouse,
    [ConsoleAccessUrlIconKey.DATABASE]: faDatabase
  };

  iconFor(link: ConsoleAccessResolvedUrlInfo): IconDefinition {
    if (link.iconKey && this.icons[link.iconKey]) {
      return this.icons[link.iconKey];
    } else {
      return faExternalLinkAlt;
    }
  }
}
