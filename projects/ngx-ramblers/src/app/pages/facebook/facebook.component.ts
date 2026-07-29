import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit
} from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { faFacebook } from "@fortawesome/free-brands-svg-icons";
import { Facebook } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { CardContainerComponent } from "../../modules/common/card-container/card-container.component";

@Component({
  selector: "app-facebook",
  template: `
    <app-card-container [icon]="faFacebook" title="Facebook" [subtitle]="pageName" [href]="facebook?.groupUrl"
                        [brandColour]="brandColour">
      @if (scriptSrcUrl) {
        <script async defer crossorigin="anonymous"
                [src]="scriptSrcUrl" nonce="eTzjlWCO"></script>
      }
      @if (pluginUrl) {
        <div class="facebook-feed" [style.height.px]="height">
          <iframe [width]="width" [height]="pluginHeight" [src]="pluginUrl" title="Facebook page feed"
                  [style.width.px]="width" [style.height.px]="pluginHeight"
                  [style.transform]="'scale(' + scale + ')'"></iframe>
        </div>
      }
    </app-card-container>
  `,
  styleUrls: ["./facebook.component.sass"],
  imports: [CardContainerComponent]
})
export class FacebookComponent implements OnInit, AfterViewInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("FacebookComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private sanitiser = inject(DomSanitizer);
  private host = inject(ElementRef<HTMLElement>);
  private changeDetector = inject(ChangeDetectorRef);
  private readonly minimumWidth = 180;
  private readonly maximumWidth = 500;
  private readonly maximumScale = 1.6;
  public facebook: Facebook;
  public pageName = "";
  public width = this.maximumWidth;
  public height = 520;
  public pluginHeight = 520;
  public scale = 1;
  version = "v20.0";
  pluginUrl: SafeResourceUrl;
  scriptSrcUrl: SafeResourceUrl;
  private subscriptions: Subscription[] = [];
  protected readonly faFacebook = faFacebook;
  protected readonly brandColour = "#1877f2";

  @HostListener("window:resize")
  onResize() {
    this.applyAvailableWidth();
  }

  private measuredWidth(): number {
    const body: HTMLElement = this.host?.nativeElement?.querySelector(".social-card-body");
    if (!body) {
      return this.maximumWidth;
    } else {
      const styles = getComputedStyle(body);
      const contentWidth = body.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      return Math.floor(contentWidth) || this.maximumWidth;
    }
  }

  private applyAvailableWidth(): void {
    const measured = this.measuredWidth();
    const width = Math.max(this.minimumWidth, Math.min(measured, this.maximumWidth));
    const scale = Math.min(Math.max(measured / width, 1), this.maximumScale);
    if (width !== this.width || scale !== this.scale) {
      this.width = width;
      this.scale = scale;
      this.pluginHeight = Math.round(this.height / scale);
      this.refreshPluginUrl();
    }
  }

  private parameters(): string {
    return [
      `href=${this?.facebook?.groupUrl}`,
      "tabs=timeline",
      `width=${this.width}`,
      `height=${this.pluginHeight}`,
      "small_header=false",
      "adapt_container_width=true",
      "hide_cover=false",
      "show_facepile=true",
      `appId=${this?.facebook?.appId}`
    ].join("&");
  }

  private refreshPluginUrl(): void {
    if (this.facebook?.groupUrl) {
      this.pluginUrl = this.sanitiser.bypassSecurityTrustResourceUrl(`https://www.facebook.com/plugins/page.php?${this.parameters()}`);
      this.logger.info("refreshed facebook plugin url at width:", this.width);
    }
  }

  ngOnInit() {
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.facebook = item.externalSystems.facebook;
      this.pageName = this.facebook?.groupUrl ? this.facebook.groupUrl.replace(/\/+$/, "").split("/").pop() : "";
      this.refreshPluginUrl();
      this.scriptSrcUrl = this.sanitiser.bypassSecurityTrustResourceUrl(`https://connect.facebook.net/en_GB/sdk.js#xfbml=1&version=${this.version}&appId=${this.facebook.appId}`);
      this.logger.info("facebook:", this.facebook, "width:", this.width);
    }));
  }

  ngAfterViewInit(): void {
    this.applyAvailableWidth();
    this.changeDetector.detectChanges();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
