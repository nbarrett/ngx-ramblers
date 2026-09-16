import {Component, inject, OnDestroy, OnInit, QueryList, ViewChildren} from "@angular/core";
import { faAdd, faArrowUpRightFromSquare, faCircleExclamation, faClose, faCopy, faPaste, faPlay, faSpinner, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { UIDateFormat } from "../../../../models/date-format.model";
import { MigrationConfig, ParentPageConfig, ParentPageMode, SiteMigrationConfig } from "../../../../models/migration-config.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { MigrationConfigService } from "../../../../services/migration/migration-config.service";
import { Subscription } from "rxjs";
import { PageComponent } from "../../../../page/page.component";
import { ContentTextEditor } from "../../../../modules/common/tiptap-editor/content-text-editor";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { FormSaveActionsComponent } from "../../../../modules/common/form-save-actions/form-save-actions";
import { FormSaveActions } from "../../../../models/form-save-actions.model";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgTemplateOutlet } from "@angular/common";
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
import { MessageType } from "../../../../models/websocket.model";
import { DisplayTimeWithSecondsPipe } from "../../../../pipes/display-time.pipe-with-seconds";
import { StatusIconComponent } from "../../status-icon";
import { isNull, startCase, values } from "es-toolkit/compat";
import { MarkdownComponent } from "ngx-markdown";
import { PageTransformationEditor } from "./page-transformation-editor";
import { cloneDeep } from "es-toolkit/compat";
import { MigrationActivityLog, MigrationHistory, MigrationSettingsTab } from "../../../../models/migration-history.model";
import { MigrationHistoryService } from "../../../../services/migration/migration-history.service";
import { ContentTemplateType, EM_DASH_WITH_SPACES, PageContent } from "../../../../models/content-text.model";
import { ClipboardService } from "../../../../services/clipboard.service";
import { UiActionsService } from "../../../../services/ui-actions.service";
import { StoredValue, StoredValueQueryParameters } from "../../../../models/ui-actions";
import { PageContentService } from "../../../../services/page-content.service";
import { SortableTableComponent } from "../../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../../modules/common/sortable-table/sortable-table.model";
import { SiteMapViewComponent } from "../../../../modules/common/site-map/site-map-view";
import { SiteMapViewMode, SitemapNode } from "../../../../models/sitemap.model";
import { migrationSectionIndex, migrationSectionNodes } from "../../../../functions/migration-section-tree";
import { ASCENDING, DESCENDING } from "../../../../models/table-filtering.model";

type SitePasteState = { active: boolean; value: string; error?: string };

