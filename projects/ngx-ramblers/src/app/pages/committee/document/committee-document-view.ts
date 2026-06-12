import { AfterViewInit, Component, ElementRef, inject, Input, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { fromEvent, Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { MarkdownComponent } from "ngx-markdown";
import { BuiltInRole, CommitteeFile } from "../../../models/committee.model";
import { Image, Organisation, SystemConfig } from "../../../models/system.model";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";

const A4_HEIGHT_TO_WIDTH = 297 / 210;

@Component({
  selector: "app-committee-document-view",
  template: `
    <div class="committee-document-backdrop d-print-none">
      <div class="committee-document-pages" #pagesHost></div>
      <div class="committee-document-measure" #measureHost>
        <div #masterHeader class="committee-document-page-header">
          <div class="committee-document-band"></div>
          <div class="committee-document-header">
            @if (logo?.awsFileName) {
              <img class="committee-document-logo"
                   [src]="urlService.resourceRelativePathForAWSFileName(logo.awsFileName)"
                   [alt]="group?.shortName">
            } @else {
              <div class="committee-document-group-name">{{ group?.longName || group?.shortName }}</div>
            }
          </div>
        </div>
        <div #masterContent>
          @if (!bodyProvidesTitle()) {
            <div class="committee-document-title-block">
              <h1 class="committee-document-title">
                <span>{{ committeeFile?.document?.title || committeeFile?.fileType }}</span>
              </h1>
              @if (committeeFile?.eventDate) {
                <div class="committee-document-date">{{ formattedEventDate() }}</div>
              }
            </div>
          }
          <div class="committee-document-body">
            <markdown [data]="renderableMarkdown()" (ready)="onMarkdownReady()"/>
          </div>
        </div>
        <div #masterFooter>
          <div class="committee-document-footer">
            <div class="committee-document-footer-row">
              <div>
                <div class="committee-document-footer-group">{{ group?.longName || group?.shortName }}</div>
                <div class="committee-document-footer-contact">
                  @if (contactEmail) {
                    <a [href]="'mailto:' + contactEmail">{{ contactEmail }}</a>
                  }
                  @if (contactEmail && group?.href) {
                    <span class="committee-document-footer-separator">|</span>
                  }
                  @if (group?.href) {
                    <a [href]="group.href" target="_blank" rel="noopener">{{ displayHref() }}</a>
                  }
                </div>
                <div class="committee-document-footer-charity">
                  The Ramblers' Association is a registered charity (England &amp; Wales no 1093577, Scotland
                  no SC039799) and a company limited by guarantee, registered in England &amp; Wales (no 4458492).
                  Registered office: The Ramblers, c/o Bates Wells, 10 Queen St Place, London EC4R 1BE.
                </div>
              </div>
              <img class="committee-document-footer-regulator"
                   src="/assets/images/local/fr-regulator-colour.svg"
                   alt="Registered with Fundraising Regulator">
            </div>
          </div>
        </div>
      </div>
    </div>
    <table class="committee-document-shell d-none d-print-table">
      <thead>
        <tr>
          <td class="committee-document-page-header">
            <div class="committee-document-band"></div>
            <div class="committee-document-header">
              @if (logo?.awsFileName) {
                <img class="committee-document-logo"
                     [src]="urlService.resourceRelativePathForAWSFileName(logo.awsFileName)"
                     [alt]="group?.shortName">
              } @else {
                <div class="committee-document-group-name">{{ group?.longName || group?.shortName }}</div>
              }
            </div>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="committee-document-content">
            @if (!bodyProvidesTitle()) {
              <div class="committee-document-title-block">
                <h1 class="committee-document-title">
                  <span>{{ committeeFile?.document?.title || committeeFile?.fileType }}</span>
                </h1>
                @if (committeeFile?.eventDate) {
                  <div class="committee-document-date">{{ formattedEventDate() }}</div>
                }
              </div>
            }
            <div class="committee-document-body" #printBody>
              <markdown [data]="renderableMarkdown()" (ready)="onPrintMarkdownReady()"/>
            </div>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td class="committee-document-footer">
            <div class="committee-document-footer-row">
              <div>
                <div class="committee-document-footer-group">{{ group?.longName || group?.shortName }}</div>
                <div class="committee-document-footer-contact">
                  @if (contactEmail) {
                    <a [href]="'mailto:' + contactEmail">{{ contactEmail }}</a>
                  }
                  @if (contactEmail && group?.href) {
                    <span class="committee-document-footer-separator">|</span>
                  }
                  @if (group?.href) {
                    <a [href]="group.href" target="_blank" rel="noopener">{{ displayHref() }}</a>
                  }
                </div>
                <div class="committee-document-footer-charity">
                  The Ramblers' Association is a registered charity (England &amp; Wales no 1093577, Scotland
                  no SC039799) and a company limited by guarantee, registered in England &amp; Wales (no 4458492).
                  Registered office: The Ramblers, c/o Bates Wells, 10 Queen St Place, London EC4R 1BE.
                </div>
              </div>
              <img class="committee-document-footer-regulator"
                   src="/assets/images/local/fr-regulator-colour.svg"
                   alt="Registered with Fundraising Regulator">
            </div>
          </td>
        </tr>
      </tfoot>
    </table>`,
  imports: [MarkdownComponent]
})
export class CommitteeDocumentView implements OnInit, AfterViewInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeDocumentView", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private committeeConfigService = inject(CommitteeConfigService);
  private zone = inject(NgZone);
  protected dateUtils = inject(DateUtilsService);
  urlService = inject(UrlService);
  private subscriptions: Subscription[] = [];
  private contentBlocks: HTMLElement[] = [];
  private paginationTimer: ReturnType<typeof setTimeout>;
  private viewReady = false;
  public group: Organisation;
  public logo: Image;
  public contactEmail: string;

  @Input() committeeFile: CommitteeFile;
  @ViewChild("pagesHost") pagesHost: ElementRef<HTMLDivElement>;
  @ViewChild("measureHost") measureHost: ElementRef<HTMLDivElement>;
  @ViewChild("masterHeader") masterHeader: ElementRef<HTMLDivElement>;
  @ViewChild("masterContent") masterContent: ElementRef<HTMLDivElement>;
  @ViewChild("masterFooter") masterFooter: ElementRef<HTMLDivElement>;
  @ViewChild("printBody") printBody: ElementRef<HTMLDivElement>;

  ngOnInit(): void {
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
      this.group = systemConfig?.group;
      this.logo = systemConfig?.logos?.images?.find(logo => logo.originalFileName === systemConfig?.header?.selectedLogo);
      this.schedulePagination();
    }));
    this.subscriptions.push(this.committeeConfigService.committeeReferenceDataEvents().subscribe(committeeReferenceData => {
      this.contactEmail = committeeReferenceData?.contactUsFieldForBuiltInRole(BuiltInRole.CONTACT_US, "email");
      this.schedulePagination();
    }));
    this.zone.runOutsideAngular(() => {
      this.subscriptions.push(fromEvent(window, "resize").pipe(debounceTime(300)).subscribe(() => this.schedulePagination()));
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.schedulePagination();
  }

  ngOnDestroy(): void {
    clearTimeout(this.paginationTimer);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  renderableMarkdown(): string {
    return (this.committeeFile?.document?.markdown || "").replace(/^[ \t]*PAGEBREAK[ \t]*$/gmi, "\n<div class=\"committee-document-page-break\"></div>\n");
  }

  bodyProvidesTitle(): boolean {
    return /^#{1,2}\s/.test((this.committeeFile?.document?.markdown || "").trimStart());
  }

  formattedEventDate(): string {
    return this.dateUtils.asString(this.committeeFile?.eventDate, undefined, this.dateUtils.formats.displayDateTh);
  }

  displayHref(): string {
    return (this.group?.href || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  onMarkdownReady(): void {
    this.contentBlocks = [];
    if (this.pagesHost?.nativeElement) {
      this.pagesHost.nativeElement.innerHTML = "";
    }
    this.schedulePagination();
  }

  onPrintMarkdownReady(): void {
    if (this.printBody?.nativeElement) {
      this.fitTables(this.printBody.nativeElement);
      this.decorateHeadings(this.printBody.nativeElement);
    }
  }

  private decorateHeadings(host: HTMLElement): void {
    Array.from(host.querySelectorAll("h1, h2")).forEach(heading => {
      if (!heading.querySelector(".committee-document-highlight")) {
        const span = heading.ownerDocument.createElement("span");
        span.className = "committee-document-highlight";
        span.append(...Array.from(heading.childNodes));
        heading.appendChild(span);
      }
    });
  }

  private fitTables(host: HTMLElement): void {
    Array.from(host.querySelectorAll("table")).forEach(table => {
      const rows = Array.from(table.querySelectorAll("tr"));
      const columnCount = Math.max(...rows.map(row => row.children.length), 0);
      if (columnCount < 2 || rows.length < 2) {
        return;
      }
      const weights = Array.from({length: columnCount}, (ignored, columnIndex) =>
        rows.reduce((sum, row) => sum + ((row.children[columnIndex]?.textContent || "").trim().length), 0));
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      if (total === 0) {
        return;
      }
      const shares = weights.map(weight => weight / total);
      table.querySelector("colgroup")?.remove();
      if (shares.some(share => share >= 0.35)) {
        const colgroup = table.ownerDocument.createElement("colgroup");
        shares.forEach(share => {
          const col = table.ownerDocument.createElement("col");
          if (share >= 0.35) {
            col.style.width = `${Math.min(Math.round(share * 100), 65)}%`;
          }
          colgroup.appendChild(col);
        });
        table.insertBefore(colgroup, table.firstChild);
        table.style.width = "100%";
      }
    });
  }

  schedulePagination(): void {
    if (this.viewReady) {
      clearTimeout(this.paginationTimer);
      this.paginationTimer = setTimeout(() => this.paginate(), 80);
    }
  }

  private collectBlocks(): void {
    const content = this.masterContent.nativeElement;
    this.fitTables(content);
    this.decorateHeadings(content);
    const markdownHost = content.querySelector("markdown");
    this.contentBlocks.forEach(block => {
      if (block.classList.contains("committee-document-title-block")) {
        content.insertBefore(block, content.firstChild);
      } else {
        markdownHost?.appendChild(block);
      }
    });
    const titleBlock = content.querySelector(".committee-document-title-block");
    const markdownBlocks = markdownHost ? Array.from(markdownHost.children) as HTMLElement[] : [];
    this.contentBlocks = [...(titleBlock ? [titleBlock as HTMLElement] : []), ...markdownBlocks];
  }

  private blockCost(block: HTMLElement): number {
    const style = window.getComputedStyle(block);
    return block.offsetHeight + parseFloat(style.marginTop || "0") + parseFloat(style.marginBottom || "0");
  }

  private paginate(): void {
    const host = this.pagesHost?.nativeElement;
    if (!host || !this.masterContent?.nativeElement || !this.committeeFile?.document) {
      return;
    }
    this.collectBlocks();
    const sheetWidth = host.clientWidth;
    if (sheetWidth === 0 || this.contentBlocks.length === 0) {
      return;
    }
    const continuousLayout = window.matchMedia("(max-width: 767.98px)").matches;
    const pageHeight = Math.round(sheetWidth * A4_HEIGHT_TO_WIDTH);
    const headerHeight = this.masterHeader.nativeElement.offsetHeight;
    const footerHeight = this.masterFooter.nativeElement.offsetHeight;
    const breathingSpace = Math.round(sheetWidth * 0.05);
    const contentCapacity = pageHeight - headerHeight - footerHeight - breathingSpace;
    const distribution = continuousLayout
      ? {pages: [this.contentBlocks.filter(block => !block.classList?.contains("committee-document-page-break"))], used: 0}
      : this.contentBlocks.reduce((accumulated: { pages: HTMLElement[][]; used: number }, block) => {
        const current = accumulated.pages[accumulated.pages.length - 1];
        if (block.classList?.contains("committee-document-page-break")) {
          if (current.length > 0) {
            accumulated.pages.push([]);
            accumulated.used = 0;
          }
        } else {
          const cost = this.blockCost(block);
          if (current.length > 0 && accumulated.used + cost > contentCapacity) {
            accumulated.pages.push([block]);
            accumulated.used = cost;
          } else {
            current.push(block);
            accumulated.used += cost;
          }
        }
        return accumulated;
      }, {pages: [[]], used: 0});
    if (distribution.pages[distribution.pages.length - 1].length === 0) {
      distribution.pages.pop();
    }
    host.innerHTML = "";
    distribution.pages.forEach(blocks => {
      const sheet = document.createElement("div");
      sheet.className = "committee-document-sheet";
      if (!continuousLayout) {
        sheet.style.minHeight = `${pageHeight}px`;
      }
      sheet.appendChild(this.masterHeader.nativeElement.cloneNode(true));
      const body = document.createElement("div");
      body.className = "committee-document-body committee-document-page-body";
      blocks.forEach(block => body.appendChild(block));
      sheet.appendChild(body);
      const footer = this.masterFooter.nativeElement.cloneNode(true) as HTMLElement;
      footer.classList.add("committee-document-sheet-footer");
      sheet.appendChild(footer);
      host.appendChild(sheet);
    });
    this.logger.info("paginated into", distribution.pages.length, "pages with content capacity", contentCapacity);
  }
}
