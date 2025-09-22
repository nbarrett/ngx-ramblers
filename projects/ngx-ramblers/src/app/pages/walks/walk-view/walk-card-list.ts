import { Component, inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DisplayedWalk, EventType, WalkViewMode } from "../../../models/walk.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MeetupService } from "../../../services/meetup.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Organisation, SystemConfig } from "../../../models/system.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { BasicMedia } from "../../../models/ramblers-walks-manager";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { LoginModalComponent } from "../../login/login-modal/login-modal.component";
import { SvgComponent } from "../../../modules/common/svg/svg";
import { NgClass } from "@angular/common";
import { WalkCardViewComponent } from "./walk-card-view";
import { WalkViewComponent } from "./walk-view";
import { WalkEditComponent } from "../walk-edit/walk-edit.component";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { TrackByService } from "../../../services/track-by.service";

@Component({
    selector: "app-walk-card-list",
    template: `
    <div class="d-flex flex-column pt-2 mb-2">
      @if (false) {
        <div class="heading d-flex align-items-center mb-3">
          <button aria-label="Previous slide" class="text-dark border-0 bg-transparent p-0 me-1">
            <app-svg (click)="prevSlide()"
              [disabled]="backDisabled()"
              class="icon"
              height="36"
              width="36"
              icon="i-back-round">
            </app-svg>
            <span class="visually-hidden">Previous slide</span></button>
            <button aria-label="Next slide" class="text-dark border-0 bg-transparent p-0">
              <app-svg (click)="nextSlide()"
                [disabled]="forwardDisabled()"
                class="icon"
                height="36"
                width="36"
                icon="i-forward-round">
              </app-svg>
              <span class="visually-hidden">Next slide</span></button>
            </div>
          }
          <div class="row">
            @for (displayedWalk of currentPageWalks; let index = $index; track trackByService.displayedWalk(index, displayedWalk)) {
              <div
                [ngClass]="{'pt-2 mb-3 col-lg-4 col-md-6 col-sm-12': !viewExpanded(displayedWalk.walk), 'w-100': viewExpanded(displayedWalk.walk)}"
                class="d-flex flex-column">
                @if (cardViewDisplay(displayedWalk.walk)) {
                  <app-walk-card-view class="card shadow clickable h-100"
                    [displayedWalk]="displayedWalk" [index]="index"/>
                }
                @if (expandedViewDisplay(displayedWalk.walk)) {
                  <app-walk-view [displayedWalk]="displayedWalk" [index]="index"/>
                }
                @if (walkEditDisplay(displayedWalk.walk)) {
                  <app-walk-edit
                    [displayedWalk]="displayedWalk"/>
                }
              </div>
            }
          </div>
        </div>`,
    styleUrls: ["./walk-view.sass"],
    styles: [`
  `],
    imports: [SvgComponent, NgClass, WalkCardViewComponent, WalkViewComponent, WalkEditComponent]
})
export class WalkCardListComponent implements OnInit, OnChanges, OnDestroy {
  public config: ModalOptions = {
    animated: false,
    initialState: {}
  };
  public group: Organisation;
  public loggedIn: boolean;
  private subscriptions: Subscription[] = [];
  public notifyTarget: AlertTarget = {};
  public mediaQueryService: MediaQueryService = inject(MediaQueryService);
  private modalService: BsModalService = inject(BsModalService);
  public googleMapsService = inject(GoogleMapsService);
  private memberLoginService = inject(MemberLoginService);
  public display = inject(WalkDisplayService);
  public meetupService = inject(MeetupService);
  protected stringUtils = inject(StringUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private logger = inject(LoggerFactory).createLogger("WalkCardViewComponent", NgxLoggerLevel.ERROR);
  protected notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  public trackByService = inject(TrackByService);
  activeSlide = 0;
  @Input() currentPageWalks!: DisplayedWalk[];

  protected readonly EventType = EventType;

  protected readonly WalkViewMode = WalkViewMode;

  ngOnInit() {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
      this.logger.info("systemConfigService returned systemConfig:", systemConfig);
      this.group = systemConfig.group;
    }));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.currentPageWalks && this.currentPageWalks?.length) {
      const firstWalk: ExtendedGroupEvent = this.currentPageWalks[0].walk;
      if (!this.display.awaitingLeader(firstWalk)) {
        this.display.toggleExpandedViewFor(firstWalk, WalkViewMode.VIEW_SINGLE);
      }
      this.logger.info("currentPageWalks populated", this.currentPageWalks);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  viewExpanded(walk: ExtendedGroupEvent): boolean {
    return [WalkViewMode.VIEW_SINGLE, WalkViewMode.EDIT, WalkViewMode.EDIT_FULL_SCREEN].includes(this.display.walkMode(walk));
  }

  imageSource(walk: ExtendedGroupEvent): BasicMedia {
    return this.mediaQueryService.basicMediaFrom(walk?.groupEvent)?.[0];
  }

  backDisabled(): boolean {
    return this.activeSlide === 0;
  }

  login() {
    this.modalService.show(LoginModalComponent, this.config);
  }

  forwardDisabled(): boolean {
    return this.activeSlide > this.currentPageWalks?.length - 1;
  }

  prevSlide() {
    if (this.activeSlide > 0) {
      this.activeSlide--;
    }
  }

  nextSlide() {
    if (this.activeSlide < this.currentPageWalks?.length - 1) {
      this.activeSlide++;
    }
  }

  cardViewDisplay(walk: ExtendedGroupEvent) {
    return [WalkViewMode.LIST, WalkViewMode.VIEW].includes(this.display.walkMode(walk));

  }

  expandedViewDisplay(walk: ExtendedGroupEvent) {
    return this.display.walkMode(walk) === WalkViewMode.VIEW_SINGLE;
  }

  walkEditDisplay(walk: ExtendedGroupEvent) {
    return this.display.walkMode(walk) === WalkViewMode.EDIT;
  }
}
