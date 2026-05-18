import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faQuestion, faPencil } from "@fortawesome/free-solid-svg-icons";
import { RouterLink } from "@angular/router";
import { kebabCase } from "es-toolkit";
import { StoredValue } from "../../../../models/ui-actions";
import { DockedTo } from "../../../../models/docking.model";
import { NgxLoggerLevel } from "ngx-logger";
import { HelpInfo } from "../../../../models/member.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { NotificationConfig, NotificationConfigListing } from "../../../../models/mail.model";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { first } from "es-toolkit/compat";
import { BannerConfig } from "../../../../models/banner-configuration.model";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownComponent } from "ngx-markdown";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { ButtonWrapper } from "../../../../modules/common/third-parties/button-wrapper";

@Component({
    selector: "app-notification-config-selector",
    template: `
    @if (notificationConfig && notificationConfigListing?.mailMessagingConfig) {
      <div class="row align-items-center">
        <div class="col-sm-12">
          <div class="form-group">
            <label for="contact-member">Email Type</label>
            <div class="input-group">
              <select [compareWith]="notificationTypeConfigComparer" class="form-control input-sm"
                [disabled]="busy"
                [(ngModel)]="notificationConfig"
                (ngModelChange)="emailConfigChanged.emit($event)">
                @for (emailConfig of mailMessagingService.notificationConfigs(notificationConfigListing); track emailConfig.id) {
                  <option
                    [ngValue]="emailConfig"
                    class="form-control"
                    id="contact-member">{{ emailConfig?.subject?.text }}
                  </option>
                }
              </select>
              @if (notificationConfig?.id) {
                <a class="text-decoration-none"
                   routerLink="/admin/mail-settings"
                   [queryParams]="emailTypeQueryParams()"
                   target="_blank">
                  <app-button-wrapper button variant="quiet" [dockedTo]="DockedTo.RIGHT" [title]="'View or Edit Settings'">
                    <fa-icon [icon]="faPencil"/>
                  </app-button-wrapper>
                </a>
              }
            </div>
          </div>
        </div>
        @if (helpAvailable) {
          <div class="col-sm-3 panel-toggle">
            @if (!helpInfo.showHelp) {
              <a
                (click)="toggleHelp(true)" [href]="">
                <fa-icon [icon]="faQuestion" class="markdown-preview-icon"></fa-icon>
              show help</a>
            }
            @if (helpInfo.showHelp) {
              <a (click)="toggleHelp(false)" [href]="">
                <fa-icon [icon]="faQuestion" class="markdown-preview-icon"></fa-icon>
              hide help</a>
            }
          </div>
        }
      </div>
      @if (helpInfo.showHelp) {
        <div class="row">
          <div class="col-sm-12  p-4">
            <div markdown>
              <ul>
                <li>{{ helpMembers() }}</li>
                @if (notificationConfig?.help) {
                  <li>{{ notificationConfig?.help }}</li>
                }
              </ul>
            </div>
          </div>
        </div>
      }
      @if (showBranding) {
        <div class="row">
          <div class="col-sm-12">
            <div class="form-group">
              <label for="banner-lookup">Banner Image</label>
              <div class="input-group">
                <select class="form-control input-sm"
                  id="banner-lookup"
                  [(ngModel)]="notificationConfig.bannerId">
                  @for (banner of notificationConfigListing.mailMessagingConfig.banners; track banner.id) {
                    <option
                      [ngValue]="banner.id">{{ toBannerInformation(banner) }}
                    </option>
                  }
                </select>
                @if (selectedBannerSlug()) {
                  <a class="text-decoration-none"
                     routerLink="/admin/banners"
                     [queryParams]="bannerQueryParams()"
                     target="_blank">
                    <app-button-wrapper button variant="quiet" [dockedTo]="DockedTo.RIGHT" [title]="'View or Edit Banner'">
                      <fa-icon [icon]="faPencil"/>
                    </app-button-wrapper>
                  </a>
                }
              </div>
            </div>
          </div>
          @if (notificationConfig?.bannerId) {
            <div class="col-sm-12 mb-2">
              <img class="card-img"
                [src]="mailMessagingService.bannerImageSource(notificationConfig, false)">
            </div>
          }
          <div class="col-sm-12">
            <div class="form-group">
              <label for="template">Brevo Template</label>
              <div class="input-group">
                <select [(ngModel)]="notificationConfig.templateId"
                  id="template"
                  class="form-control input-sm">
                  @for (template of notificationConfigListing?.mailMessagingConfig?.brevo?.mailTemplates?.templates; track template.id) {
                    <option
                      [ngValue]="template.id">{{ template.name }}
                    </option>
                  }
                </select>
                <app-brevo-button button variant="quiet" [disabled]="!notificationConfig.templateId"
                  (click)="editTemplate(notificationConfig.templateId)"
                  [dockedTo]="DockedTo.RIGHT"
                  [title]="'View or Edit Template'"/>
              </div>
            </div>
          </div>
        </div>
      }
    }
    `,
    imports: [FormsModule, FontAwesomeModule, MarkdownComponent, BrevoButtonComponent, ButtonWrapper, RouterLink]
})

