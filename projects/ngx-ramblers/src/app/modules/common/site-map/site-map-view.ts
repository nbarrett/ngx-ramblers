import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowDown, faArrowUp, faArrowUpRightFromSquare, faChevronDown, faChevronRight, faFolder, faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { SafeHtml } from "@angular/platform-browser";
import { SiteMapViewMode, SitemapMoveDirection, SitemapNode, sitemapHrefIsExternal } from "../../../models/sitemap.model";
import { SiteSearchService } from "../../../services/search/site-search.service";

const TEASER_LIMIT = 5;

@Component({
  selector: "app-site-map-view",
  styleUrls: ["./site-map-view.sass"],
  imports: [NgTemplateOutlet, FormsModule, RouterLink, FontAwesomeModule, TooltipModule],
  template: `
    @if (showFilter) {
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
    }
    @if (showToolbar && roots.length) {
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
      <div [class.site-map-with-preview]="showPreview">
      <div>
      @if (viewMode === SiteMapViewMode.SECTIONS) {
        <div class="site-map-grid">
          @for (root of displayRoots; track root.key; let index = $index) {
            <div class="site-map-card" [class.expanded]="isExpanded(root)" [class.site-map-omitted]="selectable && root.selected === false">
              <div class="d-flex align-items-center">
              @if (selectable) {
                <label class="site-map-select mb-0 ms-2"><input type="checkbox" [ngModel]="root.selected" (ngModelChange)="changeSelection(root, $event)" [attr.aria-label]="'Import ' + root.title"/></label>
              }
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
              @if (selectable) {
                <div class="site-map-move">
                  <button type="button" class="site-map-toggle" tooltip="Move up" [disabled]="index === 0" (click)="move(root, MoveDirection.UP)"><fa-icon [icon]="faArrowUp"/></button>
                  <button type="button" class="site-map-toggle" tooltip="Move down" [disabled]="index === displayRoots.length - 1" (click)="move(root, MoveDirection.DOWN)"><fa-icon [icon]="faArrowDown"/></button>
                </div>
              }
              </div>
              @if (isExpanded(root)) {
                @if (root.children.length) {
                  <ul class="site-map-tree">
                    <ng-container *ngTemplateOutlet="tree; context: {$implicit: root.children}"/>
                  </ul>
                }
                @if (root.href) {
                  @if (isExternal(root.href)) {
                    <a class="site-map-card-open" [href]="root.href" target="_blank" rel="noopener noreferrer">Open the {{ root.title }} page</a>
                  } @else {
                    <a class="site-map-card-open" [routerLink]="'/' + root.href" [attr.target]="showPreview ? '_blank' : null" rel="noopener noreferrer">Open the {{ root.title }} page</a>
                  }
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
      </div>
      @if (showPreview) {
        <div class="thumbnail-heading-frame site-map-preview mb-0">
          <div class="thumbnail-heading">On the new site</div>
          @if (focused) {
            <h2 class="h4">{{focused.title}}</h2>
            <p class="mb-2"><code>/{{focused.key}}</code></p>
            @if (focused.detail) { <p>{{focused.detail}}</p> }
            @if (focused.selected === false) {
              <p>This page is not ticked, so it will not be imported.</p>
            } @else {
              <p>The current website supplies the words and pictures. NGX supplies the layout, navbar and styling after you confirm and the review site is built.</p>
            }
            @if (focused.href) {
              <p class="mb-0"><a [href]="focused.href" target="_blank" rel="noopener noreferrer"><fa-icon [icon]="faOpen" class="me-1"/>Check the source words and photos</a></p>
            }
          } @else {
            <p class="mb-0">Click a page title to see how it will sit on the new site.</p>
          }
        </div>
      }
      </div>
    } @else if (filter) {
      <p>No pages match "{{ filter }}".</p>
    } @else if (building) {
      <div class="site-map-building">
        <span class="site-map-spinner"></span>
        <span>Building the site map for the first time. Your sections will appear here automatically when it's ready…</span>
      </div>
    } @else {
      <p>{{ emptyMessage }}</p>
    }
    <ng-template #tree let-nodes>
      @for (node of nodes; track node.key; let index = $index) {
        <li class="site-map-node">
          <div class="site-map-row" [class.site-map-omitted]="selectable && node.selected === false">
            @if (selectable) {
              <label class="site-map-select mb-0"><input type="checkbox" [ngModel]="node.selected" (ngModelChange)="changeSelection(node, $event)" [attr.aria-label]="'Import ' + node.title"/></label>
            }
            @if (node.children.length) {
              <button type="button" class="site-map-toggle" (click)="toggle(node)"
                      [attr.aria-expanded]="isExpanded(node)"
                      [attr.aria-label]="(isExpanded(node) ? 'Collapse ' : 'Expand ') + node.title">
                <fa-icon [icon]="isExpanded(node) ? faChevronDown : faChevronRight" [fixedWidth]="true"/>
              </button>
            } @else {
              <span class="site-map-leaf"></span>
            }
            @if (showPreview) {
              <button type="button" class="site-map-link site-map-link-button" [class.site-map-focused]="focused?.key === node.key" (click)="focus(node)" [innerHTML]="highlight(node.title)"></button>
            } @else if (node.href) {
              @if (isExternal(node.href)) {
                <a class="site-map-link" [href]="node.href" target="_blank" rel="noopener noreferrer" [innerHTML]="highlight(node.title)"></a>
              } @else {
                <a class="site-map-link" [routerLink]="'/' + node.href" [attr.target]="showPreview ? '_blank' : null" rel="noopener noreferrer" [innerHTML]="highlight(node.title)"></a>
              }
            } @else {
              <span class="site-map-label" [innerHTML]="highlight(node.title)"></span>
            }
            @if (node.children.length) {
              <span class="site-map-count">{{ descendantPages(node) }}</span>
            }
            @if (selectable) {
              <span class="site-map-move">
                <button type="button" class="site-map-toggle" tooltip="Move up" [disabled]="index === 0" (click)="move(node, MoveDirection.UP)"><fa-icon [icon]="faArrowUp"/></button>
                <button type="button" class="site-map-toggle" tooltip="Move down" [disabled]="index === nodes.length - 1" (click)="move(node, MoveDirection.DOWN)"><fa-icon [icon]="faArrowDown"/></button>
              </span>
            }
          </div>
          @if (node.children.length && isExpanded(node)) {
            <ul class="site-map-children">
              <ng-container *ngTemplateOutlet="tree; context: {$implicit: node.children}"/>
            </ul>
          }
        </li>
      }
    </ng-template>`
})
export class SiteMapViewComponent {
  private siteSearchService = inject(SiteSearchService);
  faChevronDown = faChevronDown;
  faChevronRight = faChevronRight;
  faMagnifyingGlass = faMagnifyingGlass;
  faXmark = faXmark;
  faFolder = faFolder;
  faArrowUp = faArrowUp;
  faArrowDown = faArrowDown;
  faOpen = faArrowUpRightFromSquare;
  readonly SiteMapViewMode = SiteMapViewMode;
  readonly MoveDirection = SitemapMoveDirection;
  readonly ALL_DEPTH = 99;
  readonly depthOptions = [1, 2, 3];
  viewMode: SiteMapViewMode = SiteMapViewMode.SECTIONS;
  treeDepth = 2;
  filter = "";
  emptyMessage = "No pages to show.";
  private treeRoots: SitemapNode[] = [];
  private filteredRoots: SitemapNode[] = [];
  private expanded = new Set<string>();
  private filterVisible = false;
  private toolbarVisible = false;
  private indexing = false;
  private selectionEnabled = false;
  private previewEnabled = false;
  focused: SitemapNode = null;
  @Output() selectionChange = new EventEmitter<{key: string; selected: boolean}>();
  @Output() moveChange = new EventEmitter<{key: string; direction: SitemapMoveDirection}>();