@Component({
  selector: "app-migration-settings",
  template: `
    <app-page autoTitle>
      @if (migrationConfig) {
        @if (migrationConfig.sites.length === 0) {
          <div class="img-thumbnail thumbnail-admin-edit p-3 mb-3">
            <p class="mb-0">This site has no migration configuration. One is created when a group registers and its pages are imported.</p>
          </div>
        }
        @if (migrationConfig.sites.length > 1) {
          <div class="site-chooser mb-3">
            <span class="site-chooser-label">Old website:</span>
            @for (option of migrationConfig.sites; track option.name) {
              <button type="button" class="site-chooser-option" [class.active]="option === activeSite()"
                      (click)="chooseSite(option)">{{ option.name }}</button>
            }
          </div>
        }
        @if (activeSite(); as site) {
          @let siteIndex = migrationConfig.sites.indexOf(site);
          <div class="migration-site-summary mb-3">
            <div>
              <span class="fw-semibold">{{ site.name }}</span>
              <span class="text-muted">${EM_DASH_WITH_SPACES}{{ site.parentPages?.length || 0 }} content sections read from {{ site.baseUrl }}</span>
            </div>
            <div class="migration-site-actions">
              <app-badge-button noRightMargin [icon]="faPaste" (click)="activateSitePaste(site)" delay=500
                                tooltip="Paste site configuration from clipboard"/>
              <app-badge-button noRightMargin [icon]="faCopy" (click)="copySiteConfig(site)" delay=500
                                tooltip="Copy site configuration to clipboard"/>
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
                                    <button type="button" class="btn btn-quiet"
                                            (click)="cancelSitePaste(site)">Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          }        }
      }
      <tabset class="custom-tabset">
        <tab [active]="activeTabId === MigrationTab.SECTIONS" (selectTab)="selectTab(MigrationTab.SECTIONS)"
             heading="Content sections">
          <div class="img-thumbnail thumbnail-admin-edit">
                  <ng-template #sectionEditor let-site="site" let-parentPage="parentPage" let-siteIndex="siteIndex" let-parentIndex="parentIndex">
                                  <div class="row p-3">
                                    <div class="col-12">
                                      <div class="form-group">
                                        <label [for]="stringUtils.kebabCase('parent-url', siteIndex, parentIndex)">
                                          Starting page on the old site</label>
                                        <input [id]="stringUtils.kebabCase('parent-url', siteIndex, parentIndex)"
                                               type="text" class="form-control"
                                               placeholder="e.g., Walks/index.htm" [(ngModel)]="parentPage.url">
                                        <div class="form-text">The landing page where this section is discovered.</div>
                                      </div>
                                    </div>
                                    <div class="col-12">
                                      <div class="form-group">
                                        <label [for]="stringUtils.kebabCase('path-prefix', siteIndex, parentIndex)">
                                          Destination on the new site</label>
                                        <input [id]="stringUtils.kebabCase('path-prefix', siteIndex, parentIndex)"
                                               type="text" class="form-control"
                                               placeholder="e.g., walks" [(ngModel)]="parentPage.pathPrefix">
                                        <div class="form-text">For example, <strong>about-us</strong> creates pages beneath that address.</div>
                                      </div>
                                    </div>
                                  </div>
                                  <div class="row p-3">
                                    <div class="col-12">
                                      <div class="form-group">
                                        <label
                                          [for]="stringUtils.kebabCase('link-selector', siteIndex, parentIndex)">
                                          Child-page links (advanced)</label>
                                        <input [id]="stringUtils.kebabCase('link-selector', siteIndex, parentIndex)"
                                               type="text" class="form-control"
                                               placeholder="Leave empty to use content area"
                                               [(ngModel)]="parentPage.linkSelector">
                                      </div>
                                    </div>
                                    <div class="col-12">
                                      <div class="form-group">
                                        <label
                                          [for]="stringUtils.kebabCase('migrate-parent-mode', siteIndex, parentIndex)">
                                          Landing-page treatment</label>
                                          <select class="form-select form-select-sm"
                                                [id]="stringUtils.kebabCase('migrate-parent-mode', siteIndex, parentIndex)"
                                                [(ngModel)]="parentPage.parentPageMode">
                                          <option [ngValue]="null">Import child pages only</option>
                                          <option [ngValue]="ParentPageMode.AS_IS">Import the landing page and its content</option>
                                          <option [ngValue]="ParentPageMode.ACTION_BUTTONS">Import the landing page with child-page buttons
                                          </option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                  <div class="row p-3">
                                    <div class="col-12">
                                      <div class="form-group">
                                        <label [for]="stringUtils.kebabCase('max-children', siteIndex, parentIndex)">
                                          Child-page limit (optional)</label>
                                        <input [id]="stringUtils.kebabCase('max-children', siteIndex, parentIndex)"
                                               type="number" min="0" class="form-control"
                                               placeholder="e.g., 5" [(ngModel)]="parentPage.maxChildren">
                                      </div>
                                    </div>
                                    <div class="col-12">
                                      <div class="form-group">
                                        <label
                                          [for]="stringUtils.kebabCase('parent-template', siteIndex, parentIndex)">
                                          Page layout override (optional)</label>
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
                                      <details>
                                        <summary class="fw-semibold mb-2 pointer">
                                          Optional clean-up steps
                                        </summary>
                                        <p class="small text-muted">Use these only when this section needs different clean-up from the rest of the site. Steps run from top to bottom and change presentation without inventing or discarding source content.</p>
                                        <app-page-transformation-editor [(config)]="parentPage.pageTransformation"/>
                                      </details>
                                    </div>
                                  </div>
                  </ng-template>
            @if (activeSite(); as site) {
              @let siteIndex = migrationConfig.sites.indexOf(site);
                            <div class="p-3">
                              <p class="mb-3">Each content section is one branch of the old site, taken from the pages chosen when the group registered. Choose a section to review or change where it starts, which linked pages come with it and where it appears on the new site.</p>
                              <app-site-map-view [roots]="contentSectionNodes(site)" [viewMode]="SiteMapViewMode.TREE"
                                                 [treeDepth]="0" showFilter showPreview
                                                 (focusChange)="focusSection(site, $event)"
                                                 emptyMessage="This site has no content sections.">
                                @if (focusedSection(site); as parentPage) {
                                  <div class="thumbnail-heading d-flex align-items-start justify-content-between">
                                    <div>
                                      <span>{{ contentSectionTitle(parentPage) }}</span>
                                      <span class="heading-summary">{{ contentSectionSummary(parentPage) }}</span>
                                    </div>
                                    <app-badge-button noRightMargin (click)="deleteParentPage(site, parentPage)" delay=500
                                                      tooltip="Delete content section" [icon]="faClose"/>
                                  </div>
                                  <ng-container [ngTemplateOutlet]="sectionEditor"
                                                [ngTemplateOutletContext]="{site, parentPage, siteIndex, parentIndex: sectionIndex(site, parentPage)}"/>
                                } @else {
                                  <div class="thumbnail-heading">Content section</div>
                                  <p class="mb-0">Choose a content section to review or change it. Only the section you choose is shown.</p>
                                }
                              </app-site-map-view>
                            </div>
            } @else {
              <p class="p-3 mb-0">There is no migration configuration for this site yet.</p>
            }
          </div>
        </tab>
        <tab [active]="activeTabId === MigrationTab.RULES" (selectTab)="selectTab(MigrationTab.RULES)"
             heading="Import rules">
          <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mt-2 mb-2">
                    <details>
                      <summary class="fw-semibold pointer">Additional migration guidance</summary>
                      <div class="mt-2">
                        <app-content-text-editor category="admin" name="migration-settings-help"
                                             standalone
                                             description="Migration settings help"></app-content-text-editor>
                      </div>
                    </details>
                  </div>
            @if (activeSite(); as site) {
              @let siteIndex = migrationConfig.sites.indexOf(site);
                            <p class="small text-muted mt-2 mb-3">These settings apply to every content section. Most generated registrations are ready to use without changing them.</p>
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
                                  Exclude text blocks</label>
                                <textarea rows="6" class="form-control"
                                          [id]="stringUtils.kebabCase('exclude-markdown-blocks', siteIndex)"
                                          placeholder="Paste exact text blocks from the output to remove. Separate multiple blocks with a line containing three dashes (---)."
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
                          <div class="row p-3">
                            <div class="col-sm-3">
                              <div class="form-group">
                                <div class="form-check">
                                  <input [(ngModel)]="site.useNestedRows" type="checkbox" class="form-check-input"
                                         [id]="stringUtils.kebabCase('use-nested-rows', siteIndex)">
                                  <label class="form-check-label"
                                         [for]="stringUtils.kebabCase('use-nested-rows', siteIndex)" delay=500
                                         tooltip="When checked: keeps all content in one row with nested sub-rows. When unchecked: splits content into separate rows">
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
            } @else {
              <p class="p-3 mb-0">There is no migration configuration for this site yet.</p>
            }
          </div>
        </tab>
        <tab [active]="activeTabId === MigrationTab.ACTIVITY" (selectTab)="selectTab(MigrationTab.ACTIVITY)"
             heading="Activity">
          <div class="img-thumbnail thumbnail-admin-edit">
            <div class="thumbnail-heading-frame mb-3">
              <div class="thumbnail-heading">Migration notes</div>
              @if (migrationNotePages === null) {
                <p class="mb-0">Checking the site for migration notes…</p>
              } @else if (migrationNotePages === 0) {
                <p class="mb-0">No pages show a migration note.</p>
              } @else {
                <p>{{ stringUtils.pluraliseWithCount(migrationNotePages, "page") }} show a note saying which page of the old website {{ migrationNotePages === 1 ? "it" : "they" }} came from. Remove them all when the site goes live.</p>
                @if (confirmMigrationNoteRemoval) {
                  <div class="alert alert-warning d-flex align-items-start mb-0"><fa-icon [icon]="faCircleExclamation" class="me-2"/><div>
                    <strong>Remove every migration note?</strong>
                    <p>The notes are taken off every page on this site. The pages themselves are not changed otherwise.</p>
                    <button type="button" class="btn btn-primary me-2" [disabled]="removingMigrationNotes" (click)="removeMigrationNotes()"><fa-icon [icon]="faTrash"/> Remove migration notes</button>
                    <button type="button" class="btn btn-quiet" [disabled]="removingMigrationNotes" (click)="confirmMigrationNoteRemoval = false"><fa-icon [icon]="faXmark"/> Cancel</button>
                  </div></div>
                } @else {
                  <button type="button" class="btn btn-primary" (click)="confirmMigrationNoteRemoval = true"><fa-icon [icon]="faTrash"/> Remove all migration notes</button>
                }
              }
            </div>
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
                <div class="row g-2 align-items-center mb-2">
                  <div class="col-12 col-md-auto">
                    <label class="form-label mb-0">Migration run</label>
                  </div>
                  <div class="col activity-history-select">
                    @if (showHistorySelect) {
                      <ng-select [clearable]="true" bindLabel="createdDate" [searchable]="false"
                                 [(ngModel)]="selectedHistory" (ngModelChange)="onHistoryChange()"
                                 dropdownPosition="bottom">
                        <ng-template ng-label-tmp let-h="item">
                          <div class="d-flex align-items-center">
                            <app-status-icon noLabel [status]="h.status || 'info'"/>
                            <span class="ms-2 text-truncate">{{ h.createdDate | displayTimeWithSeconds }} — {{ decode(h.siteIdentifier || h.siteName) }}</span>
                          </div>
                        </ng-template>
                        @for (h of migrationHistories; track h.id) {
                          <ng-option [value]="h">
                            <div class="d-flex align-items-center">
                              <app-status-icon noLabel [status]="h.status || 'info'"/>
                              <span class="ms-2 text-truncate">{{ h.createdDate | displayTimeWithSeconds }} — {{ decode(h.siteIdentifier || h.siteName) }}</span>
                            </div>
                          </ng-option>
                        }
                      </ng-select>
                    } @else {
                      <div class="d-flex align-items-center">
                        <app-status-icon noLabel [status]="'info'"/>
                        <span class="ms-2">Finding migration runs...</span>
                      </div>
                    }
                  </div>
                  @if (selectedHistory) {
                    <div class="col-12 col-md-auto">
                      <button type="button" class="btn btn-quiet w-100" (click)="clearHistorySelection()">Show current activity</button>
                    </div>
                  }
                </div>
                <app-sortable-table [rows]="logs" [columns]="logColumns" [defaultSortKey]="logSortField"
                                    [defaultSortDirection]="logSortDirection" maxHeight="60vh"
                                    emptyMessage="No activity has been recorded for this migration run."
                                    (sortChange)="logSortChanged($event)">
                  <ng-template appSortableTableCell="status" let-log>
                    <app-status-icon noLabel [status]="log.status"/>
                  </ng-template>
                  <ng-template appSortableTableCell="time" let-log>
                    <span class="nowrap">{{ log.time | displayTimeWithSeconds }}</span>
                  </ng-template>
                  <ng-template appSortableTableCell="message" let-log>
                    <div class="text-break" markdown>{{ log.message }}</div>
                  </ng-template>
                </app-sortable-table>
              </div>
            </div>
          </div>
        </tab>
      </tabset>
      @if (activeSite()) {
        <div class="row">
          <div class="col-sm-12">
            <app-form-save-actions [disabled]="notReady()" [actions]="formSaveActions"/>
          </div>
        </div>
      }
`,
  styles: [`
    .activity-history-select
      min-width: 0

    .migration-site-summary
      display: flex
      flex-wrap: wrap
      gap: .5rem
      align-items: center
      justify-content: space-between

    .migration-site-actions
      display: flex
      gap: .25rem

    .site-chooser
      display: flex
      flex-wrap: wrap
      gap: .5rem
      align-items: center

    .site-chooser-label
      font-weight: 600

    .site-chooser-option
      border: 1px solid #ced4da
      background: #fff
      border-radius: 2rem
      padding: .15rem .75rem
      &.active
        background: #f1b495
        border-color: #f1b495
        font-weight: 600

    .site-chooser
      display: flex
      flex-wrap: wrap
      gap: .5rem
      align-items: center

    .site-chooser-label
      font-weight: 600

    .site-chooser-option
      border: 1px solid #ced4da
      background: #fff
      border-radius: 2rem
      padding: .15rem .75rem
      &.active
        background: #f1b495
        border-color: #f1b495
        font-weight: 600

    .migration-template-link
      cursor: pointer
      text-decoration: none
      color: #1d1b1b
      font-weight: 600
      background: #f1b495
      padding: .2rem .45rem
      border-radius: 4px
      display: inline-block

    .migration-flow
      display: flex
      align-items: center
      flex-wrap: wrap
      gap: var(--space-2)

    .migration-flow span
      padding: var(--space-2) var(--space-3)
      border-radius: var(--radius-2)
      background: var(--rsm-table-header-bg)
      color: var(--rsm-text)
      font-weight: 600

    .heading-summary
      display: block
      margin-top: var(--space-1)
      color: var(--rsm-muted)
      font-size: .8rem
      font-weight: 400

    details[open]
      overflow: visible

    .thumbnail-heading-frame-compact:has(details[open])
      overflow: visible
  `],
  imports: [PageComponent, ContentTextEditor, BadgeButtonComponent, TooltipDirective, FontAwesomeModule, FormsModule, NgTemplateOutlet, NgSelectComponent, NgLabelTemplateDirective, TabsetComponent, TabDirective, DisplayTimeWithSecondsPipe, StatusIconComponent, MarkdownComponent, PageTransformationEditor, NgOptionComponent, NgOptionTemplateDirective, FormSaveActionsComponent, SortableTableComponent, SortableTableCellDirective, SiteMapViewComponent]
})
export class MigrationSettingsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MigrationSettingsComponent", NgxLoggerLevel.ERROR);
  public formSaveActions: FormSaveActions = {
    save: () => this.save(),
    saveAndExit: () => this.saveAndExit(),
    undo: () => this.undoChanges(),
    cancel: () => this.cancel()
  };
  protected readonly ParentPageMode = ParentPageMode;
  protected readonly SiteMapViewMode = SiteMapViewMode;
  private focusedSectionIndexes: Record<string, number> = {};
  private chosenSiteName = "";
  private sectionNodes: Record<string, SitemapNode[]> = {};
  private sectionNodeSignatures: Record<string, string> = {};
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
  protected readonly faPaste = faPaste;
  protected readonly faCopy = faCopy;
  protected readonly faSpinner = faSpinner;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faTrash = faTrash;
  protected readonly faXmark = faXmark;
  migrationNotePages: number | null = null;
  confirmMigrationNoteRemoval = false;
  removingMigrationNotes = false;
  public activityMessages: string[] = [];
  public activityNotifier: AlertInstance;
  public MigrationTab = MigrationSettingsTab;
  public activeTabId: MigrationSettingsTab = MigrationSettingsTab.SECTIONS;
  private webSocketClientService: WebSocketClientService = inject(WebSocketClientService);
  private clipboardService = inject(ClipboardService);
  private migrationHistoryService = inject(MigrationHistoryService);
  private uiActionsService = inject(UiActionsService);
  private pageContentService = inject(PageContentService);
  public logs: MigrationActivityLog[] = [];
  public migrationHistories: MigrationHistory[] = [];
  public selectedHistory: MigrationHistory | null = null;
  public streamingLogs: MigrationActivityLog[] = [];
  public showHistorySelect = false;
  public logSortField = "time";
  public logSortDirection = DESCENDING;
  public logColumns: SortableTableColumn<MigrationActivityLog>[] = [
    {key: "status", label: "Status", sortKey: "status", cellGetter: log => log.status},
    {key: "time", label: "Time", sortKey: "time", cellGetter: log => log.time},
    {key: "message", label: "Message", sortKey: "message", cellGetter: log => log.message}
  ];
  private pendingSessionParam: string | null = null;
  private activeHistorySessionId: string | null = null;
  @ViewChildren(ContentTextEditor) editors: QueryList<ContentTextEditor>;
  private sitePasteState: Map<SiteMigrationConfig, SitePasteState> = new Map();
  public migrationTemplates: PageContent[] = [];
  public migrationTemplatesLoading = false;

  async refreshMigrationNotePages(): Promise<void> {
    this.migrationNotePages = await this.pageContentService.migrationNotePageCount().catch(() => 0);
  }

  async removeMigrationNotes(): Promise<void> {
    this.removingMigrationNotes = true;
    try {
      const removed = await this.pageContentService.removeMigrationNotes();
      this.activityNotifier.success({title: "Migration notes removed", message: `Removed the migration note from ${this.stringUtils.pluraliseWithCount(removed, "page")}.`});
      this.confirmMigrationNoteRemoval = false;
      await this.refreshMigrationNotePages();
    } catch (error) {
      this.activityNotifier.error({title: "Migration notes not removed", message: error});
    } finally {
      this.removingMigrationNotes = false;
    }
  }

  ngOnInit() {
    this.subscription = this.migrationConfigService.migrationConfigEvents().subscribe(migrationConfig => {
      this.migrationConfig = migrationConfig;
      this.restoreSiteExpansionStates();
      this.logger.info("retrieved migrationConfig", migrationConfig);
    });
    this.activityNotifier = this.notifierService.createAlertInstance(this.activityTarget);
    this.refreshMigrationNotePages();
    this.route.queryParams.subscribe(params => {
      const tab = params[StoredValue.TAB];
      this.activeTabId = tab && values(this.MigrationTab).includes(tab) ? tab as MigrationSettingsTab : this.MigrationTab.SECTIONS;
      this.pendingSessionParam = params[StoredValue.SESSION];
      this.logSortField = params[StoredValue.MIGRATION_LOG_SORT] || "time";
      this.logSortDirection = params[StoredValue.MIGRATION_LOG_SORT_ORDER] === ASCENDING ? ASCENDING : DESCENDING;
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

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  saveAndExit() {
    return this.save()
      .then(() => this.urlService.navigateTo(["admin"]));
  }

  save() {
    this.logger.info("saving config", this.migrationConfig);
    const saveEditors = (this.editors?.toArray() || []).map(e => e.save()).filter(p => !!p);
    this.activityNotifier.setBusy();
    return Promise.all(saveEditors as any)
      .then(() => this.migrationConfigService.saveConfig(this.migrationConfig))
      .then(response => {
        this.activityNotifier.success({title: "Migration settings", message: "Settings saved"});
        return response;
      })
      .catch((error) => {
        this.logger.error(error);
        this.activityNotifier.error(error);
        return Promise.reject(error);
      })
      .finally(() => this.activityNotifier.clearBusy());
  }

  cancel() {
    this.undoChanges();
    this.urlService.navigateTo(["admin"]);
  }

  notReady() {
    return !this.migrationConfig;
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

  activeSite(): SiteMigrationConfig {
    const sites = this.migrationConfig?.sites || [];
    return sites.find(site => site.name === this.chosenSiteName) || sites[0] || null;
  }

  chooseSite(site: SiteMigrationConfig): void {
    this.chosenSiteName = site?.name || "";
  }

  contentSectionNodes(site: SiteMigrationConfig): SitemapNode[] {
    const nodes = migrationSectionNodes(site.parentPages || [], section => ({
      title: this.contentSectionTitle(section),
      detail: this.contentSectionSummary(section)
    }));
    const signature = JSON.stringify(nodes);
    if (this.sectionNodeSignatures[site.name] !== signature) {
      this.sectionNodeSignatures[site.name] = signature;
      this.sectionNodes[site.name] = nodes;
    }
    return this.sectionNodes[site.name];
  }

  focusSection(site: SiteMigrationConfig, node: SitemapNode): void {
    this.focusedSectionIndexes[site.name] = node ? migrationSectionIndex(node.key) : -1;
  }

  focusedSection(site: SiteMigrationConfig): ParentPageConfig {
    return (site.parentPages || [])[this.focusedSectionIndexes[site.name]] || null;
  }

  sectionIndex(site: SiteMigrationConfig, parentPage: ParentPageConfig): number {
    return (site.parentPages || []).indexOf(parentPage);
  }

  contentSectionTitle(parentPage: ParentPageConfig): string {
    const path = parentPage.pathPrefix || parentPage.url || "New section";
    const finalSegment = path.split(/[/?#]/).filter(Boolean).pop() || path;
    return startCase(finalSegment.replace(/\.[a-z0-9]+$/i, ""));
  }

  contentSectionSummary(parentPage: ParentPageConfig): string {
    const landingPage = parentPage.parentPageMode === ParentPageMode.ACTION_BUTTONS ? "landing page with buttons"
      : parentPage.parentPageMode === ParentPageMode.AS_IS || parentPage.migrateParent ? "landing page and content"
        : "child pages only";
    const selectedChildren = parentPage.selectedChildren?.length;
    const childPages = selectedChildren ? `${selectedChildren} selected child ${selectedChildren === 1 ? "page" : "pages"}`
      : parentPage.migrateChildren ? "linked child pages" : "no child pages selected";
    return `${landingPage}; ${childPages}`;
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

  deleteParentPage(site: SiteMigrationConfig, parentPage: ParentPageConfig) {
    if (site.parentPages) {
      site.parentPages = site.parentPages.filter(item => item !== parentPage);
      this.focusedSectionIndexes[site.name] = -1;
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

  selectTab(tab: MigrationSettingsTab): void {
    this.activeTabId = tab;
    this.updateUrl();
  }

  private addLog(status: string, message: string): void {
    const now = this.dateUtils.dateTimeNowAsValue();
    const entry = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, status, time: now, message };
    this.logs = [entry, ...this.logs];
  }

  logSortChanged(sort: SortableTableSortState): void {
    this.logSortField = sort.key || "time";
    this.logSortDirection = sort.direction;
    this.updateUrl();
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
      this.updateUrl();
    } else {
      const h = this.selectedHistory;
      this.logs = (h.auditLog || []).map(log => ({ id: `${log.time}-${Math.random().toString(36).slice(2, 6)}`, status: log.status || "info", time: log.time || 0, message: log.message }));
      this.updateUrl();
    }
  }

  clearHistorySelection() {
    this.selectedHistory = null;
    this.logs = this.streamingLogs.slice();
    this.updateUrl();
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

  private appendLogEntry(log: MigrationActivityLog, historyId: string | null): void {
    this.logs = [log, ...this.logs];
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
    const queryParams: StoredValueQueryParameters = {
      [StoredValue.MIGRATION_LOG_SORT]: this.logSortField,
      [StoredValue.MIGRATION_LOG_SORT_ORDER]: this.logSortDirection,
      [StoredValue.SESSION]: this.selectedHistory?.createdDate ? this.sessionToUrlParam(this.selectedHistory.createdDate) : null,
      [StoredValue.TAB]: this.activeTabId
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: "merge"
    });
  }

  private sessionToUrlParam(createdDate: number): string {
    if (!createdDate) return "";
    return this.dateUtils.asString(createdDate, undefined, UIDateFormat.YEAR_MONTH_DAY_T_HHMM);
  }

}
