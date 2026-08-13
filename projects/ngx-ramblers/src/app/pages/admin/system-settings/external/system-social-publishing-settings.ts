import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faFacebook, faInstagram } from "@fortawesome/free-brands-svg-icons";
import { SystemConfig } from "../../../../models/system.model";
import { AlertTarget } from "../../../../models/alert-target.model";
import {
  DEFAULT_EVENT_CAPTION_TEMPLATE,
  EventCaptionToken,
  FacebookPageOption,
  FacebookPostStyle
} from "../../../../models/social-publish.model";
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { values } from "es-toolkit/compat";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { SocialPublishService } from "../../../../services/social/social-publish.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { UrlService } from "../../../../services/url.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { FacebookButton } from "../../../../modules/common/third-parties/facebook-button";
import { InstagramButton } from "../../../../modules/common/third-parties/instagram-button";
import { InputSize } from "../../../../models/ui-size.model";
import { UIDateFormat } from "../../../../models/date-format.model";

@Component({
  selector: "app-system-social-publishing-settings",
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Publish walk albums to Facebook and Instagram</div>
      <div class="col-sm-12">
        @if (config?.externalSystems) {
          <p class="mb-2">
            Connect your group or area's Facebook Page to publish walk photo albums to Facebook and Instagram.
            Follow the <a href="https://www.ngx-ramblers.org.uk/how-to/technical-articles/2026-07-10-meta-approval-facebook-instagram" target="_blank" rel="noopener noreferrer">setup guide</a>
            to create the Meta app, then connect below. The linked Instagram account is found for you automatically.
          </p>
          <div class="row align-items-end">
            <div class="col-md-6">
              <div class="form-group">
                <label for="facebook-app-id">Facebook App ID</label>
                <input [(ngModel)]="config.externalSystems.facebook.appId" id="facebook-app-id"
                       type="text" class="form-control input-sm" placeholder="From your Meta app">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="facebook-app-secret">Facebook App Secret</label>
                <app-secret-input [(ngModel)]="config.externalSystems.facebook.appSecret" id="facebook-app-secret"
                                  name="appSecret" [size]="InputSize.SM" placeholder="From your Meta app">
                </app-secret-input>
              </div>
            </div>
          </div>
          <app-facebook-button button title="Connect Facebook"
                               [disabled]="!config.externalSystems.facebook.appId || connecting"
                               (click)="connectFacebook()"/>
          <div class="mt-3">
            <a class="small" (click)="showAdvanced = !showAdvanced" [style.cursor]="'pointer'">
              {{ showAdvanced ? "Hide" : "Advanced: paste an access token instead" }}
            </a>
          </div>
          @if (showAdvanced) {
            <div class="row align-items-end mt-1">
              <div class="col-md-8">
                <div class="form-group">
                  <label for="social-access-token">Access token</label>
                  <app-secret-input [(ngModel)]="accessToken" id="social-access-token" name="accessToken"
                                    [size]="InputSize.SM" placeholder="Paste a Page or system-user access token">
                  </app-secret-input>
                </div>
              </div>
              <div class="col-md-4">
                <div class="form-group">
                  <app-facebook-button button title="Find my Pages"
                                       [disabled]="!accessToken || finding" (click)="findPages()"/>
                </div>
              </div>
            </div>
          }
          @if (pages.length > 0) {
            <div class="form-group mt-2">
              <label for="social-page">Page to publish to</label>
              <select [(ngModel)]="selectedPageId" id="social-page" class="form-control input-sm"
                      (ngModelChange)="onPageSelected()">
                <option [ngValue]="undefined" disabled>Choose a Page…</option>
                @for (page of pages; track page.pageId) {
                  <option [ngValue]="page.pageId">{{ page.name }}</option>
                }
              </select>
            </div>
          }
          @if (connectedPageName) {
            <div class="mt-2 mb-2">
              <div><fa-icon [icon]="faFacebook"/> Facebook Page: <strong>{{ connectedPageName }}</strong></div>
              <div>
                <fa-icon [icon]="faInstagram"/> Instagram:
                @if (instagramLinked) {
                  <strong>linked and ready</strong>
                } @else {
                  <span>no Instagram account is linked to this Page — link one in the Facebook Page settings to enable Instagram</span>
                }
              </div>
              @if (tokenHealthMessage) {
                <div class="small text-muted">{{ tokenHealthMessage }}</div>
              }
            </div>
            <div class="form-check">
              <input [(ngModel)]="config.externalSystems.facebook.publishingEnabled"
                     type="checkbox" class="form-check-input" id="facebook-publishing-enabled">
              <label class="form-check-label" for="facebook-publishing-enabled">Publish walk albums to Facebook</label>
            </div>
            <div class="form-check mb-2">
              <input [(ngModel)]="config.externalSystems.instagram.publishingEnabled"
                     type="checkbox" class="form-check-input" id="instagram-publishing-enabled"
                     [disabled]="!instagramLinked">
              <label class="form-check-label" for="instagram-publishing-enabled">Publish walk albums to Instagram</label>
            </div>
            <div class="d-inline-flex align-items-center flex-wrap gap-2">
              <app-facebook-button button title="Test Facebook" (click)="testFacebook()"/>
              @if (instagramLinked) {
                <app-instagram-button button title="Test Instagram" (click)="testInstagram()"/>
              }
              <app-facebook-button button title="Check token" (click)="checkTokenHealth()"/>
            </div>
            <div class="mt-4">
              <div class="thumbnail-heading">Publish walks and social events</div>
              <div class="alert alert-warning d-flex align-items-start mt-2">
                <fa-icon class="me-2 mt-1" [icon]="faCircleExclamation"/>
                <div>
                  <strong>Facebook Events cannot be created automatically</strong>
                  <div>Meta's API does not allow any app to create a Facebook Event, so these are published as Page
                    posts linking back to the event on this site. Posts reach the same feed, but give no RSVP list and
                    no entry in the Page's Events tab.
                  </div>
                </div>
              </div>
              <div class="form-check">
                <input [(ngModel)]="config.externalSystems.facebook.eventPublishingEnabled"
                       type="checkbox" class="form-check-input" id="facebook-event-publishing-enabled">
                <label class="form-check-label" for="facebook-event-publishing-enabled">
                  Allow walks and social events to be published to Facebook
                </label>
              </div>
              <div class="form-check">
                <input [(ngModel)]="config.externalSystems.instagram.eventPublishingEnabled"
                       type="checkbox" class="form-check-input" id="instagram-event-publishing-enabled"
                       [disabled]="!instagramLinked">
                <label class="form-check-label" for="instagram-event-publishing-enabled">
                  Allow walks and social events to be published to Instagram
                </label>
              </div>
              @if (config.externalSystems.instagram.eventPublishingEnabled) {
                <div class="alert alert-warning d-flex align-items-start mt-2">
                  <fa-icon class="me-2 mt-1" [icon]="faCircleExclamation"/>
                  <div>
                    <strong>Instagram works differently</strong>
                    <div>Instagram captions cannot contain clickable links, so the link back to the event appears as
                      plain text. An event with no image cannot be posted to Instagram at all and will be skipped.
                    </div>
                  </div>
                </div>
              }
              <div class="form-check mb-2">
                <input [(ngModel)]="config.externalSystems.facebook.eventRepublishOnChange"
                       type="checkbox" class="form-check-input" id="facebook-event-republish"
                       [disabled]="!config.externalSystems.facebook.eventPublishingEnabled">
                <label class="form-check-label" for="facebook-event-republish">
                  Post again when a published event is rescheduled or cancelled
                </label>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label for="facebook-event-post-style">Post style</label>
                    <select [(ngModel)]="config.externalSystems.facebook.eventPostStyle" id="facebook-event-post-style"
                            class="form-control input-sm"
                            [disabled]="!config.externalSystems.facebook.eventPublishingEnabled">
                      <option [ngValue]="FacebookPostStyle.LINK_PREVIEW">Link with preview card</option>
                      <option [ngValue]="FacebookPostStyle.PHOTO_WITH_LINK">Photos with link in the text</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label for="facebook-event-caption-template">Post text</label>
                    <textarea [(ngModel)]="config.externalSystems.facebook.eventCaptionTemplate"
                              id="facebook-event-caption-template" rows="6" class="form-control input-sm"
                              [disabled]="!config.externalSystems.facebook.eventPublishingEnabled"
                              [placeholder]="DEFAULT_EVENT_CAPTION_TEMPLATE"></textarea>
                    <small class="text-muted">Available placeholders: {{ captionTokens }}. A line whose placeholders are
                      all empty is left out.</small>
                  </div>
                </div>
              </div>
            </div>
          }
          @if (notifyTarget.showAlert) {
            <div class="alert mt-2 {{ notifyTarget.alertClass }}">
              <fa-icon [icon]="notifyTarget.alert.icon"/>
              @if (notifyTarget.alertTitle) {
                <strong>{{ notifyTarget.alertTitle }}: </strong>
              } {{ notifyTarget.alertMessage }}
            </div>
          }
        }
      </div>
    </div>`,
  imports: [FormsModule, FontAwesomeModule, SecretInputComponent, FacebookButton, InstagramButton]
})
export class SystemSocialPublishingSettings implements OnInit, OnDestroy {

  public config: SystemConfig;
  protected accessToken = "";
  protected pages: FacebookPageOption[] = [];
  protected selectedPageId: string;
  protected finding = false;
  protected connecting = false;
  protected showAdvanced = false;
  protected tokenHealthMessage = "";
  private subscriptions: Subscription[] = [];

  protected readonly InputSize = InputSize;
  protected readonly faFacebook = faFacebook;
  protected readonly faInstagram = faInstagram;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly FacebookPostStyle = FacebookPostStyle;
  protected readonly DEFAULT_EVENT_CAPTION_TEMPLATE = DEFAULT_EVENT_CAPTION_TEMPLATE;
  protected readonly captionTokens = values(EventCaptionToken).map(token => `{${token}}`).join(", ");

  private systemConfigService = inject(SystemConfigService);
  private socialPublishService = inject(SocialPublishService);
  private notifierService = inject(NotifierService);
  private activatedRoute = inject(ActivatedRoute);
  private urlService = inject(UrlService);
  private dateUtils = inject(DateUtilsService);
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  ngOnInit() {
    this.subscriptions.push(this.systemConfigService.events().subscribe(config => {
      this.config = config;
      this.ensureInitialised();
    }));
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const code = params["code"];
      const state = params["state"];
      if (code && state !== "meetup" && (state === "facebook" || !state)) {
        this.completeOAuth(code);
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private ensureInitialised(): void {
    if (this.config?.externalSystems && !this.config.externalSystems.facebook) {
      this.config.externalSystems.facebook = {};
    }
    if (this.config?.externalSystems && !this.config.externalSystems.instagram) {
      this.config.externalSystems.instagram = {};
    }
  }

  private redirectUri(): string {
    return window.location.origin + window.location.pathname;
  }

  get connectedPageName(): string {
    const pageId = this.config?.externalSystems?.facebook?.pageId;
    const match = this.pages.find(page => page.pageId === pageId);
    return match?.name || (pageId ? "connected" : "");
  }

  get instagramLinked(): boolean {
    return !!this.config?.externalSystems?.instagram?.igUserId;
  }

  async connectFacebook() {
    this.connecting = true;
    this.notify.progress({title: "Facebook", message: "Opening Facebook to connect"});
    try {
      const url = await this.socialPublishService.facebookOAuthUrl(this.redirectUri(), "facebook");
      window.location.href = url;
    } catch (error) {
      this.connecting = false;
      this.notify.error({title: "Could not start Facebook connect", message: error?.error?.error || error?.message || error});
    }
  }

  private async completeOAuth(code: string) {
    this.notify.progress({title: "Facebook", message: "Completing connection"});
    try {
      this.pages = await this.socialPublishService.facebookOAuthExchange(code, this.redirectUri());
      this.urlService.removeQueryParameter("code");
      this.urlService.removeQueryParameter("state");
      if (this.pages.length === 1) {
        this.selectedPageId = this.pages[0].pageId;
        this.onPageSelected();
      } else if (this.pages.length === 0) {
        this.notify.warning({title: "No Pages found", message: "This Facebook account does not manage any Pages"});
      } else {
        this.notify.success({title: "Connected", message: "Choose the Page to publish to"});
      }
    } catch (error) {
      this.notify.error({title: "Facebook connect failed", message: error?.error?.error || error?.message || error});
    }
  }

  async findPages() {
    this.finding = true;
    this.notify.progress({title: "Facebook", message: "Finding your Pages"});
    try {
      this.pages = await this.socialPublishService.discoverPages(this.accessToken);
      if (this.pages.length === 0) {
        this.notify.warning({title: "No Pages found", message: "This token does not manage any Facebook Pages"});
      } else {
        this.notify.hide();
        if (this.pages.length === 1) {
          this.selectedPageId = this.pages[0].pageId;
          this.onPageSelected();
        }
      }
    } catch (error) {
      this.notify.error({title: "Could not find Pages", message: error?.error?.error || error?.message || error});
    } finally {
      this.finding = false;
    }
  }

  onPageSelected(): void {
    const page = this.pages.find(candidate => candidate.pageId === this.selectedPageId);
    if (page) {
      this.config.externalSystems.facebook.pageId = page.pageId;
      this.config.externalSystems.facebook.pageAccessToken = page.pageAccessToken;
      this.config.externalSystems.instagram.igUserId = page.instagramUserId;
      this.notify.success({title: "Page connected", message: `${page.name}. Click Save to store these settings.`});
    }
  }

  async testFacebook() {
    this.notify.progress({title: "Facebook", message: "Checking connection"});
    try {
      const status = await this.socialPublishService.facebookStatus();
      if (status.connected) {
        this.notify.success({title: "Facebook connected", message: `Publishing to ${status.name || "the Page"}`});
      } else {
        this.notify.warning({title: "Facebook not connected", message: status.error});
      }
    } catch (error) {
      this.notify.error({title: "Facebook connection failed", message: error});
    }
  }

  async testInstagram() {
    this.notify.progress({title: "Instagram", message: "Checking connection"});
    try {
      const status = await this.socialPublishService.instagramStatus();
      if (status.connected) {
        this.notify.success({title: "Instagram connected", message: `Publishing as ${status.name || "the account"}`});
      } else {
        this.notify.warning({title: "Instagram not connected", message: status.error});
      }
    } catch (error) {
      this.notify.error({title: "Instagram connection failed", message: error});
    }
  }

  async checkTokenHealth() {
    this.notify.progress({title: "Facebook", message: "Checking the token"});
    try {
      const health = await this.socialPublishService.facebookTokenHealth();
      if (!health.valid) {
        this.tokenHealthMessage = "";
        this.notify.warning({title: "Token not valid", message: health.error || "Reconnect the Page"});
      } else if (health.neverExpires) {
        this.tokenHealthMessage = "Access token is valid and does not expire.";
        this.notify.success({title: "Token valid", message: this.tokenHealthMessage});
      } else {
        const on = this.dateUtils.asString(health.expiresAt * 1000, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED);
        this.tokenHealthMessage = `Access token is valid until ${on}.`;
        this.notify.success({title: "Token valid", message: this.tokenHealthMessage});
      }
    } catch (error) {
      this.notify.error({title: "Token check failed", message: error});
    }
  }
}
