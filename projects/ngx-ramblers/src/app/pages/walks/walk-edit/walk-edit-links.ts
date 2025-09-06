import { Component, computed, inject, Input, OnInit, Signal, signal, WritableSignal } from "@angular/core";
import { DisplayedWalk, Links, LinkSource, WalkExport } from "../../../models/walk.model";
import { FormsModule } from "@angular/forms";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { WalkVenueComponent } from "../walk-venue/walk-venue.component";
import { WalkMeetupComponent } from "../walk-meetup/walk-meetup.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { LinksService } from "../../../services/links.service";
import { WalkDisplayService } from "../walk-display.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { AlertInstance } from "../../../services/notifier.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEventType } from "../../../models/broadcast.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-walk-edit-related-links",
  standalone: true,
  imports: [
    FormsModule,
    MarkdownEditorComponent,
    WalkVenueComponent,
    WalkMeetupComponent,
    TooltipDirective,
    DisplayDatePipe,
  ],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row">
        <div class="col-sm-12">
          <div class="img-thumbnail thumbnail-walk-edit">
            <div class="thumbnail-heading">Ramblers</div>
            <div class="form-group">
              @if (showDiagnosticData) {
                <div>id: {{ displayedWalk?.walk?.groupEvent.id }}</div>
                <div>url: {{ displayedWalk?.walk?.groupEvent.url }}</div>
              }
              @if (!insufficientDataToUploadToRamblers() && !ramblersWalkExists()) {
                <p>This walk has not been uploaded to Ramblers yet - check back when date is closer to
                  <b>{{ displayedWalk?.walk?.groupEvent.start_date_time | displayDate }}</b>.
                </p>
              }
              @if (walkExportSignal().validationMessages.length > 0) {
                <p>
                  {{ walkValidations() }}
                </p>
              }
              @if (canUnlinkRamblers()) {
                <div>
                  <div class="row">
                    <div class="col-sm-2">
                      <input type="submit" value="Unlink"
                             (click)="unlinkRamblersDataFromCurrentWalk()"
                             title="Remove link between this walk and Ramblers"
                             class="btn btn-primary">
                    </div>
                    <div class="col-sm-10">
                      <app-markdown-editor name="ramblers-help"
                                           description="Linking to Ramblers"/>
                    </div>
                  </div>
                </div>
              }
            </div>
            <div class="row">
              @if (display.allowEdits(displayedWalk.walk)) {
                <div class="col-sm-6">
                  <div class="form-check">
                    <input [disabled]="inputDisabled || saveInProgress"
                           [(ngModel)]="displayedWalk.walk.fields.publishing.ramblers.publish"
                           (ngModelChange)="logLinkChange()"
                           type="checkbox" class="form-check-input" id="publish-ramblers">
                    <label class="form-check-label" for="publish-ramblers">Publish to Ramblers
                    </label>
                  </div>
                </div>
              }
              @if (ramblersWalkExists()) {
                <div class="col-sm-6">
                  <div class="form-group">
                    <label class="me-2">Link preview:</label>
                    <img class="related-links-ramblers-image"
                         src="favicon.ico"
                         alt="Click to view on Ramblers Walks and Events Manager"/>
                    <a target="_blank"
                       class="ms-2"
                       tooltip="Click to view on Ramblers Walks and Events Manager"
                       [href]="display.ramblersLink(displayedWalk.walk)">Ramblers</a>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
      @if (displayedWalk?.walk?.fields?.venue) {
        <app-walk-venue [displayedWalk]="displayedWalk"/>
      }
      <app-walk-meetup [displayedWalk]="displayedWalk" [saveInProgress]="saveInProgress"/>
      <div class="row">
        <div class="col-sm-12">
          <div class="row img-thumbnail thumbnail-walk-edit">
            <div class="thumbnail-heading">OS Maps</div>
            <div class="col-sm-12">
              <app-markdown-editor name="os-maps-help" description="Linking to OS Maps"/>
            </div>
            <div class="col-sm-12">
              <div class="row">
                @if (linkExists(LinkSource.OS_MAPS)) {
                  <div class="col-sm-6">
                    <div class="form-group">
                      <label for="os-maps-route">Url</label>
                      <input
                        [(ngModel)]="links.osMapsRoute.href"
                        [disabled]="inputDisabled"
                        (ngModelChange)="logLinkChange()"
                        type="text" value="" class="form-control input-sm"
                        id="os-maps-route"
                        placeholder="Enter URL to OS Maps Route">
                    </div>
                  </div>
                  <div class="col-sm-6">
                    <div class="form-group">
                      <label for="related-links-title">Title</label>
                      <input [(ngModel)]="links.osMapsRoute.title"
                             [disabled]="inputDisabled"
                             (ngModelChange)="logLinkChange()"
                             type="text" value="" class="form-control input-sm"
                             id="related-links-title"
                             placeholder="Enter optional title for OS Maps link">
                    </div>
                  </div>
                  <div class="col-sm-12">
                    <div class="d-inline-flex align-items-center flex-wrap">
                      <input type="submit" value="Unlink"
                             (click)="unlinkOSMapsFromCurrentWalk()"
                             title="Remove link between this walk and OS Maps"
                             [disabled]="!canUnlinkOSMaps() || inputDisabled"
                             class="btn btn-primary me-2">
                      <label>Link preview:</label>
                      <img class="related-links-image"
                           src="/assets/images/local/ordnance-survey.png"
                           alt=""/>
                      <a target="_blank"
                         class="ms-2"
                         [href]="links.osMapsRoute.href"
                         tooltip="Click to view the route for this walk on Ordnance Survey Maps">
                        {{ links.osMapsRoute.title || displayedWalk?.walk?.groupEvent.title }}
                      </a>
                    </div>
                  </div>
                } @else {
                  <div class="col-sm-12">
                    <div class="form-group">
                      <input type="submit" value="Create"
                             (click)="createLink()"
                             title="Remove link between this walk and OS Maps"
                             [disabled]="inputDisabled"
                             class="btn btn-primary"></div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class WalkEditRelatedLinksComponent implements OnInit {
  @Input() protected displayedWalk!: DisplayedWalk;
  public inputDisabled = false;

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }
  @Input() saveInProgress = false;
  @Input() notify!: AlertInstance;
  public showDiagnosticData = false;
  public links: Links = null;
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  protected display = inject(WalkDisplayService);
  protected stringUtilsService = inject(StringUtilsService);
  private memberLoginService = inject(MemberLoginService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private linksService = inject(LinksService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditRelatedLinksComponent", NgxLoggerLevel.ERROR);
  protected readonly LinkSource = LinkSource;
  protected walkSignal: WritableSignal<ExtendedGroupEvent>;
  protected allowEditsSignal: WritableSignal<boolean>;
  protected ramblersWalkExistsSignal: WritableSignal<boolean>;
  protected walkExportSignal: Signal<WalkExport>;
  protected insufficientDataToUploadToRamblers: Signal<boolean> = computed(() => {
    const walk = this.walkSignal?.();
    const allowEdits = this.allowEditsSignal?.();
    if (!allowEdits || !walk) {
      return false;
    } else {
      const hasGridRef = this.display.gridReferenceFrom(walk?.groupEvent?.start_location);
      const hasPostcode = walk?.groupEvent?.start_location?.postcode;
      return !(hasGridRef || hasPostcode);
    }
  });

  ngOnInit() {
    this.walkSignal = signal(this.displayedWalk?.walk);
    this.allowEditsSignal = signal(this.memberLoginService.allowWalkAdminEdits());
    this.ramblersWalkExistsSignal = signal(false);
    this.walkExportSignal = computed(() =>
      this.ramblersWalksAndEventsService.toWalkExport({
        localWalk: this.walkSignal(),
        ramblersWalk: null
      })
    );
    this.initialiseLinks();
    this.logger.info("constructed with walk links:", this.displayedWalk?.walk?.fields?.links, "links object:", this.links);
    this.ramblersWalkExistsSignal.set(this.walkExportSignal().publishedOnRamblers);
    this.broadcastService.on(NamedEventType.WALK_CHANGED, (namedEvent) => {
      this.logger.info("received:", namedEvent);
      this.walkSignal.set({...this.displayedWalk.walk});
    });
  }

  ramblersWalkExists() {
    return this.walkExportSignal().publishedOnRamblers;
  }

  walkValidations() {
    const walkValidations = this.walkExportSignal().validationMessages;
    return "This walk cannot be included in the Ramblers Walks and Events Manager export due to the following "
      + this.stringUtilsService.pluraliseWithCount(walkValidations.length, "reason") + ": " + walkValidations.join(", ") + ".";
  }

  private initialiseLinks() {
    this.links = this.linksService.linksFrom(this.displayedWalk?.walk);
  }

  canUnlinkRamblers() {
    return this.memberLoginService.allowWalkAdminEdits() && this.ramblersWalkExistsSignal();
  }

  canUnlinkOSMaps() {
    return !!this.linksService.linkWithSourceFrom(this.displayedWalk.walk.fields, LinkSource.OS_MAPS);
  }

  unlinkRamblersDataFromCurrentWalk() {
    this.displayedWalk.walk.groupEvent.id = null;
    this.notify.progress({title: "Unlink walk", message: "Previous Ramblers walk has now been unlinked."});
  }

  unlinkOSMapsFromCurrentWalk() {
    const linkSource = LinkSource.OS_MAPS;
    this.linksService.deleteLink(this.displayedWalk.walk.fields, linkSource);
    this.notify.progress({title: "Unlink walk", message: "Previous OS Maps route has now been unlinked."});
    this.initialiseLinks();
  }

  createLink() {
    const source = LinkSource.OS_MAPS;
    this.linksService.createOrUpdateLink(this.displayedWalk.walk.fields, {source, href: null, title: null});
    this.notify.progress({
      title: "Unlink walk",
      message: `Link created${EM_DASH_WITH_SPACES}complete fields and save walk`
    });
    this.initialiseLinks();
  }

  linkExists(source: LinkSource): boolean {
    return this.linksService.linkExists(this.displayedWalk.walk.fields, source);
  }

  logLinkChange() {
    this.logger.info("links object:", this.links, "publishing:", this.displayedWalk.walk.fields.publishing, "walk links:", this.displayedWalk?.walk?.fields?.links);
  }
}
