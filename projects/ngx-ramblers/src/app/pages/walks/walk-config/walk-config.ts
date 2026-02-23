import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { first, kebabCase } from "es-toolkit/compat";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { ActivatedRoute, Router } from "@angular/router";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { ContentText, ContentTextCategory, View } from "../../../models/content-text.model";
import { MeetupConfig } from "../../../models/meetup-config.model";
import { StoredValue } from "../../../models/ui-actions";
import { WalkConfigTab, WalksConfig } from "../../../models/walk-notification.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { ContentTextService } from "../../../services/content-text.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { MeetupService } from "../../../services/meetup.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { MarkdownComponent } from "ngx-markdown";
import {
  WalkMeetupConfigParametersComponent
} from "../walk-meetup-config-parameters/walk-meetup-config-parameters.component";

@Component({
  selector: "app-walk-config",
  template: `
    <app-page>
      <h3 class="card-title mb-4" style="margin-left: 1rem;">Walk Configuration
        <fa-icon [icon]="faGear" class="fa-2x ramblers ms-2"/>
      </h3>
      <div class="card-text">
        <div class="col-sm-12">
          <tabset class="custom-tabset">
            <tab [active]="tabActive(WalkConfigTab.GENERAL)"
                 (selectTab)="selectTab(WalkConfigTab.GENERAL)"
                 [heading]="WalkConfigTab.GENERAL">
              <div class="img-thumbnail thumbnail-admin-edit">
                @if (walksConfig) {
                  <div>
                    <div class="form-group mb-3">
                      <label for="miles-per-hour">Miles per hour (default walking pace)</label>
                      <input [(ngModel)]="walksConfig.milesPerHour"
                             type="number"
                             class="form-control input-sm"
                             id="miles-per-hour"
                             step="0.01"
                             min="0"
                             placeholder="Default miles per hour">
                    </div>
                    <div class="form-check mb-2">
                      <input [(ngModel)]="walksConfig.requireRiskAssessment"
                             type="checkbox"
                             class="form-check-input"
                             id="require-risk-assessment">
                      <label class="form-check-label" for="require-risk-assessment">Require risk assessment to be completed before approving walks</label>
                    </div>
                    <div class="form-check mb-2">
                      <input [(ngModel)]="walksConfig.requireFinishTime"
                             type="checkbox"
                             class="form-check-input"
                             id="require-finish-time">
                      <label class="form-check-label" for="require-finish-time">Require estimated finish time to be entered</label>
                    </div>
                    <div class="form-check mb-2">
                      <input [(ngModel)]="walksConfig.requireWalkLeaderDisplayName"
                             type="checkbox"
                             class="form-check-input"
                             id="require-walk-leader-display-name">
                      <label class="form-check-label" for="require-walk-leader-display-name">Require walk leader display name to be entered</label>
                    </div>
                  </div>
                }
              </div>
            </tab>
            <tab [active]="tabActive(WalkConfigTab.MEETUP)"
                 (selectTab)="selectTab(WalkConfigTab.MEETUP)"
                 [heading]="WalkConfigTab.MEETUP">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="mb-2">
                  <ul class="list-arrow">
                    <li>Here you can configure content text that will automatically be added to the beginning of
                      the walk description on Meetup events we create.
                    </li>
                  </ul>
                  <div class="row mb-2">
                    <div class="col-sm-12">
                      <div class="d-inline-flex align-items-end flex-wrap gap-2">
                        <div class="form-group">
                          <label for="type" class="inline-label">Content item: </label>
                          <select [ngModel]="selectedContent"
                                  (ngModelChange)="onChange($event)"
                                  class="form-control"
                                  id="type">
                            @for (contentText of contentTextItems; track contentText.id) {
                              <option [ngValue]="contentText" [textContent]="contentText.name"></option>
                            }
                          </select>
                        </div>
                        <div class="form-group">
                          <input type="submit" value="Add new content" (click)="addNewContent()"
                                 title="Add new content"
                                 class="btn btn-primary">
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-sm-12">
                      <div class="mt-2 mb-2 font-weight-bold">{{ selectedContent?.name }} content:</div>
                      @for (content of contentTextItems; track content.id) {
                        @if (matching(content, selectedContent)) {
                          <div>
                            <app-markdown-editor [data]="content"
                                                 [editNameEnabled]="true"
                                                 [deleteEnabled]="true"
                                                 [id]="content.name"
                                                 [initialView]="View.EDIT"
                                                 [rows]="8"/>
                          </div>
                        }
                      }
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab [active]="tabActive(WalkConfigTab.PUBLISHING_DEFAULTS)"
                 (selectTab)="selectTab(WalkConfigTab.PUBLISHING_DEFAULTS)"
                 [heading]="WalkConfigTab.PUBLISHING_DEFAULTS">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div markdown class="list-arrow b-2">
                  <ul>
                    <li>Here you can configure default settings that will be used when creating Meetup events.</li>
                  </ul>
                </div>
                @if (meetupConfig) {
                  <app-walk-meetup-config-parameters [config]="meetupConfig"
                                                     [contentTextItems]="contentTextItems"/>
                }
              </div>
            </tab>
          </tabset>
          <div class="form-group">
            @if (notifyTarget.showAlert) {
              <div class="alert {{notifyTarget.alertClass}}">
                <fa-icon [icon]="notifyTarget.alert.icon"/>
                <strong> {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
              </div>
            }
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <input type="submit" value="Save" (click)="save()"
                   title="Save"
                   class="btn btn-success">
            <input type="submit" value="Back To Walks Admin" (click)="backToWalksAdmin()"
                   title="Back to walks"
                   class="btn btn-secondary">
          </div>
        </div>
      </div>
    </app-page>
  `,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, FontAwesomeModule, TabsetComponent, TabDirective, FormsModule, MarkdownEditorComponent, MarkdownComponent, WalkMeetupConfigParametersComponent]
})
export class WalkConfigComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkConfigComponent", NgxLoggerLevel.ERROR);
  private urlService = inject(UrlService);
  private contentTextService = inject(ContentTextService);
  private meetupService = inject(MeetupService);
  private walksConfigService = inject(WalksConfigService);
  private broadcastService = inject<BroadcastService<ContentText>>(BroadcastService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  protected notifierService = inject(NotifierService);
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public contentTextItems: ContentText[] = [];
  public selectedContent: ContentText;
  addNew: boolean;
  public meetupConfig: MeetupConfig;
  public walksConfig: WalksConfig;
  faGear = faGear;
  private tab: WalkConfigTab = WalkConfigTab.GENERAL;
  private subscriptions: Subscription[] = [];

  protected readonly View = View;
  protected readonly WalkConfigTab = WalkConfigTab;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.meetupService.queryConfig().then(config => this.meetupConfig = config);
    this.walksConfig = {...this.walksConfigService.default(), ...this.walksConfigService.walksConfig()};
    this.subscriptions.push(this.walksConfigService.events().subscribe(config => this.walksConfig = config));
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      this.tab = params[StoredValue.TAB] || kebabCase(WalkConfigTab.GENERAL);
    }));
    this.contentTextService.filterByCategory(ContentTextCategory.MEETUP_DESCRIPTION_PREFIX).then(contentTextItems => {
      this.logger.debug("forCategory", ContentTextCategory.MEETUP_DESCRIPTION_PREFIX + ":", contentTextItems);
      this.contentTextItems = contentTextItems;
      this.onChange(first(this.contentTextItems));
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_SYNCED, (event: NamedEvent<ContentText>) => this.replaceContent(event.data));
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_DELETED, (event: NamedEvent<ContentText>) => this.removeContent(event.data));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  tabActive(tab: WalkConfigTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  selectTab(tab: WalkConfigTab) {
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
  }

  backToWalksAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  private replaceContent(contentText: ContentText) {
    if (contentText.category === ContentTextCategory.MEETUP_DESCRIPTION_PREFIX) {
      this.logger.debug("Received updated content", contentText);
      const existingContent: ContentText = this.contentTextItems.find(item => !item.name || (item.name === contentText.name));
      if (existingContent) {
        this.contentTextItems[(this.contentTextItems.indexOf(existingContent))] = contentText;
        this.onChange(contentText);
      } else {
        this.contentTextItems.push(contentText);
        this.onChange(contentText);
      }
    }
  }

  private removeContent(contentText: ContentText) {
    if (contentText.category === ContentTextCategory.MEETUP_DESCRIPTION_PREFIX) {
      this.logger.debug("Received deleted content", contentText);
      this.contentTextItems = this.contentTextItems.filter(item => item.id !== contentText.id);
    }
  }

  addNewContent() {
    this.addNew = true;
    const newContent = {category: ContentTextCategory.MEETUP_DESCRIPTION_PREFIX, text: "Replace with text that will be used as a prefix for the walk description", name: "Enter name of Content"};
    this.logger.debug("adding new content", newContent);
    this.selectedContent = newContent;
    this.contentTextItems.push(newContent);
  }

  onChange(content: ContentText) {
    this.logger.debug("selected content text:", content);
    this.selectedContent = content;
  }

  matching(content: ContentText, selectedContent: ContentText) {
    return content && selectedContent && content.name === selectedContent.name;
  }

  save() {
    this.walksConfigService.saveConfig(this.walksConfig)
      .then(() => this.meetupService.saveConfig(this.notify, this.meetupConfig));
  }
}