  @Input() set roots(value: SitemapNode[]) {
    this.treeRoots = value || [];
    this.onFilterChange(this.filter);
    if (this.viewMode === SiteMapViewMode.TREE) {
      this.expandToDepth(this.treeDepth);
    }
    this.restoreFocus();
  }

  get roots(): SitemapNode[] {
    return this.treeRoots;
  }

  @Input() set showFilter(value: boolean) {
    this.filterVisible = coerceBooleanProperty(value);
  }

  get showFilter(): boolean {
    return this.filterVisible;
  }

  @Input() set showToolbar(value: boolean) {
    this.toolbarVisible = coerceBooleanProperty(value);
  }

  get showToolbar(): boolean {
    return this.toolbarVisible;
  }

  @Input() set building(value: boolean) {
    this.indexing = coerceBooleanProperty(value);
  }

  get building(): boolean {
    return this.indexing;
  }

  @Input() set selectable(value: boolean) {
    this.selectionEnabled = coerceBooleanProperty(value);
  }

  get selectable(): boolean {
    return this.selectionEnabled;
  }

  @Input() set showPreview(value: boolean) {
    this.previewEnabled = coerceBooleanProperty(value);
    this.restoreFocus();
  }

  get showPreview(): boolean {
    return this.previewEnabled;
  }

  @Input("viewMode") set viewModeInput(value: SiteMapViewMode) {
    if (value) {
      this.setViewMode(value);
    }
  }

  @Input("treeDepth") set treeDepthInput(value: number) {
    if (value) {
      this.setTreeDepth(value);
    }
  }

  @Input("emptyMessage") set emptyMessageInput(value: string) {
    if (value) {
      this.emptyMessage = value;
    }
  }

  get displayRoots(): SitemapNode[] {
    return this.filter ? this.filteredRoots : this.treeRoots;
  }

  isExternal(href: string): boolean {
    return sitemapHrefIsExternal(href);
  }

  changeSelection(node: SitemapNode, selected: boolean): void {
    this.selectionChange.emit({key: node.key, selected});
  }

  move(node: SitemapNode, direction: SitemapMoveDirection): void {
    this.moveChange.emit({key: node.key, direction});
  }

  focus(node: SitemapNode): void {
    this.focused = node;
  }

  onFilterChange(value: string): void {
    this.filter = value;
    const query = value.trim().toLowerCase();
    this.filteredRoots = query.length > 0 ? this.filterNodes(this.treeRoots, query) : [];
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

  private expandToDepth(depth: number): void {
    this.expanded.clear();
    const walk = (nodes: SitemapNode[], level: number) => nodes.forEach(node => {
      if (level < depth && node.children.length) {
        this.expanded.add(node.key);
        walk(node.children, level + 1);
      }
    });
    walk(this.treeRoots, 0);
  }

  private restoreFocus(): void {
    if (!this.previewEnabled) {
      this.focused = null;
    } else {
      const current = this.focused ? this.nodeByKey(this.treeRoots, this.focused.key) : null;
      this.focus(current || this.treeRoots[0] || null);
    }
  }

  private nodeByKey(nodes: SitemapNode[], key: string): SitemapNode {
    return nodes.reduce((found, node) => found || (node.key === key ? node : this.nodeByKey(node.children, key)), null as SitemapNode);
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
}
