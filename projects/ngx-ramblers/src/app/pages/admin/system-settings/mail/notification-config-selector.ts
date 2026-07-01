import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faQuestion, faPencil } from "@fortawesome/free-solid-svg-icons";
import { AdminPath } from "../../../../models/admin-route-paths.model";
import { RouterLink } from "@angular/router";
import { kebabCase } from "es-toolkit";
import { StoredValue } from "../../../../models/ui-actions";
import { DockedTo } from "../../../../models/docking.model";
import { NgxLoggerLevel } from "ngx-logger";
import { HelpInfo } from "../../../../models/member.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { NotificationConfig, NotificationConfigListing } from "../../../../models/mail.model";
import { first } from "es-toolkit/compat";
import { BannerConfig } from "../../../../models/banner-configuration.model";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownComponent } from "ngx-markdown";
import { ButtonWrapper } from "../../../../modules/common/third-parties/button-wrapper";

@Component({
    selector: "app-notification-config-selector",
    template: `
    @if (notificationConfigListing?.mailMessagingConfig) {
      @let showBannerImage = showBranding && notificationConfig?.bannerId;
      <div class="row align-items-center">
        <div [class]="showBannerImage ? 'col-lg-7' : 'col-sm-12'">
          <div class="form-group">
            <label for="contact-member">Email Type</label>
            <div class="input-group">
              <select [compareWith]="notificationTypeConfigComparer" class="form-control input-sm"
                [disabled]="busy"
                [(ngModel)]="notificationConfig"
                (ngModelChange)="emailConfigChanged.emit($event)">
                @if (!notificationConfig) {
                  <option [ngValue]="null" disabled>Choose an email type</option>
                }
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
                   [routerLink]="'/' + adminMailSettingsPath"
                   [queryParams]="emailTypeQueryParams()"
                   target="_blank">
                  <app-button-wrapper button variant="quiet" [dockedTo]="DockedTo.RIGHT" [title]="'View or Edit Settings'">
                    <fa-icon [icon]="faPencil"/>
                  </app-button-wrapper>
                </a>
              }
            </div>
          </div>
          @if (notificationConfig && showBranding) {
            <div class="form-group mb-0">
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
                     [routerLink]="'/' + adminBannersPath"
                     [queryParams]="bannerQueryParams()"
                     target="_blank">
                    <app-button-wrapper button variant="quiet" [dockedTo]="DockedTo.RIGHT" [title]="'View or Edit Banner'">
                      <fa-icon [icon]="faPencil"/>
                    </app-button-wrapper>
                  </a>
                }
              </div>
            </div>
          }
        </div>
        @if (showBannerImage) {
          <div class="col-lg-5 mt-3 mt-lg-0">
            <img class="img-fluid w-100 rounded"
              [src]="mailMessagingService.bannerImageSource(notificationConfig, false)">
          </div>
        }
        @if (helpAvailable && notificationConfig) {
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
      @if (notificationConfig && helpInfo.showHelp) {
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
    }
    `,
    imports: [FormsModule, FontAwesomeModule, MarkdownComponent, ButtonWrapper, RouterLink]
})

export class NotificationConfigSelectorComponent implements OnInit {
  adminMailSettingsPath = AdminPath.MAIL_SETTINGS;
  adminBannersPath = AdminPath.BANNERS;

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("NotificationConfigSelectorComponent", NgxLoggerLevel.OFF);
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

  helpMembers() {
    return `In the member selection field, choose the members that you want to send a ${this.notificationConfig.subject.text} email to. You can type in  part of their name to find them more quickly. Repeat this step as many times as required to build up a list of members`;
  }

  toggleHelp(show: boolean) {
    this.logger.debug("tooltip:", show);
    this.helpInfo.showHelp = show;
  }

}
