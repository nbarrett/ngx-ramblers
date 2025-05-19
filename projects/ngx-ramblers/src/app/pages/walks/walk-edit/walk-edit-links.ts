import { Component, inject, Input, OnInit } from "@angular/core";
import { DisplayedWalk, Links, LinkSource } from "../../../models/walk.model";
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

@Component({
  selector: "app-walk-edit-related-links",
  standalone: true,
  imports: [
    FormsModule,
    MarkdownEditorComponent,
    WalkVenueComponent,
    WalkMeetupComponent,
    TooltipDirective,
    DisplayDatePipe
  ],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row">
        <div class="col-sm-12">
          <div class="img-thumbnail thumbnail-walk-edit">
            <div class="thumbnail-heading">Ramblers</div>
            <div class="form-group">
              @if (!insufficientDataToUploadToRamblers() && !ramblersWalkExists()) {
                <p>This walk has not been uploaded to Ramblers yet - check back when date is closer to
                  <b>{{ displayedWalk.walk.groupEvent.start_date_time | displayDate }}</b>.
                </p>
              }
              @if (insufficientDataToUploadToRamblers()) {
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
                  <div class="custom-control custom-checkbox">
                    <input [disabled]="inputDisabled || saveInProgress"
                           [(ngModel)]="displayedWalk.walk.fields.publishing.ramblers.publish"
                           (ngModelChange)="logLinkChange()"
                           type="checkbox" class="custom-control-input" id="publish-ramblers">
                    <label class="custom-control-label" for="publish-ramblers">Publish to Ramblers
                    </label>
                  </div>
                </div>
              }
              @if (ramblersWalkExists()) {
                <div class="col-sm-6">
                  <div class="form-group">
                    <label class="mr-2">Link preview:</label>
                    <img class="related-links-ramblers-image"
                         src="favicon.ico"
                         alt="Click to view on Ramblers Walks and Events Manager"/>
                    <a target="_blank"
                       class="ml-2"
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
                    <div class="form-inline">
                      <input type="submit" value="Unlink"
                             (click)="unlinkOSMapsFromCurrentWalk()"
                             title="Remove link between this walk and OS Maps"
                             [disabled]="!canUnlinkOSMaps() || inputDisabled"
                             class="btn btn-primary mr-2">
                      <label>Link preview:</label>
                      <img class="related-links-image"
                           src="/assets/images/local/ordnance-survey.png"
                           alt=""/>
                      <a target="_blank"
                         class="ml-2"
                         [href]="links.osMapsRoute.href"
                         tooltip="Click to view the route for this walk on Ordnance Survey Maps">
                        {{ links.osMapsRoute.title || displayedWalk.walk.groupEvent.title }}
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
  @Input() displayedWalk!: DisplayedWalk;
  @Input() inputDisabled = false;
  @Input() saveInProgress = false;
  @Input() notify!: AlertInstance;
  public links: Links = null;
  protected display = inject(WalkDisplayService);
  private memberLoginService = inject(MemberLoginService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private linksService = inject(LinksService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditRelatedLinksComponent", NgxLoggerLevel.ERROR);

  protected readonly LinkSource = LinkSource;

  ngOnInit() {
    this.initialiseLinks();
    this.logger.info("constructed with walk links:", this.displayedWalk?.walk?.fields?.links, "links object:", this.links);
  }

  private initialiseLinks() {
    this.links = this.linksService.linksFrom(this.displayedWalk?.walk?.fields?.links);
  }

  canUnlinkRamblers() {
    return this.memberLoginService.allowWalkAdminEdits() && this.ramblersWalkExists();
  }

  canUnlinkOSMaps() {
    return !!this.linksService.linkWithSourceFrom(this.displayedWalk.walk.fields, LinkSource.OS_MAPS);
  }

  insufficientDataToUploadToRamblers() {
    return this.memberLoginService.allowWalkAdminEdits() && this.displayedWalk.walk
      && !(this.display.gridReferenceFrom(this.displayedWalk?.walk?.groupEvent?.start_location) || this.displayedWalk?.walk?.groupEvent?.start_location?.postcode);
  }

  walkValidations() {
    const walkValidations = this.ramblersWalksAndEventsService.toWalkExport({
      localWalk: this.displayedWalk.walk,
      ramblersWalk: null
    }).validationMessages;
    return "This walk cannot be included in the Ramblers Walks and Events Manager export due to the following "
      + walkValidations.length + " reasons(s): " + walkValidations.join(", ") + ".";
  }

  ramblersWalkExists() {
    return this.ramblersWalksAndEventsService.toWalkExport({
      localWalk: this.displayedWalk.walk,
      ramblersWalk: null
    }).publishedOnRamblers;
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
