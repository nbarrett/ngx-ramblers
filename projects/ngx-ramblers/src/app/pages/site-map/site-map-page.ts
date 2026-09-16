import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SitemapNode } from "../../models/sitemap.model";
import { Organisation } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageService } from "../../services/page.service";
import { SiteSearchService } from "../../services/search/site-search.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { sortBy } from "../../functions/arrays";
import { SiteMapViewComponent } from "../../modules/common/site-map/site-map-view";

const BUILDING_POLL_MS = 2500;

@Component({
  selector: "app-site-map-page",
  template: `
    <div class="site-map-page py-3">
      <h1 class="mb-1">Site map</h1>
      <p class="text-muted mb-3">Browse the website by section, or filter to find a page.</p>
      <app-site-map-view [roots]="roots" [building]="building" showFilter showToolbar/>
    </div>`,
  imports: [SiteMapViewComponent]
})
export class SiteMapPageComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SiteMapPageComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private siteSearchService = inject(SiteSearchService);
  private stringUtils = inject(StringUtilsService);
  private pageService = inject(PageService);
  private subscriptions: Subscription[] = [];
  private group: Organisation;
  private paths: string[] = [];
  public roots: SitemapNode[] = [];
  public building = false;
  private buildingTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit() {
    this.pageService.setTitle("Site map");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.buildTree();
    }));
    await this.loadPages();
  }

  private async loadPages(): Promise<void> {
    const outcome = await this.siteSearchService.siteMapPages();
    this.paths = outcome.paths;
    this.building = outcome.indexing && outcome.paths.length === 0;
    this.buildTree();
    this.scheduleBuildingPoll();
  }

  private scheduleBuildingPoll(): void {
    this.clearBuildingPoll();
    if (this.building) {
      this.buildingTimer = setTimeout(() => this.loadPages(), BUILDING_POLL_MS);
    }
  }

  private clearBuildingPoll(): void {
    if (this.buildingTimer) {
      clearTimeout(this.buildingTimer);
      this.buildingTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearBuildingPoll();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private buildTree(): void {
    const realPaths = new Set(this.paths);
    const nodeIndex = new Map<string, SitemapNode>();
    const roots: SitemapNode[] = [];
    this.paths.forEach(path => {
      path.split("/").filter(segment => segment.length > 0).reduce((parentPath, segment, index, segments) => {
        const cumulative = segments.slice(0, index + 1).join("/");
        if (!nodeIndex.has(cumulative)) {
          const node: SitemapNode = {key: cumulative, title: this.stringUtils.asTitle(segment), href: realPaths.has(cumulative) ? cumulative : null, children: []};
          nodeIndex.set(cumulative, node);
          if (parentPath) {
            nodeIndex.get(parentPath).children.push(node);
          } else {
            roots.push(node);
          }
        }
        return cumulative;
      }, "");
    });
    this.sortChildren(roots);
    this.roots = this.orderedRoots(roots);
    this.logger.info("built site map tree with", this.roots.length, "top-level sections");
  }

  private sortChildren(nodes: SitemapNode[]): void {
    nodes.forEach(node => this.sortChildren(node.children));
    nodes.sort(sortBy("title"));
  }

  private orderedRoots(roots: SitemapNode[]): SitemapNode[] {
    const navbarOrder = (this.group?.pages || []).map(page => page.href);
    return roots.sort((left, right) => {
      const leftIndex = navbarOrder.indexOf(left.href);
      const rightIndex = navbarOrder.indexOf(right.href);
      if (leftIndex !== -1 && rightIndex !== -1) {
        return leftIndex - rightIndex;
      } else if (leftIndex !== -1) {
        return -1;
      } else if (rightIndex !== -1) {
        return 1;
      } else {
        return left.title.localeCompare(right.title);
      }
    });
  }
}