export class NotificationConfigSelectorComponent implements OnInit {

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("NotificationConfigSelectorComponent", NgxLoggerLevel.OFF);
  private mailLinkService: MailLinkService = inject(MailLinkService);
  private stringUtils: StringUtilsService = inject(StringUtilsService);
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  public helpInfo: HelpInfo = {showHelp: false, monthsInPast: 1};
  public busy: boolean;
  public includeWorkflowRelatedConfigs: boolean;
  public helpAvailable: boolean;
  faQuestion = faQuestion;
  faPencil = faPencil;

  @Input("includeWorkflowRelatedConfigs") set includeWorkflowRelatedConfigsValue(includeWorkflowRelatedConfigs: boolean) {
    this.includeWorkflowRelatedConfigs = coerceBooleanProperty(includeWorkflowRelatedConfigs);
  }

  @Input("busy") set busySaveValue(busy: boolean) {
    this.busy = coerceBooleanProperty(busy);
  }

  @Input("helpAvailable") set helpAvailableValue(helpAvailable: boolean) {
    this.helpAvailable = coerceBooleanProperty(helpAvailable);
  }

  @Input() public notificationConfig: NotificationConfig;
  @Input() public notificationConfigListing: NotificationConfigListing;
  @Input() public showBranding: boolean = true;
  @Output() emailConfigChanged: EventEmitter<NotificationConfig> = new EventEmitter();

  protected readonly first = first;
  protected readonly DockedTo = DockedTo;

  ngOnInit() {
    this.logger.info("constructed notificationConfig", this.notificationConfig, "notificationConfigListing:", this.notificationConfigListing);
  }

  notificationTypeConfigComparer(item1: NotificationConfig, item2: NotificationConfig): boolean {
    return item1?.id === item2?.id;
  }

  emailTypeQueryParams(): Record<string, string> {
    return {
      [StoredValue.TAB]: "email-configurations",
      [StoredValue.CONFIGURATION]: this.notificationConfigSlug() ?? this.notificationConfig.id ?? ""
    };
  }

  private notificationConfigSlug(): string | null {
    const text = this.notificationConfig?.subject?.text || this.notificationConfig?.id;
    return text ? kebabCase(text) : null;
  }

  bannerQueryParams(): Record<string, string> {
    return { [StoredValue.BANNER]: this.selectedBannerSlug() ?? "" };
  }

  selectedBannerSlug(): string | null {
    const bannerId = this.notificationConfig?.bannerId;
    if (!bannerId) return null;
    const banner = this.notificationConfigListing?.mailMessagingConfig?.banners?.find(item => item.id === bannerId);
    return banner?.name ? kebabCase(banner.name) : null;
  }

  toBannerInformation(bannerConfig: BannerConfig) {
    return `${bannerConfig.name || "Unnamed"} (${this.stringUtils.asTitle(bannerConfig.bannerType)})`;
  }

  editTemplate(templateId: number) {
    const templateUrl = this.mailLinkService.templateEdit(templateId);
    this.logger.info("editing template:", templateUrl);
    this.mailLinkService.openUrl(templateUrl);
  }

  helpMembers() {
    return `In the member selection field, choose the members that you want to send a ${this.notificationConfig.subject.text} email to. You can type in  part of their name to find them more quickly. Repeat this step as many times as required to build up a list of members`;
  }

  toggleHelp(show: boolean) {
    this.logger.debug("tooltip:", show);
    this.helpInfo.showHelp = show;
  }

}
