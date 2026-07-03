import { Component, inject, NgZone, OnDestroy, OnInit, Renderer2 } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { DOCUMENT } from "@angular/common";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { faArrowLeft, faDownload, faPrint, faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CommitteeFile } from "../../../models/committee.model";
import { StoredValue } from "../../../models/ui-actions";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { CommitteeDisplayService } from "../committee-display.service";
import { CommitteeReferenceData } from "../../../services/committee/committee-reference-data";
import { CommitteeDocumentView } from "./committee-document-view";
import { PageComponent } from "../../../page/page.component";

const PRINT_MODE_BODY_CLASS = "committee-document-print-mode";

@Component({
  selector: "app-committee-document-page",
  template: `
    <app-page includeLastSegment [pageTitle]="pageTitle()">
      @if (committeeFile && allowViewing) {
        @if (display.isComposedDocument(committeeFile)) {
          <div class="d-flex justify-content-between gap-2 mb-3 d-print-none">
            <button type="button" class="btn btn-secondary btn-sm" (click)="navigateBack()">
              <fa-icon [icon]="faArrowLeft" class="me-1"/>
              Back
            </button>
            <button type="button" class="btn btn-primary btn-sm" (click)="print()">
              <fa-icon [icon]="faPrint" class="me-1"/>
              Print / A4
            </button>
          </div>
          <app-committee-document-view [committeeFile]="committeeFile"/>
        } @else {
          <div class="d-flex justify-content-between gap-2 mb-3">
            <button type="button" class="btn btn-secondary btn-sm" (click)="navigateBack()">
              <fa-icon [icon]="faArrowLeft" class="me-1"/>
              Back
            </button>
            <a class="btn btn-sunset btn-sm" target="_blank" rel="noopener"
               [href]="display.fileUrl(committeeFile)">
              <fa-icon [icon]="faDownload" class="me-1"/>
              Download
            </a>
          </div>
          @if (embedUrl) {
            @if (mobileViewport && display.isOfficeViewable(committeeFile)) {
              <p>This document is best viewed full screen on a phone.</p>
              <a class="btn btn-primary" target="_blank" rel="noopener"
                 [href]="display.directViewUrl(committeeFile)">
                <fa-icon [icon]="faUpRightFromSquare" class="me-1"/>
                View document
              </a>
            } @else {
              <iframe class="committee-document-embed" [src]="embedUrl"
                      [title]="pageTitle()"></iframe>
            }
          } @else {
            <div class="alert alert-warning">
              <strong>Preview not available: </strong>this file type cannot be shown in the browser - use the
              Download button above to open it.
            </div>
          }
        }
      } @else if (notFound) {
        <div class="alert alert-warning">
          <strong>Document not available: </strong>this document does not exist or you do not have access to view it.
        </div>
      }
    </app-page>`,
  imports: [PageComponent, CommitteeDocumentView, FontAwesomeModule]
})
export class CommitteeDocumentPage implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeDocumentPage", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private expectComposed = false;
  private renderer = inject(Renderer2);
  private documentRef = inject(DOCUMENT);
  private sanitizer = inject(DomSanitizer);
  private committeeFileService = inject(CommitteeFileService);
  private memberLoginService = inject(MemberLoginService);
  display = inject(CommitteeDisplayService);
  private subscriptions: Subscription[] = [];
  private committeeReferenceData: CommitteeReferenceData;
  public committeeFile: CommitteeFile;
  public embedUrl: SafeResourceUrl;
  public allowViewing = false;
  public notFound = false;
  private autoPrintTriggered = false;
  protected mobileViewport = false;
  private zone = inject(NgZone);
  private mobileViewportQuery = window.matchMedia("(max-width: 767.98px)");
  private mobileViewportListener = (event: MediaQueryListEvent) => this.zone.run(() => this.mobileViewport = event.matches);
  protected readonly faPrint = faPrint;
  protected readonly faDownload = faDownload;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faUpRightFromSquare = faUpRightFromSquare;

  ngOnInit(): void {
    this.mobileViewport = this.mobileViewportQuery.matches;
    this.mobileViewportQuery.addEventListener("change", this.mobileViewportListener);
    this.renderer.addClass(this.documentRef.body, PRINT_MODE_BODY_CLASS);
    this.subscriptions.push(this.display.configEvents().subscribe(data => {
      this.committeeReferenceData = data;
      this.refreshVisibility();
    }));
    this.subscriptions.push(this.route.queryParamMap.subscribe(queryParamMap => {
      const documentSlug = queryParamMap.get(StoredValue.DOCUMENT);
      const fileSlug = queryParamMap.get(StoredValue.FILE);
      this.expectComposed = !!documentSlug;
      const slug = documentSlug || fileSlug;
      this.logger.info("loading committee file for slug:", slug, "expectComposed:", this.expectComposed);
      if (slug) {
        this.loadCommitteeFile(slug);
      }
    }));
  }

  ngOnDestroy(): void {
    this.mobileViewportQuery.removeEventListener("change", this.mobileViewportListener);
    this.renderer.removeClass(this.documentRef.body, PRINT_MODE_BODY_CLASS);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  pageTitle(): string {
    return this.committeeFile?.document?.title || this.committeeFile?.fileNameData?.title || this.committeeFile?.fileType;
  }

  private loadCommitteeFile(slug: string): void {
    this.committeeFileService.all()
      .then(committeeFiles => {
        const committeeFile = committeeFiles.find(candidate => this.display.isComposedDocument(candidate) === this.expectComposed
          && this.display.committeeFileSlug(candidate) === slug);
        if (committeeFile) {
          this.committeeFile = committeeFile;
          this.notFound = false;
          if (!this.display.isComposedDocument(committeeFile) && this.display.canViewInBrowser(committeeFile)) {
            this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.display.attachmentEmbedUrl(committeeFile));
          }
          this.refreshVisibility();
        } else {
          this.notFound = true;
        }
      })
      .catch(error => {
        this.logger.error("failed to load committee file for slug:", slug, error);
        this.notFound = true;
      });
  }

  private refreshVisibility(): void {
    if (this.committeeFile && this.committeeReferenceData) {
      this.allowViewing = this.committeeReferenceData.isPublic(this.committeeFile.fileType)
        || this.memberLoginService.allowCommittee()
        || this.memberLoginService.allowFileAdmin();
      this.notFound = !this.allowViewing;
      if (this.allowViewing && !this.autoPrintTriggered
        && this.display.isComposedDocument(this.committeeFile)
        && this.route.snapshot.queryParamMap.get(StoredValue.PRINT) === "true") {
        this.autoPrintTriggered = true;
        setTimeout(() => this.print(), 500);
      }
    }
  }

  print(): void {
    window.print();
  }

  navigateBack(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.DOCUMENT]: null, [StoredValue.FILE]: null, print: null},
      queryParamsHandling: "merge"
    });
  }
}
