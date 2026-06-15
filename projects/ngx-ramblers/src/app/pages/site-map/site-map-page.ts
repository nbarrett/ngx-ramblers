import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronRight, faFolder, faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { SafeHtml } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SiteMapViewMode, SitemapNode } from "../../models/sitemap.model";
import { Organisation } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageService } from "../../services/page.service";
import { SiteSearchService } from "../../services/search/site-search.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { sortBy } from "../../functions/arrays";

const TEASER_LIMIT = 5;
const BUILDING_POLL_MS = 2500;

@Component({
  selector: "app-site-map-page",
  template: `
    <div class="site-map-page py-3">
      <h1 class="mb-1">Site map</h1>
      <p class="text-muted mb-3">Browse the website by section, or filter to find a page.</p>
      <div class="site-map-filter mb-4">
        <fa-icon [icon]="faMagnifyingGlass" class="site-map-filter-icon"/>
        <input type="text" class="form-control" placeholder="Filter pages by name"
               aria-label="Filter site map"
               [ngModel]="filter" (ngModelChange)="onFilterChange($event)">
        @if (filter) {
          <button type="button" class="site-map-filter-clear" aria-label="Clear filter" (click)="onFilterChange('')">
            <fa-icon [icon]="faXmark"/>
          </button>
        }
      </div>
      @if (roots.length) {
        <div class="site-map-toolbar mb-4">
          <span class="site-map-toolbar-label">View:</span>
          <button type="button" class="site-map-toolbar-option" [class.active]="viewMode === SiteMapViewMode.SECTIONS" (click)="setViewMode(SiteMapViewMode.SECTIONS)">Sections</button>
          <button type="button" class="site-map-toolbar-option" [class.active]="viewMode === SiteMapViewMode.TREE" (click)="setViewMode(SiteMapViewMode.TREE)">Full tree</button>
          @if (viewMode === SiteMapViewMode.TREE) {
            <span class="site-map-toolbar-label site-map-toolbar-divider">Levels:</span>
            @for (option of depthOptions; track option) {
              <button type="button" class="site-map-toolbar-option" [class.active]="treeDepth === option" (click)="setTreeDepth(option)">{{ option }}</button>
            }
            <button type="button" class="site-map-toolbar-option" [class.active]="treeDepth === ALL_DEPTH" (click)="setTreeDepth(ALL_DEPTH)">All</button>
          }
        </div>
      }
      @if (displayRoots.length) {
        @if (viewMode === SiteMapViewMode.SECTIONS) {
          <div class="site-map-grid">
          @for (root of displayRoots; track root.key) {
            <div class="site-map-card" [class.expanded]="isExpanded(root)">
              <button type="button" class="site-map-card-head" (click)="toggle(root)" [attr.aria-expanded]="isExpanded(root)">
                <span class="site-map-card-icon"><fa-icon [icon]="faFolder"/></span>
                <span class="site-map-card-heading">
                  <span class="site-map-card-title" [innerHTML]="highlight(root.title)"></span>
                  <span class="site-map-card-count">{{ pageCount(root) }} {{ pageCount(root) === 1 ? "page" : "pages" }}</span>
                </span>
                @if (root.children.length) {
                  <fa-icon class="site-map-card-chevron" [icon]="isExpanded(root) ? faChevronDown : faChevronRight"/>
                }
              </button>
              @if (isExpanded(root)) {
                @if (root.children.length) {
                  <ul class="site-map-tree">
                    <ng-container *ngTemplateOutlet="tree; context: {$implicit: root.children}"/>
                  </ul>
                }
                @if (root.href) {
                  <a class="site-map-card-open" [routerLink]="'/' + root.href">Open the {{ root.title }} page</a>
                }
              } @else if (root.children.length) {
                <div class="site-map-card-teaser">{{ teaser(root) }}</div>
              }
            </div>
          }
          </div>
        } @else {
          <ul class="site-map-tree site-map-tree-full">
            <ng-container *ngTemplateOutlet="tree; context: {$implicit: displayRoots}"/>
          </ul>
        }
      } @else if (filter) {
        <p>No pages match "{{ filter }}".</p>
      } @else if (building) {
        <div class="site-map-building">
          <span class="site-map-spinner"></span>
          <span>Building the site map for the first time. Your sections will appear here automatically when it's ready…</span>
        </div>
      } @else {
        <p>No pages to show.</p>
      }
    </div>
    <ng-template #tree let-nodes>
      @for (node of nodes; track node.key) {
        <li class="site-map-node">
          <div class="site-map-row">
            @if (node.children.length) {
              <button type="button" class="site-map-toggle" (click)="toggle(node)"
                      [attr.aria-expanded]="isExpanded(node)"
                      [attr.aria-label]="(isExpanded(node) ? 'Collapse ' : 'Expand ') + node.title">
                <fa-icon [icon]="isExpanded(node) ? faChevronDown : faChevronRight" [fixedWidth]="true"/>
              </button>
            } @else {
              <span class="site-map-leaf"></span>
            }
            @if (node.href) {
              <a class="site-map-link" [routerLink]="'/' + node.href" [innerHTML]="highlight(node.title)"></a>
            } @else {
              <span class="site-map-label" [innerHTML]="highlight(node.title)"></span>
            }
            @if (node.children.length) {
              <span class="site-map-count">{{ descendantPages(node) }}</span>
            }
          </div>
          @if (node.children.length && isExpanded(node)) {
            <ul class="site-map-children">
              <ng-container *ngTemplateOutlet="tree; context: {$implicit: node.children}"/>
            </ul>
          }
        </li>
      }
    </ng-template>`,
  styleUrls: ["./site-map-page.sass"],
  imports: [NgTemplateOutlet, FormsModule, RouterLink, FontAwesomeModule]
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
  public filter = "";
  private filteredRoots: SitemapNode[] = [];
  private expanded = new Set<string>();
  private buildingTimer: ReturnType<typeof setTimeout> | null = null;

  faChevronDown = faChevronDown;
  faChevronRight = faChevronRight;
  faMagnifyingGlass = faMagnifyingGlass;
  faXmark = faXmark;
  faFolder = faFolder;

  viewMode: SiteMapViewMode = SiteMapViewMode.SECTIONS;
  treeDepth = 2;
  readonly ALL_DEPTH = 99;
  readonly depthOptions = [1, 2, 3];
  protected readonly SiteMapViewMode = SiteMapViewMode;

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

  get displayRoots(): SitemapNode[] {
    return this.filter ? this.filteredRoots : this.roots;
  }

  onFilterChange(value: string): void {
    this.filter = value;
    const query = value.trim().toLowerCase();
    this.filteredRoots = query.length > 0 ? this.filterNodes(this.roots, query) : [];
  }

  toggle(node: SitemapNode): void {
    if (this.expanded.has(node.key)) {
      this.expanded.delete(node.key);
    } else {
      this.expanded.add(node.key);
    }
  }

  isExpanded(node: SitemapNode): boolean {
    return !!this.filter || this.expanded.has(node.key);
  }

  setViewMode(mode: SiteMapViewMode): void {
    this.viewMode = mode;
    if (mode === SiteMapViewMode.TREE) {
      this.expandToDepth(this.treeDepth);
    } else {
      this.expanded.clear();
    }
  }

  setTreeDepth(depth: number): void {
    this.treeDepth = depth;
    this.expandToDepth(depth);
  }

  private expandToDepth(depth: number): void {
    this.expanded.clear();
    const walk = (nodes: SitemapNode[], level: number) => nodes.forEach(node => {
      if (level < depth && node.children.length) {
        this.expanded.add(node.key);
        walk(node.children, level + 1);
      }
    });
    walk(this.roots, 0);
  }

  highlight(title: string): SafeHtml {
    return this.siteSearchService.highlight(title, this.filter);
  }

  pageCount(node: SitemapNode): number {
    return (node.href ? 1 : 0) + node.children.reduce((total, child) => total + this.pageCount(child), 0);
  }

  descendantPages(node: SitemapNode): number {
    return node.children.reduce((total, child) => total + this.pageCount(child), 0);
  }

  teaser(root: SitemapNode): string {
    const titles = root.children.map(child => child.title);
    const shown = titles.slice(0, TEASER_LIMIT).join(" · ");
    const remaining = titles.length - TEASER_LIMIT;
    return remaining > 0 ? `${shown} + ${remaining} more` : shown;
  }

  private filterNodes(nodes: SitemapNode[], query: string): SitemapNode[] {
    return nodes.reduce((matches, node) => {
      const selfMatch = node.title.toLowerCase().includes(query);
      const filteredChildren = this.filterNodes(node.children, query);
      if (selfMatch) {
        matches.push(node);
      } else if (filteredChildren.length > 0) {
        matches.push({...node, children: filteredChildren});
      }
      return matches;
    }, [] as SitemapNode[]);
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
    this.onFilterChange(this.filter);
    if (this.viewMode === SiteMapViewMode.TREE) {
      this.expandToDepth(this.treeDepth);
    }
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
