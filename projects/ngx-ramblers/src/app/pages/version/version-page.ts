import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowUpRightFromSquare, faCircleExclamation, faCodeBranch, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { DEVELOPMENT_BUILD_NUMBER, DeploymentInfo } from "../../models/build-version.model";
import { ReleaseFeed, ReleaseFeedEntry } from "../../models/release-feed.model";
import { Organisation } from "../../models/system.model";
import { UIDateFormat } from "../../models/date-format.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { DeploymentInfoService } from "../../services/deployment-info.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageService } from "../../services/page.service";
import { SystemConfigService } from "../../services/system/system-config.service";

const RELEASE_FEED_LIMIT = 20;

@Component({
  selector: "app-version-page",
  imports: [FontAwesomeModule, RouterLink],
  template: `
    <div class="version-page py-3">
      <h1 class="mb-1">About this version</h1>
      <p class="text-muted mb-4">What {{ group?.shortName || "this site" }} is running right now, when it was built and started, and what changed.</p>
      @if (error) {
        <div class="alert alert-warning d-flex align-items-start">
          <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
          <div>
            <strong>Version details are not available</strong>
            <div>{{ error }}</div>
          </div>
        </div>
      }
      @if (info) {
        <div class="row">
          <div class="col-lg-6">
            <div class="row thumbnail-heading-frame">
              <div class="thumbnail-heading">Running version</div>
              <div class="col-sm-12">
                <table class="table table-sm version-table mb-0">
                  <tbody>
                  <tr>
                    <th>Build</th>
                    <td>
                      @if (isDevelopmentBuild()) {
                        <span>Development build (not deployed from CI)</span>
                      } @else if (info.buildUrl) {
                        <a [href]="info.buildUrl" target="_blank" rel="noopener">build {{ info.buildNumber }} <fa-icon [icon]="faArrowUpRightFromSquare" class="ms-1 small"/></a>
                      } @else {
                        <span>build {{ info.buildNumber }}</span>
                      }
                    </td>
                  </tr>
                  <tr>
                    <th>Commit</th>
                    <td>
                      @if (info.commitSha) {
                        <a [href]="info.commitUrl" target="_blank" rel="noopener"><code>{{ info.commitShortSha }}</code></a>
                        @if (info.commitMessage) {
                          <div class="text-muted">{{ info.commitMessage }}</div>
                        }
                      } @else {
                        <span class="text-muted">Not recorded for this build</span>
                      }
                    </td>
                  </tr>
                  @if (info.branch) {
                    <tr>
                      <th>Branch</th>
                      <td><fa-icon [icon]="faCodeBranch" class="me-1 text-muted"/>{{ info.branch }}</td>
                    </tr>
                  }
                  <tr>
                    <th>Built</th>
                    <td>{{ info.builtAt ? displayDateTime(info.builtAt) : "Not recorded for this build" }}</td>
                  </tr>
                  <tr>
                    <th>Started</th>
                    <td>{{ displayDateTime(info.startedAt) }}<div class="text-muted">running for {{ uptime() }}</div></td>
                  </tr>
                  @if (info.imageTag) {
                    <tr>
                      <th>Image</th>
                      <td><code>{{ info.imageTag }}</code></td>
                    </tr>
                  }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="row thumbnail-heading-frame">
              <div class="thumbnail-heading">Where it runs</div>
              <div class="col-sm-12">
                <table class="table table-sm version-table mb-0">
                  <tbody>
                  <tr>
                    <th>Site</th>
                    <td>
                      @if (group?.href) {
                        <a [href]="group.href">{{ group.longName || group.shortName }}</a>
                      } @else {
                        <span>{{ group?.longName || group?.shortName || "This site" }}</span>
                      }
                    </td>
                  </tr>
                  <tr>
                    <th>Environment</th>
                    <td>{{ info.environment }}</td>
                  </tr>
                  @if (info.flyAppName) {
                    <tr>
                      <th>Fly app</th>
                      <td><code>{{ info.flyAppName }}</code>@if (info.flyRegion) { <span class="text-muted">in region {{ info.flyRegion }}</span> }</td>
                    </tr>
                  }
                  <tr>
                    <th>Node.js</th>
                    <td>{{ info.nodeVersion }}</td>
                  </tr>
                  <tr>
                    <th>Server time</th>
                    <td>{{ displayDateTime(info.serverTime) }}</td>
                  </tr>
                  <tr>
                    <th>Source</th>
                    <td><a [href]="info.repositoryUrl" target="_blank" rel="noopener"><fa-icon [icon]="faGithub" class="me-1"/>{{ repositoryLabel() }} <fa-icon [icon]="faArrowUpRightFromSquare" class="ms-1 small"/></a></td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">What changed</div>
          <div class="col-sm-12">
            @if (releaseNotes.length > 0) {
              <p class="mb-1">
                <strong>{{ releaseNotesMatchBuild ? "Release notes for this build:" : "Latest release notes:" }}</strong>
              </p>
              <ul class="mb-2">
                @for (releaseNote of releaseNotes; track releaseNote.path) {
                  <li><a [routerLink]="'/' + releaseNote.path">{{ releaseNote.title }}</a></li>
                }
              </ul>
              @if (!releaseNotesMatchBuild && !isDevelopmentBuild()) {
                <p class="text-muted mb-2">There is no release note dedicated to build {{ info.buildNumber }}, so the most recent one is shown.</p>
              }
            } @else if (feedLoaded) {
              <p class="text-muted mb-2">No release notes have been published on this site yet.</p>
            } @else {
              <p class="text-muted mb-2">Looking up the release notes…</p>
            }
            @if (feed?.indexPath) {
              <p class="mb-0">
                <a class="btn btn-primary me-2" [routerLink]="'/' + feed.indexPath">All release notes</a>
                @if (feed.humansIndexPath) {
                  <a class="btn btn-quiet" [routerLink]="'/' + feed.humansIndexPath">Release notes for members</a>
                }
              </p>
            }
          </div>
        </div>
        <p class="text-muted small mt-3 mb-0">
          <fa-icon [icon]="faRotateRight" class="me-1"/>Open tabs pick up a new version automatically within a minute of it being deployed, unless you are in the middle of typing something, in which case a notice appears at the top of the page.
        </p>
      }
    </div>`,
  styles: [`
    .version-table th
      width: 9rem
      font-weight: 600
      white-space: nowrap
    .version-table td
      word-break: break-word
  `]
})
export class VersionPageComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("VersionPageComponent", NgxLoggerLevel.ERROR);
  private deploymentInfoService = inject(DeploymentInfoService);
  private systemConfigService = inject(SystemConfigService);
  private dateUtils = inject(DateUtilsService);
  private pageService = inject(PageService);
  private subscriptions: Subscription[] = [];
  protected info: DeploymentInfo | null = null;
  protected feed: ReleaseFeed | null = null;
  protected feedLoaded = false;
  protected releaseNotes: ReleaseFeedEntry[] = [];
  protected releaseNotesMatchBuild = false;
  protected error: string | null = null;
  protected group: Organisation | null = null;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCodeBranch = faCodeBranch;
  protected readonly faGithub = faGithub;
  protected readonly faRotateRight = faRotateRight;

  async ngOnInit(): Promise<void> {
    this.pageService.setTitle("About this version");
    this.subscriptions.push(this.systemConfigService.events().subscribe(config => this.group = config?.group || null));
    try {
      this.info = await this.deploymentInfoService.deploymentInfo();
    } catch (error) {
      this.logger.error("could not load deployment info", error);
      this.error = "The server did not return its version details. Try again in a moment.";
    }
    try {
      this.feed = await this.deploymentInfoService.releaseFeed(RELEASE_FEED_LIMIT);
      const forBuild = this.info ? this.deploymentInfoService.releaseNotesForBuild(this.feed, this.info.buildNumber) : [];
      this.releaseNotesMatchBuild = forBuild.length > 0;
      this.releaseNotes = forBuild.length > 0 ? forBuild : (this.feed?.entries || []).slice(0, 1);
    } catch (error) {
      this.logger.error("could not load release feed", error);
    }
    this.feedLoaded = true;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  protected isDevelopmentBuild(): boolean {
    return this.info?.buildNumber === DEVELOPMENT_BUILD_NUMBER;
  }

  protected displayDateTime(isoDate: string): string {
    return this.dateUtils.asString(isoDate, undefined, UIDateFormat.DISPLAY_DATE_AND_TIME);
  }

  protected uptime(): string {
    const seconds = this.info?.uptimeSeconds || 0;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [
      days > 0 ? `${days} day${days === 1 ? "" : "s"}` : null,
      hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : null,
      `${minutes} minute${minutes === 1 ? "" : "s"}`
    ].filter(part => !!part);
    return parts.join(", ");
  }

  protected repositoryLabel(): string {
    return (this.info?.repositoryUrl || "").replace(/^https?:\/\//, "");
  }
}
