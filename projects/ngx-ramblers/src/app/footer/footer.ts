import { Component, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Footer, Ramblers } from "../models/system.model";
import { DateUtilsService } from "../services/date-utils.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { SystemConfigService } from "../services/system/system-config.service";

@Component({
  selector: "app-footer",
  template: `
    <div *ngIf="footer" class="footer bg-dark text-white py-5 container-fluid">
      <div class="row">
        <div class="col">
          <div class="container">
            <div class="row align-items-start">
              <div xs="12" class="position-relative py-0 mx-auto col-lg-3">
                <div class="text-center"><a [href]="national?.mainSite?.href"
                                            aria-current="page"
                                            class="d-inline-block image-link-focus py-0 active">
                  <img src="/assets/images/local/dark-bg-logo.svg" alt="Home"
                       class="d-block w-100 logo"></a></div>
                <div class="text-center">
                  <app-social-media-links/>
                </div>
              </div>
              <div class="col-sm-4 col-lg-3 col-12">
                <ul class="custom-nav list-unstyled text-center text-nowrap mb-5">
                  <p class="h5 mb-3 mb-lg-5 text-green">Quick links</p>
                  <ng-container *ngFor="let link of footer?.quickLinks">
                    <li placement="left"
                        [tooltip]="'View ' + link.title +' (opens a new browser tab)'"><a [href]="link.href">{{link.title}}</a></li>
                  </ng-container>
                </ul>
              </div>
              <div class="col-sm-4 col-lg-3 col-12">
                <ul class="custom-nav list-unstyled text-center text-nowrap mb-5">
                  <p class="h5 mb-3 mb-lg-5 text-green">Legals</p>
                  <ng-container *ngFor="let link of footer?.legals">
                    <li placement="left"
                        [tooltip]="'View ' + link.title +' (opens a new browser tab)'"><a
                      [href]="link.href">{{link.title}}</a></li>
                  </ng-container>
                </ul>
              </div>
              <div class="col-sm-4 col-lg-3 col-12">
                <ul class="custom-nav list-unstyled text-center text-nowrap mb-5">
                  <p class="h5 mb-3 mb-lg-5 text-green">Download the app</p>
                  <li *ngIf="footer.appDownloads.apple" placement="left"
                      tooltip="Download the Ramblers app on the Apple App Store (opens a new browser tab)">
                    <a [href]="footer.appDownloads.apple"
                       target="_blank" class="brand-badge"><img
                      alt="Download the Ramblers app on the Apple App Store (opens a new browser tab)"
                      src="/assets/images/local/apple-badge.svg" class="app-download-image"></a>
                  </li>
                  <li *ngIf="footer.appDownloads.google" placement="left"
                      tooltip="Download the Ramblers app on Google Play (opens a new browser tab)">
                    <a [href]="footer.appDownloads.google"
                       class="brand-badge"><img
                      alt="Download the Ramblers app on Google Play (opens a new browser tab)"
                      src="/assets/images/local/google-play-badge.png" class="app-download-image">
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div class="row logo-row-top pt-4 flex-column-reverse flex-md-row">
              <div class="col">
                <div class="text-center text-md-left"><p class="mb-2">
                  <small class="d-block">
                    Ramblers Charity England &amp; Wales No: 1093577 Scotland
                    No: SC039799
                  </small></p>
                  <p class="mb-0"><small>
                    ©&nbsp;Ramblers&nbsp;{{year}}
                  </small></p></div>
              </div>
              <div class="text-center text-md-right mt-2 mb-3 my-md-0 pr-md-0 col">
                <img src="/assets/images/local/fr-regulator-logo.png"
                     alt="Registered with Fundraising Regulator" width="162">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ["./footer.sass"]
})
export class FooterComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public year: number;
  public footer: Footer;
  private subscriptions: Subscription[] = [];
  protected national: Ramblers;
  constructor(private dateUtils: DateUtilsService,
              private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("FooterComponent", NgxLoggerLevel.OFF);
    this.logger.debug("constructed");
  }

  ngOnInit() {
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      return this.footer = item.footer;
      return this.national = item.national;
    }));
    this.year = this.dateUtils.currentYear();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


}
