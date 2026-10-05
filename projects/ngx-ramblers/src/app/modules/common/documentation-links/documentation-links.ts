import { DOCUMENT, NgTemplateOutlet } from "@angular/common";
import { PageComponent } from "../../../page/page.component";
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, inject, NgZone, OnDestroy, Renderer2, TemplateRef, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faGear, faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { TooltipConfig, TooltipDirective, TooltipModule } from "ngx-bootstrap/tooltip";
import { ComponentLoaderFactory } from "ngx-bootstrap/component-loader";
import { PositioningService } from "ngx-bootstrap/positioning";
import { NgxLoggerLevel } from "ngx-logger";
import { skip, Subscription } from "rxjs";
import { uniqBy } from "es-toolkit/compat";
import { DocumentationLinksService } from "../../../services/documentation-links.service";
import { DocumentationSite, DOCUMENTATION_SITE_PLACEHOLDER, DOCUMENTATION_SITE_SELECTOR_ID } from "../../../models/documentation-links.model";
import { StoredValue } from "../../../models/ui-actions";
import { EnvironmentInfo } from "../../../models/backup-session.model";
import { documentationLinkTitle, documentationSiteOrigin, documentationWebsitePickerEnabled } from "../../../functions/documentation-links";
import { EnvironmentSelectComponent } from "../selectors/environment-select";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";

