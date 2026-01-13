import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren
} from "@angular/core";
import { faAdd, faArrowUpRightFromSquare, faClose, faCompress, faCopy, faExpand, faPaste, faPlay, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { MigrationConfig, ParentPageConfig, ParentPageMode, SiteMigrationConfig } from "../../../../models/migration-config.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { MigrationConfigService } from "../../../../services/migration/migration-config.service";
import { Subscription } from "rxjs";
import { PageComponent } from "../../../../page/page.component";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import {
  NgLabelTemplateDirective,
  NgOptionComponent,
  NgOptionTemplateDirective,
  NgSelectComponent
} from "@ng-select/ng-select";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { ActivatedRoute, Router } from "@angular/router";
import { WebSocketClientService } from "../../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../../models/websocket.model";
import { DisplayTimeWithSecondsPipe } from "../../../../pipes/display-time.pipe-with-seconds";
import { StatusIconComponent } from "../../status-icon";
import { isNull } from "es-toolkit/compat";
import { sortBy } from "../../../../functions/arrays";
import { MarkdownComponent } from "ngx-markdown";
import { PageTransformationEditor } from "./page-transformation-editor";
import { cloneDeep } from "es-toolkit/compat";
import { MigrationHistory } from "../../../../models/migration-history.model";
import { MigrationHistoryService } from "../../../../services/migration/migration-history.service";
import { ContentTemplateType, EM_DASH_WITH_SPACES, PageContent } from "../../../../models/content-text.model";
import { faClone } from "@fortawesome/free-solid-svg-icons/faClone";
import { ClipboardService } from "../../../../services/clipboard.service";
import { UiActionsService } from "../../../../services/ui-actions.service";
import { StoredValue } from "../../../../models/ui-actions";
import { PageContentService } from "../../../../services/page-content.service";

type SitePasteState = { active: boolean; value: string; error?: string };

@Component({
  selector: "app-migration-settings",
  template: `
    <app-page autoTitle>
      <tabset class="custom-tabset">
        <tab [active]="activeTabId === MigrationTab.SETTINGS" (selectTab)="selectTab(MigrationTab.SETTINGS)"
             heading="Settings">
          <div class="row">
            <div class="col-sm-12">
              @if (migrationConfig) {
                <div class="img-thumbnail thumbnail-admin-edit">
                  <ng-template #migrationBtn let-site="site">
                    <app-badge-button [icon]="faPlay" (click)="runMigration(site)" [disabled]="!site.enabled"
                                      caption="Run {{site.name}} Migration"/>
                  </ng-template>
                  <div class="col-sm-12 mt-2 mb-2">
                    <app-markdown-editor category="admin" name="migration-settings-help"
                                         standalone
                                         description="Migration settings help"></app-markdown-editor>
                  </div>
                  <div class="col-sm-12">
                    <app-badge-button [icon]="faAdd" (click)="addSite()" caption="Add new site"/>
                  </div>
                  <div class="col-sm-12 mt-3">
                    @for (site of migrationConfig.sites; track site.name; let siteIndex = $index) {
                      <div class="row thumbnail-heading-frame-compact">
                        <div class="thumbnail-heading">
                          <div>Site Configuration ({{ migrationConfig.sites.indexOf(site) + 1 }}
                            of {{ migrationConfig.sites?.length || 0 }}${EM_DASH_WITH_SPACES}{{ site.name }})
                          </div>
                          <app-badge-button noRightMargin [icon]="site.expanded? faCompress : faExpand"
                                            (click)="toggleExpandForSite(site)"
                                            delay=500
                                            [tooltip]="site.expanded?'Collapse site configuration':'Expand site configuration'"/>
                          <app-badge-button noRightMargin [icon]="faClose" (click)="deleteSite(site)" delay=500
                                            tooltip="Delete site configuration"/>
                          <app-badge-button noRightMargin [icon]="faClone" (click)="duplicateSite(site)" delay=500
                                            tooltip="Duplicate this site configuration"/>
                          <app-badge-button noRightMargin [icon]="faPaste" (click)="activateSitePaste(site)" delay=500
                                            tooltip="Paste site configuration from clipboard"/>
                          <app-badge-button noRightMargin [icon]="faCopy" (click)="copySiteConfig(site)" delay=500
                                            tooltip="Copy site configuration to clipboard"/>
                        </div>
                        @if (site.expanded) {
                          <div class="row">
                            <div class="col-sm-12">
                              <ng-container [ngTemplateOutlet]="migrationBtn" [ngTemplateOutletContext]="{site: site}"/>
                            </div>
                          </div>
                          @if (sitePasteActive(site)) {
                            <div class="row">
                              <div class="col-sm-12">
                                <div class="form-group">
                                  <label [for]="stringUtils.kebabCase('site-config-paste', siteIndex)">Paste Site
                                    Configuration JSON</label>
                                  <textarea rows="8" class="form-control"
                                            [id]="stringUtils.kebabCase('site-config-paste', siteIndex)"
                                            placeholder="Paste full SiteMigrationConfig JSON here"
                                            [ngModel]="sitePasteValue(site)"
                                            (ngModelChange)="transformSitePaste(site, $event)"></textarea>
                                  @if (sitePasteError(site)) {
                                    <div class="text-danger mt-1">{{ sitePasteError(site) }}</div>
                                  }
                                  <div class="mt-2">
                                    <button type="button" class="btn btn-sm btn-outline-secondary"
                                            (click)="cancelSitePaste(site)">Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          }
                          <div class="row">
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('site-name', siteIndex)">Site Name</label>
                                <input [id]="stringUtils.kebabCase('site-name', siteIndex)" type="text"
                                       class="form-control input-sm" placeholder="Enter site name"
                                       [(ngModel)]="site.name">
                              </div>
                            </div>
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('site-identifier', siteIndex)">Site
                                  Identifier</label>
                                <input [id]="stringUtils.kebabCase('site-identifier', siteIndex)" type="text"
                                       class="form-control input-sm" placeholder="Enter site identifier"
                                       [(ngModel)]="site.siteIdentifier">
                              </div>
                            </div>
                          </div>
                          <div class="row">
                            <div class="col-sm-12">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('base-url', siteIndex)">Base URL</label>
                                <input [id]="stringUtils.kebabCase('base-url', siteIndex)" type="text"
                                       class="form-control input-sm"
                                       placeholder="Enter base URL (e.g., https://www.example.com)"
                                       [(ngModel)]="site.baseUrl">
                              </div>
                            </div>
                          </div>
                          <div class="row">
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('menu-selector', siteIndex)">Menu Selector</label>
                                <input [id]="stringUtils.kebabCase('menu-selector', siteIndex)" type="text"
                                       class="form-control input-sm"
                                       placeholder="CSS selector for menu (e.g., .BMenu a)"
                                       [(ngModel)]="site.menuSelector">
                              </div>
                            </div>
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('content-selector', siteIndex)">
                                  Content Selector</label>
                                <input [id]="stringUtils.kebabCase('content-selector', siteIndex)" type="text"
                                       class="form-control input-sm"
                                       placeholder="CSS selector for content (e.g., table[width='1015px'] td)"
                                       [(ngModel)]="site.contentSelector">
                              </div>
                            </div>
                          </div>
                          <div class="row">
                            <div class="col-sm-12">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('gallery-path', siteIndex)">
                                  Gallery Path</label>
                                <input [id]="stringUtils.kebabCase('gallery-path', siteIndex)" type="text"
                                       class="form-control input-sm" placeholder="Path to gallery index (optional)"
                                       [(ngModel)]="site.galleryPath">
                              </div>
                            </div>
                          </div>
                          <div class="row">
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('exclude-selectors', siteIndex)">
                                  Exclude Selectors (optional)</label>
                                <textarea rows="3" class="form-control"
                                          [id]="stringUtils.kebabCase('exclude-selectors', siteIndex)"
                                          placeholder="Comma or newline separated CSS selectors"
                                          [(ngModel)]="site.excludeSelectors"></textarea>
                              </div>
                            </div>
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('exclude-patterns', siteIndex)">
                                  Exclude Text Patterns (regex)</label>
                                <textarea rows="3" class="form-control"
                                          [id]="stringUtils.kebabCase('exclude-patterns', siteIndex)"
                                          placeholder="One regex per line; matched blocks are removed from content"
                                          [(ngModel)]="site.excludeTextPatterns"></textarea>
                              </div>
                            </div>
                          </div>
                          <div class="row mb-2 align-items-center">
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('exclude-markdown-blocks', siteIndex)">
                                  Exclude Markdown Blocks</label>
                                <textarea rows="6" class="form-control"
                                          [id]="stringUtils.kebabCase('exclude-markdown-blocks', siteIndex)"
                                          placeholder="Paste exact markdown blocks from output to remove. Separate multiple blocks with a line containing three dashes (---)."
                                          [(ngModel)]="site.excludeMarkdownBlocks"></textarea>
                              </div>
                            </div>
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('exclude-image-urls', siteIndex)">
                                  Exclude Image URLs</label>
                                <textarea rows="4" class="form-control"
                                          [id]="stringUtils.kebabCase('exclude-image-urls', siteIndex)"
                                          placeholder="One URL per line; excluded images will not be used for action buttons"
                                          [(ngModel)]="site.excludeImageUrls"></textarea>
                              </div>
                            </div>
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('migration-template', siteIndex)">
                                  Migration Template</label>
                                <ng-select
                                  class="w-100"
                                  [id]="stringUtils.kebabCase('migration-template', siteIndex)"
                                  [items]="migrationTemplates"
                                  bindLabel="path"
                                  bindValue="id"
                                  [loading]="migrationTemplatesLoading"
                                  [clearable]="true"
                                  placeholder="Select migration template"
                                  [(ngModel)]="site.templateFragmentId">
                                  <ng-template ng-label-tmp let-item="item">
                                    {{ item?.path }}
                                  </ng-template>
                                  <ng-template ng-option-tmp let-item="item">
                                    <div>{{ item?.path }}</div>
                                  </ng-template>
                                </ng-select>
                              </div>
                            </div>
                            <div class="col-sm-6">
                              @if (site.templateFragmentId) {
                                <div class="d-flex gap-3 flex-wrap align-items-center mt-2">
                                  <a class="rams-text-decoration-pink fw-semibold"
                                     [href]="templateHref(site.templateFragmentId) || null"
                                     target="_blank" rel="noreferrer">
                                    {{ migrationTemplateLabelById(site.templateFragmentId) }}
                                  </a>
                                  <app-badge-button [icon]="faArrowUpRightFromSquare"
                                                    caption="Edit template"
                                                    (click)="openTemplate(site.templateFragmentId)"/>
                                </div>
                              }
                            </div>
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('gallery-selector', siteIndex)">
                                  Gallery Selector</label>
                                <input [id]="stringUtils.kebabCase('gallery-selector', siteIndex)" type="text"
                                       class="form-control input-sm"
                                       placeholder="CSS selector for gallery links (optional)"
                                       [(ngModel)]="site.gallerySelector">
                              </div>
                            </div>
                            <div class="col-sm-6">
                              <div class="form-group">
                                <label [for]="stringUtils.kebabCase('gallery-image-path', siteIndex)">
                                  Gallery Image Path</label>
                                <input [id]="stringUtils.kebabCase('gallery-image-path', siteIndex)" type="text"
                                       class="form-control input-sm"
                                       placeholder="Path segment for gallery images (optional)"
                                       [(ngModel)]="site.galleryImagePath">
                              </div>
                            </div>
                          </div>
                          <div class="thumbnail-heading-frame-compact">
                            <div class="thumbnail-heading">Specific Albums
                              <app-badge-button [icon]="faAdd" (click)="addSpecificAlbum(site)"
                                                delay=500 tooltip="Add specific album"/>
                            </div>
                            @if (site.specificAlbums?.length) {
                              @for (album of site.specificAlbums; track album.path; let albumIndex = $index) {
                                <div class="thumbnail-heading-frame-compact">
                                  <div class="thumbnail-heading">Album {{ albumIndex + 1 }}
                                    <app-badge-button (click)="deleteSpecificAlbum(site, album)"
                                                      delay=500 tooltip="Delete specific album" [icon]="faClose"/>
                                  </div>
                                  <div class="row p-3">
                                    <div class="col-sm-6">
                                      <div class="form-group">
                                        <label
                                          [for]="stringUtils.kebabCase('album-path', siteIndex, albumIndex)">Album
                                          URL</label>
                                        <input [id]="stringUtils.kebabCase('album-path', siteIndex, albumIndex)"
                                               type="text" class="form-control"
                                               placeholder="Full URL to album" [(ngModel)]="album.path">
                                      </div>
                                    </div>
                                    <div class="col-sm-6">
                                      <div class="form-group">
                                        <label
                                          [for]="stringUtils.kebabCase('album-title', siteIndex, albumIndex)">Album
                                          Title</label>
                                        <input
                                          [id]="stringUtils.kebabCase('album-title', siteIndex, albumIndex)"
                                          type="text" class="form-control"
                                          placeholder="Title to use for album" [(ngModel)]="album.title">
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              }
                            }
                          </div>
                          <div class="thumbnail-heading-frame-compact">
                            <div class="thumbnail-heading">Parent Pages
                              <app-badge-button (click)="addParentPage(site)" delay=500
                                                tooltip="Add parent page" [icon]="faAdd"/>
                            </div>
                            @if (site.parentPages?.length) {
                              @for (parentPage of site.parentPages; track parentPage.url; let parentIndex = $index) {
                                <div class="thumbnail-heading-frame-compact">
                                  <div class="thumbnail-heading">Parent Page {{ parentIndex + 1 }}
                                    <app-badge-button (click)="deleteParentPage(site, parentPage)" delay=500
                                                      tooltip="Delete parent page" [icon]="faClose"/>
                                  </div>
                                  <div class="row p-3">
                                    <div class="col-sm-6">
                                      <div class="form-group">
                                        <label [for]="stringUtils.kebabCase('parent-url', siteIndex, parentIndex)">
                                          Parent Page URL</label>
                                        <input [id]="stringUtils.kebabCase('parent-url', siteIndex, parentIndex)"
                                               type="text" class="form-control"
                                               placeholder="e.g., KentWalks/index.htm" [(ngModel)]="parentPage.url">
                                      </div>
                                    </div>
                                    <div class="col-sm-6">
                                      <div class="form-group">
                                        <label [for]="stringUtils.kebabCase('path-prefix', siteIndex, parentIndex)">
                                          Path Prefix</label>
                                        <input [id]="stringUtils.kebabCase('path-prefix', siteIndex, parentIndex)"
                                               type="text" class="form-control"
                                               placeholder="e.g., kent-walks" [(ngModel)]="parentPage.pathPrefix">
                                      </div>
                                    </div>
                                  </div>
                                  <div class="row p-3">
                                    <div class="col-sm-6">
                                      <div class="form-group">
                                        <label
                                          [for]="stringUtils.kebabCase('link-selector', siteIndex, parentIndex)">
                                          Link Selector (optional)</label>
                                        <input [id]="stringUtils.kebabCase('link-selector', siteIndex, parentIndex)"
                                               type="text" class="form-control"
                                               placeholder="Leave empty to use content area"
                                               [(ngModel)]="parentPage.linkSelector">
                                      </div>
                                    </div>
                                    <div class="col-sm-6">
                                      <div class="form-group">
                                        <label
                                          [for]="stringUtils.kebabCase('migrate-parent-mode', siteIndex, parentIndex)">
                                          Migrate parent page</label>
                                          <select class="form-select form-select-sm"
                                                [id]="stringUtils.kebabCase('migrate-parent-mode', siteIndex, parentIndex)"
                                                [(ngModel)]="parentPage.parentPageMode">
                                          <option [ngValue]="null">Not migrated</option>
                                          <option [ngValue]="ParentPageMode.AS_IS">As-is</option>
                                          <option [ngValue]="ParentPageMode.ACTION_BUTTONS">With Links as Action Buttons Row
                                          </option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                  <div class="row p-3">
                                    <div class="col-sm-6">
                                      <div class="form-group">
                                        <label [for]="stringUtils.kebabCase('max-children', siteIndex, parentIndex)">
                                          Max child pages (optional)</label>
                                        <input [id]="stringUtils.kebabCase('max-children', siteIndex, parentIndex)"
                                               type="number" min="0" class="form-control"
                                               placeholder="e.g., 5" [(ngModel)]="parentPage.maxChildren">
                                      </div>
                                    </div>
                                    <div class="col-sm-6">
                                      <div class="form-group">
                                        <label
                                          [for]="stringUtils.kebabCase('parent-template', siteIndex, parentIndex)">
                                          Override Template (optional)</label>
                                        <ng-select
                                          class="w-100"
                                          [id]="stringUtils.kebabCase('parent-template', siteIndex, parentIndex)"
                                          [items]="migrationTemplates"
                                          bindLabel="path"
                                          bindValue="id"
                                          [loading]="migrationTemplatesLoading"
                                          [clearable]="true"
                                          placeholder="Use site template"
                                          [(ngModel)]="parentPage.templateFragmentId">
                                          <ng-template ng-option-tmp let-item="item">
                                            <div>{{ item?.path }}</div>
                                          </ng-template>
                                        </ng-select>
                                        <div class="d-flex gap-3 flex-wrap align-items-center mt-2">
                                          @if (parentPage.templateFragmentId) {
                                            <a class="rams-text-decoration-pink fw-semibold"
                                               [attr.href]="templateHref(parentPage.templateFragmentId) || null"
                                               target="_blank" rel="noreferrer">
                                              {{ migrationTemplateLabelById(parentPage.templateFragmentId) }}
                                            </a>
                                            <app-badge-button
                                              [icon]="faArrowUpRightFromSquare"
                                              caption="Edit template"
                                              (click)="openTemplate(parentPage.templateFragmentId)"/>
                                          } @else {
                                            <span
                                              class="small text-muted align-self-center">{{ parentTemplateSummary(site, parentPage) }}</span>
                                          }
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div class="row p-3">
                                    <div class="col-sm-12">
                                      <details #transformationDetails>
                                        <summary class="fw-semibold mb-2 pointer">
                                          Page Transformation Configuration (optional)
                                        </summary>
                                        <app-page-transformation-editor [(config)]="parentPage.pageTransformation"/>
                                      </details>
                                    </div>
                                  </div>
                                </div>
                              }
                            }
                          </div>
                          <div class="row p-3">
                            <div class="col-sm-3">
                              <div class="form-group">
                                <div class="form-check">
                                  <input [(ngModel)]="site.useNestedRows" type="checkbox" class="form-check-input"
                                         [id]="stringUtils.kebabCase('use-nested-rows', siteIndex)">
                                  <label class="form-check-label"
                                         [for]="stringUtils.kebabCase('use-nested-rows', siteIndex)" delay=500
                                         tooltip="When checked: keeps all content in one row with nested sub-rows. When unchecked: splits markdown into separate rows">
                                    Keep Content Together (Nested Rows)</label>
                                </div>
                              </div>
                            </div>
                            <div class="col-sm-3">
                              <div class="form-group">
                                <div class="form-check">
                                  <input [(ngModel)]="site.persistData" type="checkbox" class="form-check-input"
                                         [id]="stringUtils.kebabCase('persist-data', siteIndex)">
                                  <label class="form-check-label"
                                         [for]="stringUtils.kebabCase('persist-data', siteIndex)">
                                    Save to Database</label>
                                </div>
                              </div>
                            </div>
                            <div class="col-sm-3">
                              <div class="form-group">
                                <div class="form-check">
                                  <input [(ngModel)]="site.uploadTos3" type="checkbox" class="form-check-input"
                                         [id]="stringUtils.kebabCase('upload-to-s3', siteIndex)">
                                  <label class="form-check-label"
                                         [for]="stringUtils.kebabCase('upload-to-s3', siteIndex)">
                                    Upload Images to S3</label>
                                </div>
                              </div>
                            </div>
                            <div class="col-sm-3">
                              <div class="form-group">
                                <div class="form-check">
                                  <input [(ngModel)]="site.enabled" type="checkbox" class="form-check-input"
                                         [id]="stringUtils.kebabCase('enabled', siteIndex)">
                                  <label class="form-check-label" [for]="stringUtils.kebabCase('enabled', siteIndex)">
                                    Enabled</label>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="row">
                            <div class="col-sm-12">
                              <ng-container [ngTemplateOutlet]="migrationBtn"
                                            [ngTemplateOutletContext]="{site: site}"/>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
              <div class="row">
                <div class="col-sm-12">
                  <input type="submit" value="Save settings and exit" (click)="saveAndExit()"
                         [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'"
                         [disabled]="notReady()">
                  <input type="submit" value="Save" (click)="save()"
                         [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'"
                         [disabled]="notReady()">
                  <input type="submit" value="Undo Changes" (click)="undoChanges()"
                         [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'"
                         [disabled]="notReady()">
                  <input type="submit" value="Exit Without Saving" (click)="cancel()"
                         [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'"
                         [disabled]="notReady()">
                </div>
              </div>
            </div>
          </div>
        </tab>
        <tab [active]="activeTabId === MigrationTab.ACTIVITY" (selectTab)="selectTab(MigrationTab.ACTIVITY)"
             heading="Activity">
          <div class="img-thumbnail thumbnail-admin-edit">
            @if (activityTarget.showAlert) {
              <div class="row p-3">
                <div class="col-sm-12">
                  <div class="alert {{activityTarget.alert.class}}">
                    <fa-icon [icon]="activityTarget.alert.icon"></fa-icon>
                    @if (activityTarget.alertTitle) {
                      <strong class="ms-2">{{ activityTarget.alertTitle }}: </strong>
                    } {{ activityTarget.alertMessage }}
                  </div>
                </div>
              </div>
            }
            <div class="row p-3">
              <div class="col-sm-12">
                <div class="d-none d-md-block">
                  <div class="row g-2 align-items-center mb-2">
                    <div class="col-12 col-md-auto">
                      <label class="form-label mb-0">History:</label>
                    </div>
                    <div class="col" style="min-width: 0;">
                      @if (showHistorySelect) {
                        <ng-select [clearable]="true"
                                   bindLabel="createdDate"
                                   [searchable]="false"
                                   [(ngModel)]="selectedHistory"
                                   (ngModelChange)="onHistoryChange()"
                                   dropdownPosition="bottom">
                          <ng-template ng-label-tmp let-h="item">
                            <div class="d-flex align-items-center">
                              <app-status-icon noLabel [status]="h.status || 'info'"/>
                              <span class="ms-2 text-truncate">{{ h.createdDate | displayTimeWithSeconds }}
                                — {{ decode(h.siteIdentifier || h.siteName) }}</span>
                            </div>
                          </ng-template>
                          @for (h of migrationHistories; track h.id) {
                            <ng-option [value]="h">
                              <div class="d-flex align-items-center">
                                <app-status-icon noLabel [status]="h.status || 'info'"/>
                                <span class="ms-2 text-truncate">{{ h.createdDate | displayTimeWithSeconds }}
                                  — {{ decode(h.siteIdentifier || h.siteName) }}</span>
                              </div>
                            </ng-option>
                          }
                        </ng-select>
                      } @else {
                        <div class="d-flex align-items-center">
                          <app-status-icon noLabel [status]="'info'"/>
                          <span class="ms-2">Finding history...</span>
                        </div>
                      }
                    </div>
                    @if (selectedHistory) {
                      <div class="col-auto">
                        <button type="button" class="btn btn-sm btn-secondary" (click)="clearHistorySelection()">Clear
                        </button>
                      </div>
                    }
                  </div>
                  <div class="audit-table-scroll">
                    <table class="round styled-table table-striped table-hover table-sm table-pointer">
                      <thead>
                      <tr>
                        <th (click)="sortLogsBy('status')"><span class="nowrap">Status @if (logSortField === 'status') {
                          <span class="sorting-header">{{ logSortDirection === 'DESC' ? '▼' : '▲' }}</span>
                        }</span></th>
                        <th (click)="sortLogsBy('time')"><span class="nowrap">Time @if (logSortField === 'time') {
                          <span class="sorting-header">{{ logSortDirection === 'DESC' ? '▼' : '▲' }}</span>
                        }</span></th>
                        <th (click)="sortLogsBy('message')"><span
                          class="nowrap">Message @if (logSortField === 'message') {
                          <span class="sorting-header">{{ logSortDirection === 'DESC' ? '▼' : '▲' }}</span>
                        }</span></th>
                      </tr>
                      </thead>
                      <tbody>
                        @for (log of filteredLogs; track log.id) {
                          <tr>
                            <td>
                              <app-status-icon noLabel [status]="log.status"/>
                            </td>
                            <td class="nowrap">{{ log.time | displayTimeWithSeconds }}</td>
                            <td class="text-break" markdown>{{ log.message }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
                <div class="d-md-none">
                  <div class="row g-2 align-items-center mb-2">
                    <div class="col-12 col-md-auto">
                      <label class="form-label mb-0">History:</label>
                    </div>
                    <div class="col" style="min-width: 0;">
                      @if (showHistorySelect) {
                        <ng-select [clearable]="true"
                                   bindLabel="createdDate"
                                   [searchable]="false"
                                   [(ngModel)]="selectedHistory"
                                   (ngModelChange)="onHistoryChange()"
                                   dropdownPosition="bottom">
                          <ng-template ng-label-tmp let-h="item">
                            <div class="d-flex align-items-center">
                              <app-status-icon noLabel [status]="h.status || 'info'"/>
                              <span class="ms-2 text-truncate">{{ h.createdDate | displayTimeWithSeconds }}
                                — {{ decode(h.siteIdentifier || h.siteName) }}</span>
                            </div>
                          </ng-template>
                          @for (h of migrationHistories; track h.id) {
                            <ng-option [value]="h">
                              <div class="d-flex align-items-center">
                                <app-status-icon noLabel [status]="h.status || 'info'"/>
                                <span class="ms-2 text-truncate">{{ h.createdDate | displayTimeWithSeconds }}
                                  — {{ decode(h.siteIdentifier || h.siteName) }}</span>
                              </div>
                            </ng-option>
                          }
                        </ng-select>
                      } @else {
                        <div class="d-flex align-items-center">
                          <app-status-icon noLabel [status]="'info'"/>
                          <span class="ms-2">Finding history...</span>
                        </div>
                      }
                    </div>
                    @if (selectedHistory) {
                      <div class="col-12 mt-2">
                        <button type="button" class="btn btn-sm btn-secondary w-100" (click)="clearHistorySelection()">
                          Clear
                        </button>
                      </div>
                    }
                  </div>
                  @for (log of filteredLogs; track log.id) {
                    <div class="border rounded p-2 mb-2">
                      <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <app-status-icon noLabel [status]="log.status"/>
                        <span class="fw-semibold">{{ log.time | displayTimeWithSeconds }}</span>
                      </div>
                      <div class="text-break">{{ log.message }}</div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </tab>
      </tabset>
    </app-page>`,
  styles: [`
    .audit-table-scroll
      position: relative
      max-height: 60vh
      overflow-y: auto
      overflow-x: hidden

    .audit-table-scroll table
      margin-bottom: 0
      width: 100%

    .audit-table-scroll thead
      position: sticky
      top: 0
      z-index: 20
      background-clip: padding-box

    .audit-table-scroll thead th
      position: sticky
      top: 0
      z-index: 20
      box-shadow: 0 1px 0 rgba(0,0,0,0.05)

    .audit-table-scroll th, .audit-table-scroll td
      vertical-align: top
      padding-top: .5rem
      padding-bottom: .5rem

    .audit-table-scroll td[markdown]
      white-space: normal
      line-height: 1.35

    .audit-table-scroll td[markdown] p,
    .audit-table-scroll td[markdown] ul,
    .audit-table-scroll td[markdown] ol,
    .audit-table-scroll td[markdown] pre,
    .audit-table-scroll td[markdown] blockquote
      margin-top: 0
      margin-bottom: .25rem

    .audit-table-scroll td[markdown] > :last-child
      margin-bottom: 0

    .audit-table-scroll td[markdown] a
      word-break: break-word
      overflow-wrap: anywhere

    .migration-template-link
      cursor: pointer
      text-decoration: none
      color: #1d1b1b
      font-weight: 600
      background: #f1b495
      padding: .2rem .45rem
      border-radius: 4px
      display: inline-block

    details[open]
      overflow: visible

    .thumbnail-heading-frame-compact:has(details[open])
      overflow: visible
  `],
  imports: [PageComponent, MarkdownEditorComponent, BadgeButtonComponent, TooltipDirective, FontAwesomeModule, FormsModule, NgClass, NgTemplateOutlet, NgSelectComponent, NgLabelTemplateDirective, TabsetComponent, TabDirective, DisplayTimeWithSecondsPipe, StatusIconComponent, MarkdownComponent, PageTransformationEditor, NgOptionComponent, NgOptionTemplateDirective]
})
export class MigrationSettingsComponent implements OnInit, OnDestroy, AfterViewInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MigrationSettingsComponent", NgxLoggerLevel.ERROR);
  protected readonly ParentPageMode = ParentPageMode;
  stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private migrationConfigService = inject(MigrationConfigService);
  private notifierService = inject(NotifierService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dateUtils = inject(DateUtilsService);
  private subscription: Subscription;
  private subscriptions: Subscription[] = [];
  public notifyTarget: AlertTarget = {};
  public activityTarget: AlertTarget = {};
  public migrationConfig: MigrationConfig;
  protected readonly faClose = faClose;
  protected readonly faAdd = faAdd;
  protected readonly faPlay = faPlay;
  protected readonly faExpand = faExpand;
  protected readonly faClone = faClone;
  protected readonly faCompress = faCompress;
  protected readonly faPaste = faPaste;
  protected readonly faCopy = faCopy;
  protected readonly faSpinner = faSpinner;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  public activityMessages: string[] = [];
  public activityNotifier: AlertInstance;
  public MigrationTab = { SETTINGS: "settings", ACTIVITY: "activity" } as const;
  public activeTabId: string = this.MigrationTab.SETTINGS;
  private webSocketClientService: WebSocketClientService = inject(WebSocketClientService);
  private clipboardService = inject(ClipboardService);
  private migrationHistoryService = inject(MigrationHistoryService);
  private uiActionsService = inject(UiActionsService);
  private pageContentService = inject(PageContentService);
  public logs: { id: string; status: string; time: number; message: string }[] = [];
  public filteredLogs: { id: string; status: string; time: number; message: string }[] = [];
  public migrationHistories: MigrationHistory[] = [];
  public selectedHistory: MigrationHistory | null = null;
  public streamingLogs: { id: string; status: string; time: number; message: string }[] = [];
  public showHistorySelect = false;
  public logSortField = "time";
  public logReverseSort = true;
  public logSortDirection = "DESC";
  private pendingSessionParam: string | null = null;
  private activeHistorySessionId: string | null = null;
  @ViewChildren("transformationDetails") transformationDetailsElements: QueryList<ElementRef<HTMLDetailsElement>>;
  @ViewChildren(MarkdownEditorComponent) editors: QueryList<MarkdownEditorComponent>;
  private sitePasteState: Map<SiteMigrationConfig, SitePasteState> = new Map();
  public migrationTemplates: PageContent[] = [];
  public migrationTemplatesLoading = false;

  ngOnInit() {
    this.subscription = this.migrationConfigService.migrationConfigEvents().subscribe(migrationConfig => {
      this.migrationConfig = migrationConfig;
      this.restoreSiteExpansionStates();
      this.logger.info("retrieved migrationConfig", migrationConfig);
    });
    this.activityNotifier = this.notifierService.createAlertInstance(this.activityTarget);
    this.route.queryParams.subscribe(params => {
      const tab = params["tab"];
      this.activeTabId = tab && Object.values(this.MigrationTab).includes(tab) ? tab : this.MigrationTab.SETTINGS;
      this.pendingSessionParam = params["session"];
    });
    this.webSocketClientService.connect().then(() => {
      this.subscriptions.push(this.webSocketClientService.receiveMessages<any>(MessageType.PROGRESS).subscribe((data: any) => {
        if (data?.history) {
          const h = data.history as MigrationHistory;
          const exists = this.migrationHistories.some(x => (x as any).id === (h as any).id);
          if (!exists) {
            this.migrationHistories = [h, ...this.migrationHistories];
          }
          this.selectedHistory = h;
          this.activeHistorySessionId = this.historySessionId(h);
          this.onHistoryChange();
        } else if (data?.historyRef) {
          const ref = data.historyRef as { id?: string; createdDate?: number; status?: string };
          if (ref?.createdDate) {
            const placeholder: MigrationHistory = {
              id: (ref as any).id || `${ref.createdDate}`,
              createdDate: ref.createdDate,
              status: ref.status || "running",
              auditLog: []
            } as any;
            const exists = this.migrationHistories.some(x => this.sessionToUrlParam(x.createdDate) === this.sessionToUrlParam(ref.createdDate));
            if (!exists) {
              this.migrationHistories = [placeholder, ...this.migrationHistories];
            }
            this.selectedHistory = placeholder;
            this.activeHistorySessionId = this.historySessionId(ref);
            this.onHistoryChange();
          }
        }
        const message = data?.message || data?.response || JSON.stringify(data);
        if (message) {
          this.activityMessages.push(message);
          this.activityNotifier.warning(message);
          const now = this.dateUtils.dateTimeNowAsValue();
          const log = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, status: "info", time: now, message };
          this.streamingLogs = [log, ...this.streamingLogs];
          const messageHistoryId = this.historySessionId(data?.history) || this.historySessionId(data?.historyRef) || this.activeHistorySessionId;
          if (this.shouldDisplayStreamingLog(messageHistoryId)) {
            this.appendLogEntry(log, messageHistoryId);
          }
        }
      }));
      this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.ERROR).subscribe((error: any) => {
        const message = error?.message || JSON.stringify(error);
        this.activityNotifier.error({ title: "Migration Failed", message });
        this.activityMessages.push(message);
        this.addLog("error", message);
        this.activeHistorySessionId = null;
      }));
      this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.COMPLETE).subscribe((message: any) => {
        const text = message?.response || JSON.stringify(message);
        this.activityNotifier.success({ title: "Migration Complete", message: text });
        this.activityMessages.push(text);
        this.addLog("complete", text);
        this.activeHistorySessionId = null;
      }));
    });
    this.loadHistory();
    this.refreshMigrationTemplates();
  }

  ngAfterViewInit(): void {
    this.autoExpandTransformationDetails();
    this.transformationDetailsElements.changes.subscribe(() => {
      this.autoExpandTransformationDetails();
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private autoExpandTransformationDetails(): void {
    if (!this.migrationConfig?.sites) return;

    setTimeout(() => {
      const detailsArray = this.transformationDetailsElements?.toArray() || [];
      let detailsIndex = 0;

      this.migrationConfig.sites.forEach(site => {
        site.parentPages?.forEach(parentPage => {
          if (detailsIndex < detailsArray.length) {
            const detailsElement = detailsArray[detailsIndex].nativeElement;
            if (parentPage.pageTransformation?.steps?.length > 0) {
              detailsElement.open = true;
            }
            detailsIndex++;
          }
        });
      });
    }, 0);
  }

  saveAndExit() {
    this.save()
      .then(() => this.urlService.navigateTo(["admin"]))
      .catch((error) => this.logger.error(error));
  }

  save() {
    this.logger.info("saving config", this.migrationConfig);
    const saveEditors = (this.editors?.toArray() || []).map(e => e.save()).filter(p => !!p);
    return Promise.all(saveEditors as any).then(() => this.migrationConfigService.saveConfig(this.migrationConfig));
  }

  cancel() {
    this.undoChanges();
    this.urlService.navigateTo(["admin"]);
  }

  notReady() {
    return !this.migrationConfig;
  }

  deleteSite(site: SiteMigrationConfig) {
    this.migrationConfig.sites = this.migrationConfig.sites.filter(item => item !== site);
  }

  duplicateSite(site: SiteMigrationConfig) {
    const duplicatedSite: SiteMigrationConfig = cloneDeep(site);
    duplicatedSite.name = "Copy of " + duplicatedSite.name;
    const rowIndex = this.migrationConfig.sites.indexOf(site);
    this.logger.info("duplicateSite:site:", duplicatedSite, "at index position:", rowIndex);
    this.migrationConfig.sites.splice(rowIndex, 0, duplicatedSite);
  }

  activateSitePaste(site: SiteMigrationConfig) {
    this.sitePasteState.set(site, {active: true, value: "", error: ""});
    site.expanded = true;
  }

  sitePasteActive(site: SiteMigrationConfig): boolean {
    return this.sitePasteState.get(site)?.active ?? false;
  }

  sitePasteValue(site: SiteMigrationConfig): string {
    return this.sitePasteState.get(site)?.value ?? "";
  }

  sitePasteError(site: SiteMigrationConfig): string | null {
    return this.sitePasteState.get(site)?.error || null;
  }

  cancelSitePaste(site: SiteMigrationConfig) {
    this.sitePasteState.delete(site);
  }

  transformSitePaste(site: SiteMigrationConfig, value: string) {
    const state = this.sitePasteState.get(site) || {active: true, value: "", error: ""};
    state.value = value;
    try {
      const parsed = JSON.parse(value) as SiteMigrationConfig;
      const normalised = this.normaliseSiteConfig(parsed);
      const expanded = site.expanded;
      Object.assign(site, normalised);
      site.expanded = expanded ?? true;
      this.sitePasteState.delete(site);
      this.logger.info("Applied pasted site configuration for", site.name);
    } catch (error) {
      state.error = "Invalid site configuration JSON";
      this.sitePasteState.set(site, state);
    }
  }

  async refreshMigrationTemplates(showSpinner = true) {
    if (showSpinner) {
      this.migrationTemplatesLoading = true;
    }
    try {
      const allContent = await this.pageContentService.all();
      this.migrationTemplates = (allContent || [])
        .filter(fragment => (fragment.path || "").startsWith("fragments/"))
        .filter(fragment => fragment?.migrationTemplate?.templateType === ContentTemplateType.MIGRATION_TEMPLATE);
      if (!this.migrationTemplates.length) {
        this.logger.warn("No migration templates found");
      }
    } catch (error) {
      this.logger.error("Failed to load migration templates", error);
    } finally {
      if (showSpinner) {
        this.migrationTemplatesLoading = false;
      }
    }
  }

  migrationTemplateLabelById(fragmentId: string): string {
    const fragment = this.migrationTemplates.find(item => item.id === fragmentId);
    return fragment?.path || fragment?.migrationTemplate?.templateName || fragmentId || "Template";
  }

  siteTemplateFragment(site: SiteMigrationConfig): PageContent | undefined {
    return site?.templateFragmentId ? this.migrationTemplates.find(item => item.id === site.templateFragmentId) : undefined;
  }

  templateHref(fragmentId: string | undefined): string | null {
    if (!fragmentId) {
      return null;
    }
    const fragment = this.migrationTemplates.find(item => item.id === fragmentId);
    const path = fragment?.path;
    if (!path) {
      return null;
    }
    return `/${path.replace(/^\/+/, "")}`;
  }

  openTemplate(fragmentId: string | undefined) {
    if (!fragmentId) {
      return;
    }
    const fragment = this.migrationTemplates.find(item => item.id === fragmentId);
    if (fragment?.path) {
      this.router.navigate(["/admin", "page-content", fragment.path.replace(/^\/+/, "")]);
    }
  }

  parentTemplateSummary(site: SiteMigrationConfig, parentPage: ParentPageConfig): string {
    if (parentPage?.templateFragmentId) {
      return this.migrationTemplateLabelById(parentPage.templateFragmentId);
    }
    if (site?.templateFragmentId) {
      return `Using site template ${this.migrationTemplateLabelById(site.templateFragmentId)}`;
    }
    return "No template selected";
  }

  siteConfigJson(site: SiteMigrationConfig): string {
    return JSON.stringify(this.prepareSiteForCopy(site), null, 2);
  }

  copySiteConfig(site: SiteMigrationConfig) {
    const value = this.siteConfigJson(site);
    this.clipboardService.copyToClipboard(value);
  }

  private normaliseSiteConfig(site: SiteMigrationConfig): SiteMigrationConfig {
    const defaults = this.migrationConfigService.emptySiteMigrationConfig();
    const cloned = cloneDeep(site);
    return {
      ...defaults,
      ...cloned,
      specificAlbums: (cloned.specificAlbums || []).map(album => ({...album})),
      parentPages: (cloned.parentPages || []).map(parent => ({
        ...parent,
        pageTransformation: parent.pageTransformation ? cloneDeep(parent.pageTransformation) : undefined
      })),
      expanded: true
    };
  }

  private prepareSiteForCopy(site: SiteMigrationConfig): SiteMigrationConfig {
    const clone = cloneDeep(site);
    delete (clone as any).expanded;
    return clone;
  }

  addSite() {
    this.migrationConfig.sites.push(this.migrationConfigService.emptySiteMigrationConfig());
  }

  addParentPage(site: SiteMigrationConfig) {
    if (!site.parentPages) {
      site.parentPages = [];
    }
    site.parentPages.push({
      url: "",
      pathPrefix: "",
      linkSelector: "",
      migrateParent: false,
      maxChildren: undefined
    });
  }

  deleteParentPage(site: SiteMigrationConfig, parentPage: ParentPageConfig) {
    if (site.parentPages) {
      site.parentPages = site.parentPages.filter(item => item !== parentPage);
    }
  }

  addSpecificAlbum(site: SiteMigrationConfig) {
    if (!site.specificAlbums) {
      site.specificAlbums = [];
    }
    site.specificAlbums.push({ path: "", title: "" });
  }

  deleteSpecificAlbum(site: SiteMigrationConfig, album: { path: string; title: string }) {
    if (site.specificAlbums) {
      site.specificAlbums = site.specificAlbums.filter(item => item !== album);
    }
  }

  undoChanges() {
    this.migrationConfigService.refreshConfig();
  }

  runMigration(site: SiteMigrationConfig) {
    if (!site.enabled) {
      this.logger.warn("Site is disabled:", site.name);
      return;
    }

    const siteName = encodeURIComponent(site.name);
    const persistData = site.persistData || false;
    const uploadTos3 = site.uploadTos3 || false;
    this.activityMessages = [];
    this.selectTab(this.MigrationTab.ACTIVITY);
    this.activityNotifier.warning({ title: "Migration", message: `Starting migration for ${site.name}` }, false, true);
    this.activityMessages.push(`Started migration for ${site.name}`);
    this.logs = [];
    this.filteredLogs = [];
    this.addLog("info", `Starting migration for ${site.name}`);
    this.webSocketClientService.connect().then(() => {
      this.webSocketClientService.sendMessage(EventType.SITE_MIGRATION, { siteName, persistData, uploadTos3, siteConfig: site });
    });
  }

  selectTab(tab: string): void {
    this.activeTabId = tab;
    this.updateUrl();
  }

  private addLog(status: string, message: string): void {
    const now = this.dateUtils.dateTimeNowAsValue();
    const entry = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, status, time: now, message };
    this.logs = [entry, ...this.logs];
    this.applyLogSorting();
  }

  sortLogsBy(field: string): void {
    if (this.logSortField === field) {
      this.logReverseSort = !this.logReverseSort;
    } else {
      this.logReverseSort = true;
    }
    this.logSortField = field;
    this.logSortDirection = this.logReverseSort ? "DESC" : "ASC";
    this.applyLogSorting();
  }

  private applyLogSorting(): void {
    const prefix = this.logReverseSort ? "-" : "";
    this.filteredLogs = this.logs.slice().sort(sortBy(`${prefix}${this.logSortField}`));
  }

  async loadHistory() {
    try {
      this.migrationHistories = await this.migrationHistoryService.all();
      this.showHistorySelect = true;

      if (this.pendingSessionParam) {
        const matchingSession = this.migrationHistories.find(h => this.sessionToUrlParam(h.createdDate) === this.pendingSessionParam);
        if (matchingSession) {
          this.selectedHistory = matchingSession;
          this.onHistoryChange();
        }
        this.pendingSessionParam = null;
      } else if (!this.selectedHistory && this.migrationHistories?.length) {
        this.selectedHistory = this.migrationHistories[0];
        this.onHistoryChange();
      }
    } catch (e) {
      this.logger.warn("loadHistory failed", e);
      this.showHistorySelect = true;
    }
  }

  onHistoryChange() {
    if (!this.selectedHistory) {
      this.logs = this.streamingLogs.slice();
      this.applyLogSorting();
      this.updateUrl();
      return;
    }
    const h = this.selectedHistory;
    this.logs = (h.auditLog || []).map(log => ({ id: `${log.time}-${Math.random().toString(36).slice(2, 6)}`, status: log.status || "info", time: log.time || 0, message: log.message }));
    this.applyLogSorting();
    this.updateUrl();
  }

  clearHistorySelection() {
    this.selectedHistory = null;
    this.logs = this.streamingLogs.slice();
    this.applyLogSorting();
  }

  private shouldDisplayStreamingLog(historyId: string | null): boolean {
    if (!this.selectedHistory) {
      return true;
    }
    if (!historyId) {
      return false;
    }
    return this.historySessionId(this.selectedHistory) === historyId;
  }

  private appendLogEntry(log: { id: string; status: string; time: number; message: string }, historyId: string | null): void {
    this.logs = [log, ...this.logs];
    this.applyLogSorting();
    if (historyId && this.selectedHistory && this.historySessionId(this.selectedHistory) === historyId) {
      const auditEntry = { time: log.time, status: log.status, message: log.message };
      this.selectedHistory.auditLog = [auditEntry, ...(this.selectedHistory.auditLog || [])];
    }
  }

  private historySessionId(value?: { id?: string; createdDate?: number } | null): string | null {
    if (!value) {
      return null;
    }
    if ((value as any).id) {
      return (value as any).id;
    }
    if ((value as any).createdDate) {
      return `${(value as any).createdDate}`;
    }
    return null;
  }

  toggleExpandForSite(site: SiteMigrationConfig) {
    site.expanded = !site.expanded;
    this.saveSiteExpansionState(site);
  }

  private expansionStateKey(siteIndex: number): string {
    return `${StoredValue.MIGRATION_SITE_EXPANDED}-${siteIndex}`;
  }

  private saveSiteExpansionState(site: SiteMigrationConfig) {
    const siteIndex = this.migrationConfig.sites.indexOf(site);
    if (siteIndex >= 0) {
      this.uiActionsService.saveValueFor(this.expansionStateKey(siteIndex) as any, site.expanded ? "true" : "false");
    }
  }

  private restoreSiteExpansionStates() {
    if (!this.migrationConfig?.sites) return;

    this.migrationConfig.sites.forEach((site, index) => {
      const saved = this.uiActionsService.initialValueFor(this.expansionStateKey(index));
      if (!isNull(saved)) {
        site.expanded = saved === "true";
      }
    });
  }

  decode(val?: string): string {
    try {
      return val ? decodeURIComponent(val) : "";
    } catch {
      return val || "";
    }
  }

  private updateUrl(): void {
    const queryParams: any = { tab: this.activeTabId };
    if (this.selectedHistory?.createdDate) {
      queryParams.session = this.sessionToUrlParam(this.selectedHistory.createdDate);
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: "merge"
    });
  }

  private sessionToUrlParam(createdDate: number): string {
    if (!createdDate) return "";
    return this.dateUtils.asDateTime(createdDate).toFormat("yyyy-MM-dd'T'HHmm");
  }

}