@Component({
  selector: "app-documentation-links",
  imports: [EnvironmentSelectComponent, FontAwesomeModule, TooltipModule, NgTemplateOutlet],
  template: `
    <ng-template #websiteAction>
      @if (pickerEnabled && hasLinks && !editingWebsite) {
        <button type="button" class="btn btn-quiet btn-icon flex-shrink-0" [attr.aria-label]="websiteButtonLabel()" [tooltip]="websiteButtonLabel()" (click)="editingWebsite = true"><fa-icon [icon]="faGear"/></button>
      }
    </ng-template>
    @if (pickerEnabled && hasLinks && editingWebsite) {
      <div class="thumbnail-heading-frame thumbnail-heading-frame-compact mt-4 mb-3" [id]="selectorId">
        <div class="thumbnail-heading">Your website</div>
        <p>Search by group name, abbreviation or website address. Your choice is remembered, and feature links then open on that website.</p>
        @if (suggestedName && !selectedName) {
          <p>This website is suggested because you arrived from it. Please check it is the one you want.</p>
        }
        <div class="d-flex align-items-center gap-2">
        <app-environment-select class="flex-grow-1" placeholder="Choose your website..."
                                [items]="items" [selectedName]="selectedName"
                                (selectedNameChange)="select($event)"/>
        @if (selectedName) {
          <button type="button" class="btn btn-quiet btn-icon flex-shrink-0" aria-label="Reset documentation website choice" tooltip="Reset documentation website choice" (click)="select(null)"><fa-icon [icon]="faRotateLeft"/></button>
        }
        </div>
        @if (error) {
          <div class="alert alert-warning d-flex align-items-start mt-2">
            <fa-icon [icon]="faCircleExclamation" class="me-2"/>
            <div><strong class="d-block">Website list unavailable</strong>{{ error }}
              <button type="button" class="btn btn-primary ms-2" (click)="loadSites()">Try again</button>
            </div>
          </div>
        }
      </div>
    } @else if (pickerEnabled && hasLinks && !page) {
      <div class="d-flex justify-content-end mb-1">
        <ng-container [ngTemplateOutlet]="websiteAction"/>
      </div>
    }
    <div #content><ng-content/></div>
    <ng-template #linkTooltipTemplate>
      <span class="documentation-link-tooltip-body"><fa-icon [icon]="faGear"/> {{ documentationLinkTitle(selectedWebsiteLabel()) }}</span>
    </ng-template>
  `
})
export class DocumentationLinksComponent implements AfterViewInit, OnDestroy {
  readonly page = inject(PageComponent, {optional: true});
  private links = inject(DocumentationLinksService);
  private memberResources = inject(MemberResourcesReferenceDataService);
  private document = inject(DOCUMENT);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);
  private changeDetector = inject(ChangeDetectorRef);
  private viewContainerRef = inject(ViewContainerRef);
  private renderer = inject(Renderer2);
  private componentLoaderFactory = inject(ComponentLoaderFactory);
  private tooltipConfig = inject(TooltipConfig);
  private positioning = inject(PositioningService);
  private logger = inject(LoggerFactory).createLogger("DocumentationLinksComponent", NgxLoggerLevel.ERROR);
  @ViewChild("content", {static: true}) content: ElementRef<HTMLElement>;
  @ViewChild("websiteAction", {static: true}) websiteAction: TemplateRef<unknown>;
  @ViewChild("linkTooltipTemplate", {static: true}) linkTooltipTemplate: TemplateRef<unknown>;
  readonly documentationLinkTitle = documentationLinkTitle;
  readonly selectorId = DOCUMENTATION_SITE_SELECTOR_ID;
  readonly faCircleExclamation = faCircleExclamation;
  readonly faGear = faGear;
  readonly faRotateLeft = faRotateLeft;
  items: EnvironmentInfo[] = [];
  selectedName: string | null = this.links.selection.value;
  error: string | null = null;
  hasLinks = false;
  pickerEnabled = documentationWebsitePickerEnabled(this.document.defaultView?.location?.hostname || "", this.memberResources.platformAdminOn());
  suggestedName: string | null = null;
  editingWebsite = false;
  private sites: DocumentationSite[] = [];
  private observer: MutationObserver;
  private loading = false;
  private loaded = false;
  private destroyed = false;
  private subscriptions: Subscription[] = [];
  private linkTooltips = new Map<HTMLAnchorElement, TooltipDirective>();

  ngAfterViewInit(): void {
    this.subscriptions.push(this.links.selection.pipe(skip(1)).subscribe(name => {
      this.selectedName = name;
      this.updateItems();
      this.refreshLinks();
    }));
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      queueMicrotask(() => {
        if (!this.destroyed && params.has(StoredValue.DOCUMENTATION_SITE)) {
          const name = params.get(StoredValue.DOCUMENTATION_SITE);
          if (name !== this.links.selection.value) {
            this.links.select(name);
          }
        }
      });
    }));
    this.subscriptions.push(this.memberResources.platformAdminEnabledChanges().pipe(skip(1)).subscribe(() => {
      this.updatePickerEnabled();
      this.refreshLinks();
    }));
    this.observer = new MutationObserver(() => this.zone.run(() => this.refreshLinks()));
    this.observer.observe(this.content.nativeElement, {childList: true, subtree: true, attributes: true, attributeFilter: ["href"]});
    queueMicrotask(() => this.zone.run(() => {
      if (!this.destroyed) {
        this.updatePickerEnabled();
        this.refreshLinks();
      }
    }));
  }

  async loadSites(): Promise<void> {
    if (!this.loading) {
      this.loading = true;
      this.error = null;
      try {
        const sites = await this.links.sites();
        if (!this.destroyed) {
          this.sites = sites;
          this.suggestedName = sites.find(site => site.url === documentationSiteOrigin(this.document.referrer))?.name || null;
          this.updateItems();
          this.loaded = true;
          this.refreshLinks();
          if (!sites.length) {
            this.error = "No websites are available. Please contact the website administrator.";
          }
        }
      } catch (error) {
        this.logger.error("Unable to load website choices", error);
        this.error = "Please try loading the website list again.";
      } finally {
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  select(name: string | null): void {
    const next = name || null;
    if (next !== this.selectedName) {
      this.suggestedName = null;
      this.links.select(next);
      this.editingWebsite = !next;
    }
  }

  selectedWebsiteLabel(): string {
    const selected = this.items.find(item => item.name === this.selectedName);
    return selected?.displayName || this.sites.find(site => site.name === this.selectedName)?.label || this.selectedName || "";
  }

  websiteButtonLabel(): string {
    return this.selectedName ? `Documentation links open on ${this.selectedWebsiteLabel()}` : "Choose which website documentation links open";
  }

  @HostListener("document:keydown.escape")
  cancelWebsiteSelection(): void {
    if (this.pickerEnabled && this.hasLinks) {
      this.editingWebsite = false;
    }
  }

  private host(): string {
    return this.document.defaultView?.location?.hostname || "";
  }

  private updatePickerEnabled(): void {
    this.pickerEnabled = documentationWebsitePickerEnabled(this.host(), this.memberResources.platformAdminOn());
    if (this.pickerEnabled) {
      this.page?.breadcrumbActions.set(this.websiteAction);
    } else if (this.page?.breadcrumbActions() === this.websiteAction) {
      this.page.breadcrumbActions.set(null);
    }
  }

  private updateItems(): void {
    const preferredSites = [...this.sites.filter(site => site.name === this.selectedName), ...this.sites.filter(site => site.name !== this.selectedName)];
    this.items = uniqBy(preferredSites, site => documentationSiteOrigin(site.url)).map(site => ({name: site.name, displayName: site.label, description: site.url, appName: "", hasMongoConfig: false}));
  }

  private refreshLinks(): void {
    if (this.pickerEnabled) {
      const anchors = Array.from(this.content.nativeElement.querySelectorAll<HTMLAnchorElement>("a[href]"));
      const siteUrl = this.sites.find(site => site.name === this.selectedName)?.url || null;
      const origins = this.sites.map(site => site.url);
      const count = {value: 0};
      anchors.forEach(anchor => {
        const current = anchor.getAttribute("href");
        if (current && !anchor.hasAttribute("data-documentation-original-href")) {
          anchor.setAttribute("data-documentation-original-href", current);
          if (anchor.hasAttribute("title")) {
            anchor.setAttribute("data-documentation-original-title", anchor.getAttribute("title"));
          }
        }
        const original = anchor.getAttribute("data-documentation-original-href");
        const originalTitle = anchor.getAttribute("data-documentation-original-title");
        const path = this.links.destinationPath(original, origins);
        if (path) {
          count.value++;
          const url = siteUrl ? this.links.destinationUrl(original, siteUrl, origins) || this.links.destinationUrl(DOCUMENTATION_SITE_PLACEHOLDER + path, siteUrl) : original;
          if (url && current !== url) {
            anchor.setAttribute("href", url);
          }
          if (siteUrl) {
            this.setLinkTooltip(anchor, documentationLinkTitle(this.selectedWebsiteLabel() || siteUrl));
          } else {
            this.setLinkTooltip(anchor, null);
            if (originalTitle) {
              anchor.setAttribute("title", originalTitle);
            } else {
              anchor.removeAttribute("title");
            }
          }
        }
      });
      Array.from(this.linkTooltips.keys()).filter(anchor => !anchors.includes(anchor) || !anchor.hasAttribute("data-documentation-original-href")).forEach(anchor => this.setLinkTooltip(anchor, null));
      this.hasLinks = count.value > 0;
      if (this.hasLinks && !this.loaded && !this.loading) {
        void this.loadSites();
      }
    } else {
      this.hasLinks = false;
    }
    this.changeDetector.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.page?.breadcrumbActions() === this.websiteAction) {
      this.page.breadcrumbActions.set(null);
    }
    this.observer?.disconnect();
    Array.from(this.linkTooltips.keys()).forEach(anchor => this.setLinkTooltip(anchor, null));
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private setLinkTooltip(anchor: HTMLAnchorElement, text: string | null): void {
    const existing = this.linkTooltips.get(anchor);
    if (text) {
      anchor.removeAttribute("title");
      anchor.setAttribute("data-documentation-tooltip", text);
      if (existing) {
        existing.tooltip = this.linkTooltipTemplate;
      } else {
        const directive = new TooltipDirective(this.viewContainerRef, this.componentLoaderFactory, this.tooltipConfig, new ElementRef(anchor), this.renderer, this.positioning);
        directive.container = "body";
        directive.containerClass = "documentation-link-tooltip";
        directive.placement = "top";
        directive.adaptivePosition = true;
        directive.tooltip = this.linkTooltipTemplate;
        directive.ngOnInit();
        this.linkTooltips.set(anchor, directive);
      }
    } else {
      existing?.ngOnDestroy();
      this.linkTooltips.delete(anchor);
      anchor.removeAttribute("data-documentation-tooltip");
    }
  }
}
