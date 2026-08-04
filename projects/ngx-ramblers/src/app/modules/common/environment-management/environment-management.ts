import { Component, inject, OnDestroy, OnInit } from "@angular/core";

import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { values } from "es-toolkit/compat";
import { StoredValue } from "../../../models/ui-actions";
import { Subscription } from "rxjs";
import { sortBy } from "../../../functions/arrays";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCheckCircle,
  faCog,
  faExclamationCircle,
  faExclamationTriangle,
  faGlobe,
  faKey,
  faPlaneDeparture,
  faPlus,
  faRedo,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  EnvironmentStatus,
  ExistingEnvironment,
  FlyOrgMigrationPhase,
  FlyOrgMigrationStatus,
  HostnameHealth,
  hostnameHealthLabels,
  HostnameHealthReport,
  HostnameOrigin,
  hostnameOriginLabels,
  HostnameStatus,
  ManageAction,
  OperationInProgress
} from "../../../models/environment-setup.model";
import { CustomDomainEntry, CustomDomainStatus } from "../../../models/environment-config.model";
import { EventType, MessageType } from "../../../models/websocket.model";
import { SessionLogsComponent } from "../../../shared/components/session-logs";
import { SecretInputComponent } from "../secret-input/secret-input.component";
import { StringUtilsService } from "../../../services/string-utils.service";
import { InputSize } from "../../../models/ui-size.model";
import { ramblersNationalUrl } from "../../../functions/hosts";

@Component({
  selector: "app-environment-management",
  standalone: true,
  imports: [DatePipe, FormsModule, FontAwesomeModule, NgSelectComponent, SessionLogsComponent, SecretInputComponent, TooltipDirective],
  styles: [`
    :host
      display: block

    :host ::ng-deep .alert
      padding: 1rem

    :host ::ng-deep .custom-domains-table th.col-hostname,
    :host ::ng-deep .custom-domains-table td.col-hostname
      min-width: 280px
      white-space: nowrap

    :host ::ng-deep .custom-domains-table th.col-status,
    :host ::ng-deep .custom-domains-table td.col-status
      min-width: 220px

    :host ::ng-deep .custom-domains-table th.col-added,
    :host ::ng-deep .custom-domains-table td.col-added
      width: 130px
      white-space: nowrap

    :host ::ng-deep .custom-domains-table th.col-actions,
    :host ::ng-deep .custom-domains-table td.col-actions
      width: 90px
      white-space: nowrap

    :host ::ng-deep .custom-domains-table .btn.icon-only
      width: 32px
      height: 32px
      padding: 0
      display: inline-flex
      align-items: center
      justify-content: center

    :host ::ng-deep .custom-domains-table tbody tr:last-child td
      border-bottom: 0

    :host ::ng-deep .custom-domains-table .domain-status-detail
      line-height: 1.3
      word-break: break-word

    :host ::ng-deep .custom-domains-table .fa-icon-globe
      color: var(--ramblers-colour-mintcake)

    :host ::ng-deep .hostname-health-table
      width: 100%
      cursor: default

    :host ::ng-deep .hostname-health-table th,
    :host ::ng-deep .hostname-health-table td
      white-space: normal
      word-break: normal
      vertical-align: top

    :host ::ng-deep .hostname-health-table .fa-icon-globe
      color: var(--ramblers-colour-mintcake)

    :host ::ng-deep .hostname-health-table th.col-hostname,
    :host ::ng-deep .hostname-health-table td.col-hostname
      width: 1%
      white-space: nowrap
      padding-right: 1.5rem

    :host ::ng-deep .hostname-health-table .health-line
      white-space: nowrap
      line-height: 1.35

    :host ::ng-deep .hostname-health-table .domain-status-detail
      white-space: normal
      word-break: normal
      line-height: 1.35

    :host ::ng-deep .resume-steps
      max-width: 36rem

    :host ::ng-deep .resume-step.form-check
      padding-right: 0

    :host ::ng-deep .resume-step-label
      display: flex
      align-items: center
      justify-content: space-between
      width: 100%
      gap: 1rem

    :host ::ng-deep .resume-step-text
      flex: 1 1 auto
      min-width: 0

    .fly-migrate-panels
      margin-bottom: 0

    .fly-migrate-panels .thumbnail-heading-frame
      margin-top: 1.75rem
      margin-bottom: 0.75rem
      height: calc(100% - 0.75rem)

    .fly-migrate-detect
      margin-top: 2rem

    .fly-migrate-options
      clear: both
      position: relative
      z-index: 1
      margin-top: 0.5rem

    .fly-migrate-status .resume-step-label
      display: flex
      align-items: center
      justify-content: space-between
      width: 100%
      gap: 1rem

    :host ::ng-deep .resume-step-badge
      flex: 0 0 4.5rem
      text-align: center
  `],
  template: `
    @if (!enabled) {
      <div class="alert alert-warning">
        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
        Environment management is not available on this environment.
        Please use the CLI or staging environment.
      </div>
    } @else {
      @if (existingEnvironments.length === 0) {
        <div class="alert alert-warning">
          <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
          No environments configured yet. Add environments in the Settings tab first.
        </div>
      } @else {
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Change existing environment</div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="existing-env">Select Environment</label>
              <ng-select id="existing-env"
                         [items]="existingEnvironments"
                         bindLabel="name"
                         [(ngModel)]="selectedExistingEnv"
                         (ngModelChange)="onExistingEnvironmentSelected($event)"
                         [loading]="loading"
                         placeholder="Select an environment">
              </ng-select>
            </div>
          </div>

          @if (selectedExistingEnv) {
            <div class="row thumbnail-heading-frame mt-2">
              <div class="thumbnail-heading">Environment Details</div>
              <div class="row">
                <div class="col-md-3 mb-2">
                  <strong>Name:</strong> {{ selectedExistingEnv.name }}
                </div>
                <div class="col-md-3 mb-2">
                  <strong>App:</strong> {{ selectedExistingEnv.appName }}
                </div>
                <div class="col-md-2 mb-2">
                  <strong>Memory:</strong> {{ selectedExistingEnv.memory }}
                </div>
                <div class="col-md-2 mb-2">
                  <strong>Scale:</strong> {{ selectedExistingEnv.scaleCount }}
                </div>
                <div class="col-md-2 mb-2">
                  <strong>Fly.io Token:</strong>
                  @if (selectedExistingEnv.hasApiKey) {
                    <span class="text-success ms-1">Configured</span>
                  } @else {
                    <span class="text-warning ms-1">Missing</span>
                  }
                </div>
                <div class="col-md-3 mb-2">
                  <strong>Organisation:</strong>
                  <span class="ms-1">{{ selectedExistingEnv.organisation || "personal" }}</span>
                </div>
              </div>
            </div>

            @if (loadingStatus) {
              <div class="d-flex align-items-center mt-3">
                <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>
                Detecting environment state...
              </div>
            } @else {
              <div class="row mt-3">
                <div class="col-md-12">
                  <strong>What do you want to do?</strong>
                  <div class="form-check mt-2">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionModify"
                           [value]="ManageAction.MODIFY" [ngModel]="manageAction"
                           (ngModelChange)="setManageAction($event)">
                    <label class="form-check-label" for="actionModify">
                      <fa-icon [icon]="faCog" class="me-1"></fa-icon> Modify (deploy, subdomain, hostnames, data)
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionMigrateFlyOrg"
                           [value]="ManageAction.MIGRATE_FLY_ORG" [ngModel]="manageAction"
                           (ngModelChange)="setManageAction($event)">
                    <label class="form-check-label" for="actionMigrateFlyOrg">
                      <fa-icon [icon]="faPlaneDeparture" class="me-1"></fa-icon> Move Fly organisation (cutover to new org token)
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionDestroy"
                           [value]="ManageAction.DESTROY" [ngModel]="manageAction"
                           (ngModelChange)="setManageAction($event)">
                    <label class="form-check-label text-danger" for="actionDestroy">
                      <fa-icon [icon]="faTrash" class="me-1"></fa-icon> Destroy (permanent removal)
                    </label>
                  </div>
                </div>
              </div>
              @if (manageAction === ManageAction.MODIFY) {
                <div class="row mt-3">
                  <div class="col-md-12">
                    <strong>Steps to run:</strong>
                    <div class="resume-steps mt-2">
                      <div class="form-check resume-step">
                        <input class="form-check-input" type="checkbox" id="runDbInit"
                               [(ngModel)]="resumeOptions.runDbInit">
                        <label class="form-check-label resume-step-label" for="runDbInit">
                          <span class="resume-step-text">Initialise database</span>
                          @if (envStatus) {
                            <span class="badge resume-step-badge"
                                  [class]="envStatus.databaseInitialised ? 'bg-success' : 'bg-warning'">
                              {{ envStatus.databaseInitialised ? "done" : "needed" }}
                            </span>
                          }
                        </label>
                      </div>
                      <div class="form-check resume-step">
                        <input class="form-check-input" type="checkbox" id="runFlyDeployment"
                               [(ngModel)]="resumeOptions.runFlyDeployment">
                        <label class="form-check-label resume-step-label" for="runFlyDeployment">
                          <span class="resume-step-text">Deploy to Fly.io</span>
                          @if (envStatus) {
                            <span class="badge resume-step-badge"
                                  [class]="envStatus.flyAppDeployed ? 'bg-success' : 'bg-warning'">
                              {{ envStatus.flyAppDeployed ? "done" : "needed" }}
                            </span>
                          }
                        </label>
                      </div>
                      <div class="form-check resume-step">
                        <input class="form-check-input" type="checkbox" id="copyStandardAssets"
                               [(ngModel)]="resumeOptions.copyStandardAssets">
                        <label class="form-check-label resume-step-label" for="copyStandardAssets">
                          <span class="resume-step-text">Copy standard assets (icons, logos, backgrounds)</span>
                          @if (envStatus) {
                            <span class="badge resume-step-badge"
                                  [class]="envStatus.standardAssetsPresent ? 'bg-success' : 'bg-warning'">
                              {{ envStatus.standardAssetsPresent ? "done" : "needed" }}
                            </span>
                          }
                        </label>
                      </div>
                      <div class="form-check resume-step">
                        <input class="form-check-input" type="checkbox" id="setupSubdomain"
                               [(ngModel)]="resumeOptions.setupSubdomain">
                        <label class="form-check-label resume-step-label" for="setupSubdomain">
                          <span class="resume-step-text">Setup subdomain (DNS + SSL certificate)</span>
                          @if (envStatus) {
                            <span class="badge resume-step-badge"
                                  [class]="envStatus.subdomainConfigured ? 'bg-success' : 'bg-warning'">
                              {{ envStatus.subdomainConfigured ? "done" : "needed" }}
                            </span>
                          }
                        </label>
                      </div>
                      <div class="form-check resume-step">
                        <input class="form-check-input" type="checkbox" id="authenticateBrevoDomain"
                               [(ngModel)]="resumeOptions.authenticateBrevoDomain">
                        <label class="form-check-label resume-step-label" for="authenticateBrevoDomain">
                          <span class="resume-step-text">
                            Authenticate Brevo sending domain
                            <span class="small text-muted">(after subdomain)</span>
                          </span>
                          @if (envStatus) {
                            <span class="badge resume-step-badge"
                                  [class]="envStatus.brevoDomainAuthenticated ? 'bg-success' : 'bg-warning'">
                              {{ envStatus.brevoDomainAuthenticated ? "done" : "needed" }}
                            </span>
                          }
                        </label>
                      </div>
                      <div class="form-check resume-step">
                        <input class="form-check-input" type="checkbox" id="includeSamplePages"
                               [(ngModel)]="resumeOptions.includeSamplePages">
                        <label class="form-check-label resume-step-label" for="includeSamplePages">
                          <span class="resume-step-text">Include sample page content</span>
                          @if (envStatus) {
                            <span class="badge resume-step-badge"
                                  [class]="envStatus.samplePagesPresent ? 'bg-success' : 'bg-warning'">
                              {{ envStatus.samplePagesPresent ? "done" : "needed" }}
                            </span>
                          }
                        </label>
                      </div>
                      <div class="form-check resume-step">
                        <input class="form-check-input" type="checkbox" id="includeNotificationConfigs"
                               [(ngModel)]="resumeOptions.includeNotificationConfigs">
                        <label class="form-check-label resume-step-label" for="includeNotificationConfigs">
                          <span class="resume-step-text">Include notification configs</span>
                          @if (envStatus) {
                            <span class="badge resume-step-badge"
                                  [class]="envStatus.notificationConfigsPresent ? 'bg-success' : 'bg-warning'">
                              {{ envStatus.notificationConfigsPresent ? "done" : "needed" }}
                            </span>
                          }
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                @if (progressMessages.length > 0) {
                  <div class="row mt-3">
                    <div class="col-md-12">
                      <app-session-logs [messages]="progressMessages"></app-session-logs>
                    </div>
                  </div>
                }
                @if (setupResult) {
                  <div class="row mt-3">
                    <div class="col-md-12">
                      <div class="alert alert-success mb-0">
                        <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                        <strong>Environment modified successfully!</strong>
                        @if (setupResult.appUrl) {
                          <br>App URL: <a [href]="setupResult.appUrl" target="_blank">{{ setupResult.appUrl }}</a>
                        }
                      </div>
                    </div>
                  </div>
                }
                @if (passwordResetResult) {
                  <div class="row mt-3">
                    <div class="col-md-12">
                      <div class="alert alert-success mb-0">
                        <div class="d-flex align-items-start">
                          <fa-icon [icon]="faKey" class="me-2 mt-1"></fa-icon>
                          <div>
                            <strong>Admin sign-in for this environment</strong>
                            <dl class="row mb-0 mt-2">
                              <dt class="col-sm-3">Username</dt>
                              <dd class="col-sm-9"><code>{{ passwordResetResult.userName || passwordResetResult.email }}</code></dd>
                              <dt class="col-sm-3">Email</dt>
                              <dd class="col-sm-9">{{ passwordResetResult.email }}</dd>
                              @if (passwordResetResult.resetUrl) {
                                <dt class="col-sm-3">Set password</dt>
                                <dd class="col-sm-9">
                                  <a [href]="passwordResetResult.resetUrl" target="_blank">{{ passwordResetResult.resetUrl }}</a>
                                  <div class="small mt-1">Open this once to choose a password, then sign in with the username above. There is no initial password.</div>
                                </dd>
                              }
                              @if (passwordResetResult.flyResetUrl) {
                                <dt class="col-sm-3">Fly.io set password</dt>
                                <dd class="col-sm-9">
                                  <a [href]="passwordResetResult.flyResetUrl" target="_blank">{{ passwordResetResult.flyResetUrl }}</a>
                                  <div class="small text-muted mt-1">Fallback if the custom host is not ready yet.</div>
                                </dd>
                              }
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
                @if (setupWarnings.length > 0) {
                  <div class="row mt-3">
                    <div class="col-md-12">
                      <div class="alert alert-warning mb-0">
                        <div class="d-flex align-items-start">
                          <fa-icon [icon]="faExclamationTriangle" class="me-2 mt-1"></fa-icon>
                          <div>
                            <strong>Completed with {{ stringUtils.pluraliseWithCount(setupWarnings.length, "step") }} needing attention</strong>
                            <p class="mb-1 mt-2">The environment is usable. Finish these later (for Brevo domain auth, the Brevo UI is often required).</p>
                            <ul class="mb-0">
                              @for (warning of setupWarnings; track warning) {
                                <li>{{ warning }}</li>
                              }
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                }
                @if (setupError) {
                  <div class="row mt-3">
                    <div class="col-md-12">
                      <div class="alert alert-danger mb-0">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        <strong>Error:</strong> {{ setupError }}
                      </div>
                    </div>
                  </div>
                }
                @if (!selectedExistingEnv.hasApiKey && (resumeOptions.runFlyDeployment || resumeOptions.setupSubdomain)) {
                  <div class="row mt-3">
                    <div class="col-md-12">
                      <div class="alert alert-warning mb-0">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        <strong>Fly.io token not configured</strong> for this environment. Deploy and subdomain operations will fail without it.
                        Configure it in the <strong>Settings</strong> tab under environment configuration.
                      </div>
                    </div>
                  </div>
                }
                <div class="row thumbnail-heading-frame mt-3">
                  <div class="thumbnail-heading">Hostnames</div>
                  <div class="col-md-12">
                    <div class="hostname-part mb-4">
                      <div class="fw-bold">Environment subdomain</div>
                      <p class="small text-muted mb-0">
                        Free host for this app (e.g. <code>{{ environmentSubdomainHint() }}</code>).
                        Create it with <strong>Setup subdomain</strong> under Steps to run, not with the boxes below.
                        It appears in the table as “Environment subdomain”.
                      </p>
                    </div>

                    <div class="hostname-part mb-3">
                      <div class="d-flex align-items-center gap-2 flex-wrap">
                        <div class="fw-bold">Site URL</div>
                        <button class="btn btn-sm btn-quiet"
                                (click)="refreshHostnameHealth()"
                                [disabled]="loadingHostnameHealth || operationBusy || customDomainBusy">
                          @if (loadingHostnameHealth) {
                            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                          } @else {
                            <fa-icon [icon]="faRedo" class="me-1"></fa-icon>
                          }
                          Re-check
                        </button>
                      </div>
                      <p class="small text-muted mb-2">
                        Public address stored on the group. Fix it with <strong>Clear Site URL</strong> /
                        <strong>Use as Site URL</strong> on the table rows, not by typing in the fields below.
                      </p>
                      @if (loadingHostnameHealth) {
                        <div class="small text-muted">Checking hostnames…</div>
                      } @else if (hostnameHealthError) {
                        <p class="small text-danger mb-0">
                          Hostname check did not complete: {{ hostnameHealthError }}. Press Re-check to try again.
                        </p>
                      } @else if (hostnameStatuses().length === 0) {
                        <div class="small text-muted">No hostnames could be resolved for this environment.</div>
                      } @else {
                        <div class="table-responsive">
                          <table class="rounded table styled-table table-hover table-sm align-middle mb-0 hostname-health-table">
                            <thead>
                              <tr>
                                <th scope="col" class="col-hostname">Hostname</th>
                                <th scope="col">State</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (hostname of hostnameStatuses(); track hostname.hostname) {
                                <tr>
                                  <td class="col-hostname">
                                    <div class="health-line">
                                      <fa-icon [icon]="faGlobe" class="me-2 fa-icon-globe"></fa-icon>
                                      <a [href]="'https://' + hostname.hostname" target="_blank">{{ hostname.hostname }}</a>
                                    </div>
                                    <div class="health-line small text-muted">{{ hostnameOriginLabel(hostname) }}</div>
                                  </td>
                                  <td>
                                    @if (hostname.healthy) {
                                      <div class="health-line">
                                        <span class="badge" [class]="hostnameBadgeClass(hostname)">{{ hostnameHealthLabel(hostname) }}</span>
                                      </div>
                                      @if (hostnameDetail(hostname)) {
                                        <div class="small text-muted mt-1 domain-status-detail">{{ hostnameDetail(hostname) }}</div>
                                      }
                                      <div class="health-line small text-muted mt-1">{{ hostnameDnsSummary(hostname) }}</div>
                                      <div class="health-line small text-muted">HTTPS {{ hostname.httpStatus || "no response" }}</div>
                                      @if (hostname.redirectRuleTarget) {
                                        <button class="btn btn-sm btn-quiet mt-2 me-2"
                                                (click)="removeApexRedirect(hostname)"
                                                [disabled]="apexRedirectBusy || operationBusy || customDomainBusy || siteUrlBusy">
                                          Remove redirect
                                        </button>
                                      }
                                      @if (canUseAsSiteUrl(hostname)) {
                                        <button class="btn btn-sm btn-quiet mt-2"
                                                (click)="setSiteUrlFromHostname(hostname)"
                                                [disabled]="siteUrlBusy || operationBusy || customDomainBusy"
                                                tooltip="Writes this hostname into the environment system config as group.href">
                                          @if (siteUrlBusy) {
                                            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                                          }
                                          Use as Site URL
                                        </button>
                                      }
                                    } @else {
                                      <div class="small">{{ hostnameActionStatement(hostname) }}</div>
                                      <div class="mt-2">
                                        @if (shouldOfferClearSiteUrl(hostname)) {
                                          <button class="btn btn-sm btn-quiet me-2"
                                                  (click)="clearSiteUrl()"
                                                  [disabled]="siteUrlBusy || operationBusy || customDomainBusy">
                                            @if (siteUrlBusy) {
                                              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                                            } @else {
                                              <fa-icon [icon]="faTrash" class="me-1"></fa-icon>
                                            }
                                            Clear Site URL
                                          </button>
                                        }
                                        @if (canUseAsSiteUrl(hostname)) {
                                          <button class="btn btn-sm btn-quiet me-2"
                                                  (click)="setSiteUrlFromHostname(hostname)"
                                                  [disabled]="siteUrlBusy || operationBusy || customDomainBusy">
                                            @if (siteUrlBusy) {
                                              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                                            }
                                            Use as Site URL
                                          </button>
                                        }
                                        @if (hostname.redirectRuleTarget) {
                                          <button class="btn btn-sm btn-quiet"
                                                  (click)="removeApexRedirect(hostname)"
                                                  [disabled]="apexRedirectBusy || operationBusy || customDomainBusy || siteUrlBusy">
                                            Remove redirect
                                          </button>
                                        }
                                      </div>
                                    }
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    </div>

                    <div class="hostname-part mt-4 pt-3 border-top">
                      <div class="fw-bold">Attach a custom domain</div>
                      <p class="small text-muted mb-2">
                        Only if the group owns a domain of its own (e.g. <code>www.finchleyandhornsey.org.uk</code>)
                        that should serve this site. Skip when the free NGX subdomain is enough.
                        @if (!environmentSubdomainReady()) {
                          Available after Setup subdomain has run.
                        }
                      </p>
                      <div class="d-flex gap-2 align-items-start flex-wrap">
                        <input type="text" class="form-control" style="max-width: 320px;"
                               placeholder="e.g. www.your-group.org.uk"
                               [(ngModel)]="customDomainHostname"
                               [disabled]="operationBusy || customDomainBusy || !environmentSubdomainReady()">
                        <button class="btn btn-primary" (click)="addCustomDomain()"
                                [disabled]="operationBusy || customDomainBusy || !customDomainHostname || !environmentSubdomainReady()">
                          @if (customDomainBusy && !removingDomainHostname && !checkingDomainHostname) {
                            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                          } @else {
                            <fa-icon [icon]="faPlus" class="me-1"></fa-icon>
                          }
                          Attach domain
                        </button>
                      </div>
                      @if (shouldShowAlsoAttachWwwOption()) {
                        <div class="form-check mt-2">
                          <input class="form-check-input" type="checkbox" id="alsoAttachWww"
                                 [(ngModel)]="alsoAttachWww"
                                 [disabled]="operationBusy || customDomainBusy || !environmentSubdomainReady()">
                          <label class="form-check-label small" for="alsoAttachWww">
                            Also attach the <code>www.</code> variant so both apex and www serve the site
                          </label>
                        </div>
                      }
                      @if (customDomainError) {
                        <p class="small text-danger mt-2 mb-0">{{ customDomainError }}</p>
                      }
                      @if (customDomainMessages.length > 0) {
                        <div class="mt-3">
                          <app-session-logs [messages]="customDomainMessages"></app-session-logs>
                        </div>
                      }
                      @if (customDomains().length > 0) {
                        <div class="table-responsive mt-3">
                          <table class="table table-sm align-middle mb-0 custom-domains-table">
                            <thead>
                              <tr>
                                <th scope="col" class="col-hostname">Hostname</th>
                                <th scope="col" class="col-status">Status</th>
                                <th scope="col" class="col-added">Added</th>
                                <th scope="col" class="text-end col-actions">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (domain of customDomains(); track domain.hostname) {
                                <tr>
                                  <td class="col-hostname">
                                    <fa-icon [icon]="faGlobe" class="me-2 fa-icon-globe"></fa-icon>
                                    <a [href]="'https://' + domain.hostname" target="_blank">{{ domain.hostname }}</a>
                                  </td>
                                  <td class="col-status">
                                    <div>
                                      <span class="badge" [class]="domainBadgeClass(domain.status)">{{ domainStatusLabel(domain.status) }}</span>
                                    </div>
                                    @if (domain.message && domain.message !== domain.status) {
                                      <div class="small text-muted mt-1 domain-status-detail">{{ domain.message }}</div>
                                    }
                                  </td>
                                  <td class="col-added">{{ domain.addedAt ? (domain.addedAt | date:"short") : "" }}</td>
                                  <td class="text-end col-actions">
                                    <div class="d-inline-flex gap-1">
                                      <button class="btn btn-sm btn-quiet icon-only"
                                              (click)="checkCustomDomain(domain)"
                                              [disabled]="operationBusy || customDomainBusy"
                                              tooltip="Check &amp; reconcile DNS/cert"
                                              container="body"
                                              aria-label="Check">
                                        @if (checkingDomainHostname === domain.hostname) {
                                          <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                                        } @else {
                                          <fa-icon [icon]="faRedo"></fa-icon>
                                        }
                                      </button>
                                      <button class="btn btn-sm btn-danger icon-only"
                                              (click)="removeCustomDomain(domain)"
                                              [disabled]="operationBusy || customDomainBusy"
                                              tooltip="Remove custom domain"
                                              container="body"
                                              aria-label="Remove">
                                        @if (removingDomainHostname === domain.hostname) {
                                          <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                                        } @else {
                                          <fa-icon [icon]="faTrash"></fa-icon>
                                        }
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    </div>

                    <div class="hostname-part mt-4 pt-3 border-top">
                      <div class="fw-bold">Apex / www redirect</div>
                      <p class="small text-muted mb-2">
                        Only after a custom domain is attached, and only when one half of a pair (bare apex vs
                        <code>www.</code>) should send visitors to the other. It does not put the site on a new host.
                        Enter the hostname that already serves the site. Skip if both variants already serve, or you
                        have no custom domain.
                        @if (!canSetupApexRedirect()) {
                          Available after a custom domain is attached.
                        }
                      </p>
                      <div class="d-flex gap-2 align-items-start flex-wrap">
                        <input type="text" class="form-control" style="max-width: 320px;"
                               placeholder="Serving host e.g. www.your-group.org.uk"
                               [(ngModel)]="apexRedirectHostname"
                               [disabled]="operationBusy || customDomainBusy || apexRedirectBusy || !canSetupApexRedirect()">
                        <button class="btn btn-primary" (click)="setupApexRedirect()"
                                [disabled]="operationBusy || customDomainBusy || apexRedirectBusy || !apexRedirectHostname || !canSetupApexRedirect()">
                          @if (apexRedirectBusy) {
                            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                          } @else {
                            <fa-icon [icon]="faGlobe" class="me-1"></fa-icon>
                          }
                          Set up redirect
                        </button>
                      </div>
                      @if (apexRedirectError) {
                        <p class="small text-danger mt-2 mb-0">{{ apexRedirectError }}</p>
                      }
                      @if (apexRedirectMessages.length > 0) {
                        <div class="mt-3">
                          <app-session-logs [messages]="apexRedirectMessages"></app-session-logs>
                        </div>
                      }
                    </div>
                  </div>
                </div>
                <div class="row mt-3">
                  <div class="col-md-12 d-flex gap-2 align-items-start flex-wrap">
                    <button class="btn btn-primary" (click)="resumeSetup()"
                            [disabled]="operationBusy">
                      @if (resuming) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                      }
                      Run selected steps
                    </button>
                    <button type="button" class="btn btn-quiet" (click)="generateAdminPasswordReset()"
                            [disabled]="operationBusy || generatingPasswordReset">
                      @if (generatingPasswordReset) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faKey" class="me-1"></fa-icon>
                      }
                      Reset Admin Password
                    </button>
                    @if (canRemoveNgxSubdomain()) {
                      <button class="btn btn-danger" (click)="requestRemoveNgxSubdomain()"
                              [disabled]="operationBusy || removingNgxSubdomain || removeNgxSubdomainConfirming"
                              tooltip="Delete the <env>.ngx-ramblers.org.uk DNS records and Fly cert"
                              container="body">
                        @if (removingNgxSubdomain) {
                          <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                        } @else {
                          <fa-icon [icon]="faTrash" class="me-1"></fa-icon>
                        }
                        Remove NGX Subdomain
                      </button>
                    }
                  </div>
                  @if (removeNgxSubdomainConfirming) {
                    <div class="alert alert-warning d-flex align-items-center justify-content-between mt-3 mb-0">
                      <span>
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        <strong>Remove the NGX subdomain ({{ selectedExistingEnv.name }}.ngx-ramblers.org.uk)?</strong>
                        This deletes its DNS records and Fly certificate. The app will only be reachable via its attached custom domains.
                      </span>
                      <div class="btn-group btn-group-sm ms-3">
                        <button type="button" class="btn btn-danger" [disabled]="removingNgxSubdomain"
                                (click)="confirmRemoveNgxSubdomain()">Remove</button>
                        <button type="button" class="btn btn-quiet"
                                (click)="cancelRemoveNgxSubdomain()">Cancel</button>
                      </div>
                    </div>
                  }
                </div>
              }
              @if (manageAction === ManageAction.MIGRATE_FLY_ORG) {
                <div class="row mt-3">
                  <div class="col-md-12">
                    <p class="text-muted small mb-3">
                      Fly cannot move an app between orgs. Enter the <strong>old</strong> token that owns the app now,
                      and the <strong>new</strong> org-scoped token for the destination. Cutover creates the app under
                      the new token, deploys the same image and secrets, re-points custom domain DNS/SSL (from Site URL
                      and configured custom domains) at the destination app, optionally re-attaches the free NGX
                      subdomain, then optionally destroys the old app. If a previous run stopped mid-way, status below
                      shows what is already done so <strong>Resume cutover</strong> only finishes remaining steps.
                    </p>
                    <div class="row fly-migrate-panels">
                      <div class="col-md-6">
                        <div class="thumbnail-heading-frame">
                          <div class="thumbnail-heading">Old Fly credentials (source)</div>
                          <div class="mb-2">
                            <label class="form-label" for="flyMigrateOldApiKey">API token</label>
                            <app-secret-input
                              [(ngModel)]="flyMigrateForm.oldApiKey"
                              name="flyMigrateOldApiKey"
                              [size]="InputSize.SM">
                            </app-secret-input>
                          </div>
                          <div class="mb-2">
                            <label class="form-label" for="flyMigrateOldOrg">Organisation</label>
                            <input type="text" class="form-control form-control-sm" id="flyMigrateOldOrg"
                                   [(ngModel)]="flyMigrateForm.oldOrganisation" name="flyMigrateOldOrg"
                                   autocomplete="off" placeholder="personal">
                          </div>
                          <div class="mb-0">
                            <label class="form-label" for="flyMigrateOldApp">App name</label>
                            <input type="text" class="form-control form-control-sm" id="flyMigrateOldApp"
                                   [(ngModel)]="flyMigrateForm.oldAppName" name="flyMigrateOldApp"
                                   autocomplete="off">
                          </div>
                        </div>
                      </div>
                      <div class="col-md-6">
                        <div class="thumbnail-heading-frame">
                          <div class="thumbnail-heading">New Fly credentials (destination)</div>
                          <div class="mb-2">
                            <label class="form-label" for="flyMigrateNewApiKey">API token</label>
                            <app-secret-input
                              [(ngModel)]="flyMigrateForm.newApiKey"
                              name="flyMigrateNewApiKey"
                              [size]="InputSize.SM">
                            </app-secret-input>
                          </div>
                          <div class="mb-2">
                            <label class="form-label" for="flyMigrateNewOrg">Organisation</label>
                            <input type="text" class="form-control form-control-sm" id="flyMigrateNewOrg"
                                   [(ngModel)]="flyMigrateForm.newOrganisation" name="flyMigrateNewOrg"
                                   autocomplete="off" placeholder="e.g. ramblers">
                          </div>
                          <div class="mb-0">
                            <label class="form-label" for="flyMigrateNewApp">App name</label>
                            <input type="text" class="form-control form-control-sm" id="flyMigrateNewApp"
                                   [(ngModel)]="flyMigrateForm.newAppName" name="flyMigrateNewApp"
                                   autocomplete="off">
                            <small class="form-text text-muted">Usually the same name as the old app</small>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="fly-migrate-detect d-flex align-items-center gap-2 flex-wrap mb-3">
                      <button type="button" class="btn btn-quiet d-inline-flex align-items-center"
                              (click)="probeFlyOrgMigrationStatus()"
                              [disabled]="operationBusy || loadingFlyMigrationStatus || !canProbeFlyOrgMigration()">
                        @if (loadingFlyMigrationStatus) {
                          <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>
                        } @else {
                          <fa-icon [icon]="faRedo" class="me-2"></fa-icon>
                        }
                        Detect cutover state
                      </button>
                      @if (flyMigrationStatus) {
                        <span class="small text-muted">{{ flyMigrationStatus.summary }}</span>
                      }
                    </div>
                    @if (flyMigrationStatusError) {
                      <div class="alert alert-warning mb-2">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        {{ flyMigrationStatusError }}
                      </div>
                    }
                    @if (flyMigrationStatus) {
                      <div class="fly-migrate-status resume-steps mb-3">
                        <div class="resume-step">
                          <span class="resume-step-label">
                            <span class="resume-step-text">Preferred app under destination token</span>
                            <span class="badge resume-step-badge"
                                  [class]="flyMigrationStatus.preferredExistsUnderNew ? 'bg-success' : 'bg-warning'">
                              {{ flyMigrationStatus.preferredExistsUnderNew ? "done" : "needed" }}
                            </span>
                          </span>
                        </div>
                        <div class="resume-step">
                          <span class="resume-step-label">
                            <span class="resume-step-text">Preferred app deployed</span>
                            <span class="badge resume-step-badge"
                                  [class]="flyMigrationStatus.preferredDeployedUnderNew ? 'bg-success' : 'bg-warning'">
                              {{ flyMigrationStatus.preferredDeployedUnderNew ? "done" : "needed" }}
                            </span>
                          </span>
                        </div>
                        <div class="resume-step">
                          <span class="resume-step-label">
                            <span class="resume-step-text">Source app removed</span>
                            <span class="badge resume-step-badge"
                                  [class]="!flyMigrationStatus.sourceExistsUnderOld ? 'bg-success' : 'bg-warning'">
                              {{ !flyMigrationStatus.sourceExistsUnderOld ? "done" : "needed" }}
                            </span>
                          </span>
                        </div>
                        <div class="resume-step">
                          <span class="resume-step-label">
                            <span class="resume-step-text">Temporary cutover app cleaned up</span>
                            <span class="badge resume-step-badge"
                                  [class]="!flyMigrationStatus.cutoverExistsUnderNew ? 'bg-success' : 'bg-warning'">
                              {{ !flyMigrationStatus.cutoverExistsUnderNew ? "done" : "needed" }}
                            </span>
                          </span>
                        </div>
                        <div class="resume-step">
                          <span class="resume-step-label">
                            <span class="resume-step-text">Config points at preferred app</span>
                            <span class="badge resume-step-badge"
                                  [class]="flyMigrationStatus.configPointsAtPreferred && !flyMigrationStatus.hasPreviousCredentials ? 'bg-success' : 'bg-warning'">
                              {{ flyMigrationStatus.configPointsAtPreferred && !flyMigrationStatus.hasPreviousCredentials ? "done" : "needed" }}
                            </span>
                          </span>
                        </div>
                        <div class="resume-step">
                          <span class="resume-step-label">
                            <span class="resume-step-text">
                              Custom domain DNS/SSL on destination
                              @if (flyMigrationStatus.customDomainHostnames?.length) {
                                <span class="text-muted"> ({{ flyMigrationStatus.customDomainHostnames.join(", ") }})</span>
                              }
                            </span>
                            <span class="badge resume-step-badge"
                                  [class]="!flyMigrationStatus.needsCustomDomainReattach ? 'bg-success' : 'bg-warning'">
                              {{ !flyMigrationStatus.needsCustomDomainReattach ? "done" : "needed" }}
                            </span>
                          </span>
                        </div>
                      </div>
                    }
                    <div class="fly-migrate-options">
                      <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" id="destroyOldFlyAppManage"
                               [(ngModel)]="flyMigrateOptions.destroyOldApp" name="destroyOldFlyAppManage">
                        <label class="form-check-label" for="destroyOldFlyAppManage">
                          Destroy previous Fly app after the new app is healthy
                        </label>
                      </div>
                      <div class="form-check mb-3">
                        <input class="form-check-input" type="checkbox" id="reattachSubdomainOnMigrateManage"
                               [(ngModel)]="flyMigrateOptions.reattachSubdomain" name="reattachSubdomainOnMigrateManage">
                        <label class="form-check-label" for="reattachSubdomainOnMigrateManage">
                          Re-attach free NGX subdomain ({{ selectedExistingEnv.name }}.ngx-ramblers.org.uk) DNS/SSL only — leave off if this site uses a custom domain only
                        </label>
                      </div>
                    </div>
                    @if (progressMessages.length > 0) {
                      <app-session-logs [messages]="progressMessages"></app-session-logs>
                    }
                    @if (flyMigrationComplete && setupResult) {
                      <div class="alert alert-success mt-3 mb-0">
                        <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                        <strong>Fly organisation migration completed.</strong>
                        @if (setupResult.appUrl) {
                          <br>App URL: <a [href]="setupResult.appUrl" target="_blank">{{ setupResult.appUrl }}</a>
                        }
                        @if (setupResult.appName) {
                          <br>App name: <code>{{ setupResult.appName }}</code>
                        }
                      </div>
                    }
                    @if (setupError) {
                      <div class="alert alert-danger mt-3 mb-0">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        <strong>Error:</strong> {{ setupError }}
                      </div>
                    }
                    <button class="btn btn-primary mt-3"
                            (click)="runFlyOrgMigration()"
                            [disabled]="operationBusy || (flyMigrationStatus?.phase === FlyOrgMigrationPhase.COMPLETE && !flyMigrationStatus?.needsCustomDomainReattach)">
                      @if (migratingFlyOrg) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faPlaneDeparture" class="me-1"></fa-icon>
                      }
                      {{ flyMigrationPrimaryButtonLabel() }}
                    </button>
                  </div>
                </div>
              }
              @if (manageAction === ManageAction.DESTROY) {
                <div class="row mt-3">
                  <div class="col-md-12">
                    <div class="alert alert-danger">
                      <fa-icon [icon]="faExclamationCircle" class="me-2"></fa-icon>
                      <strong>Warning:</strong> This will permanently destroy the environment <strong>{{ selectedExistingEnv.name }}</strong>.
                      <ul class="mb-0 mt-2">
                        <li>Delete the Fly.io app: <strong>{{ selectedExistingEnv.appName }}</strong></li>
                        <li>Delete the S3 bucket: <strong>ngx-ramblers-{{ selectedExistingEnv.name.toLowerCase() }}</strong></li>
                        <li>Delete the IAM user: <strong>ngx-ramblers-{{ selectedExistingEnv.name.toLowerCase() }}-user</strong></li>
                        <li>Clear all collections in database: <strong>ngx-ramblers-{{ selectedExistingEnv.name.toLowerCase() }}</strong></li>
                        <li>Remove environment configuration from database</li>
                        <li>Delete the local secrets file</li>
                      </ul>
                      <p class="mt-3 mb-0"><strong>This action is irreversible.</strong></p>
                    </div>
                    @if (destroyProgressMessages.length > 0) {
                      <app-session-logs [messages]="destroyProgressMessages"></app-session-logs>
                    }
                    @if (destroyComplete) {
                      <div class="alert alert-success mt-3 mb-0">
                        <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                        <strong>Environment destroyed successfully.</strong>
                      </div>
                    }
                    @if (destroyError) {
                      <div class="alert alert-danger mt-3 mb-0">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        {{ destroyError }}
                      </div>
                    }
                    <button class="btn btn-danger mt-3" (click)="destroyEnvironment()"
                            [disabled]="operationBusy || destroyComplete">
                      @if (destroying) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                      }
                      Destroy Environment
                    </button>
                  </div>
                </div>
              }
            }
          }
        </div>
      }

      @if (notifyTarget.showAlert) {
        <div class="alert {{ notifyTarget.alert.class }} mt-3">
          <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
          @if (notifyTarget.alertTitle) {
            <strong>{{ notifyTarget.alertTitle }}: </strong>
          }
          {{ notifyTarget.alertMessage }}
        </div>
      }
    }
  `
})
export class EnvironmentManagement implements OnInit, OnDestroy {
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("EnvironmentManagement", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private environmentConfigService = inject(EnvironmentConfigService);
  private websocketService = inject(WebSocketClientService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  protected stringUtils = inject(StringUtilsService);
  protected readonly HostnameOrigin = HostnameOrigin;
  protected readonly InputSize = InputSize;

  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;
  notifyTarget: AlertTarget = {};
  private wsConnected = false;

  enabled = false;
  loading = false;
  loadingStatus = false;
  existingEnvironments: ExistingEnvironment[] = [];
  selectedExistingEnv: ExistingEnvironment | null = null;
  operationInProgress = OperationInProgress.NONE;
  manageAction: ManageAction = ManageAction.MODIFY;
  protected readonly ManageAction = ManageAction;
  envStatus: EnvironmentStatus | null = null;

  resumeOptions = {
    runDbInit: false,
    runFlyDeployment: false,
    copyStandardAssets: false,
    setupSubdomain: false,
    includeSamplePages: false,
    includeNotificationConfigs: false,
    authenticateBrevoDomain: false
  };

  flyMigrateOptions = {
    destroyOldApp: true,
    reattachSubdomain: false
  };

  flyMigrateForm = {
    oldApiKey: "",
    oldOrganisation: "",
    oldAppName: "",
    newApiKey: "",
    newOrganisation: "",
    newAppName: ""
  };

  flyMigrationStatus: FlyOrgMigrationStatus | null = null;
  flyMigrationStatusError: string | null = null;
  loadingFlyMigrationStatus = false;
  protected readonly FlyOrgMigrationPhase = FlyOrgMigrationPhase;

  progressMessages: string[] = [];
  setupResult: { environmentName: string; appName: string; appUrl: string } | null = null;
  setupError: string | null = null;
  setupWarnings: string[] = [];
  flyMigrationComplete = false;

  destroyProgressMessages: string[] = [];
  destroyComplete = false;
  destroyError: string | null = null;

  passwordResetResult: { resetUrl?: string; flyResetUrl?: string; userName?: string; email?: string } | null = null;
  generatingPasswordReset = false;
  removingNgxSubdomain = false;
  removeNgxSubdomainConfirming = false;

  customDomainHostname = "";
  customDomainBusy = false;
  customDomainError: string | null = null;
  customDomainMessages: string[] = [];
  removingDomainHostname: string | null = null;
  checkingDomainHostname: string | null = null;
  alsoAttachWww = true;

  apexRedirectHostname = "";
  apexRedirectBusy = false;
  siteUrlBusy = false;
  apexRedirectError: string | null = null;
  apexRedirectMessages: string[] = [];
  hostnameHealthReport: HostnameHealthReport | null = null;
  hostnameHealthError: string | null = null;
  loadingHostnameHealth = false;
  protected readonly HostnameHealth = HostnameHealth;

  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faCog = faCog;
  protected readonly faExclamationCircle = faExclamationCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faGlobe = faGlobe;
  protected readonly faKey = faKey;
  protected readonly faPlaneDeparture = faPlaneDeparture;
  protected readonly faPlus = faPlus;
  protected readonly faRedo = faRedo;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;

  get resuming(): boolean {
    return this.operationInProgress === OperationInProgress.CREATING;
  }

  get destroying(): boolean {
    return this.operationInProgress === OperationInProgress.DESTROYING;
  }

  get migratingFlyOrg(): boolean {
    return this.operationInProgress === OperationInProgress.MIGRATING_FLY_ORG;
  }

  get operationBusy(): boolean {
    return this.operationInProgress !== OperationInProgress.NONE;
  }

  canRunFlyOrgMigration(): boolean {
    if (!this.selectedExistingEnv) {
      return false;
    } else if (this.flyMigrationStatus?.phase === FlyOrgMigrationPhase.COMPLETE && !this.flyMigrationStatus?.needsCustomDomainReattach) {
      return false;
    } else if (this.flyMigrationStatus?.resumeAvailable || this.flyMigrationStatus?.needsCustomDomainReattach) {
      return true;
    } else {
      const form = this.flyMigrateForm;
      const oldReady = !!(form.oldApiKey && form.oldAppName);
      const newReady = !!(form.newApiKey && form.newAppName);
      const credentialsDiffer = form.oldApiKey !== form.newApiKey || form.oldOrganisation !== form.newOrganisation;
      const hasStoredDestinationToken = !!this.selectedExistingEnv.hasApiKey;
      return !!(oldReady && newReady && credentialsDiffer) || !!(hasStoredDestinationToken && form.newAppName);
    }
  }

  canProbeFlyOrgMigration(): boolean {
    return !!this.selectedExistingEnv;
  }

  flyMigrationPrimaryButtonLabel(): string {
    if (this.migratingFlyOrg) {
      return "Migrating…";
    } else if (this.flyMigrationStatus?.phase === FlyOrgMigrationPhase.COMPLETE && !this.flyMigrationStatus?.needsCustomDomainReattach) {
      return "Cutover already complete";
    } else if (this.flyMigrationStatus?.resumeAvailable || this.flyMigrationStatus?.needsCustomDomainReattach) {
      return "Resume cutover";
    } else {
      return "Move to this Fly organisation";
    }
  }

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    try {
      const status = await this.environmentSetupService.status();
      this.enabled = status.enabled;
      if (this.enabled) {
        await this.loadExistingEnvironments();
        await this.connectWebSocket();
        await this.applyStateFromQueryParams();
      }
    } catch (error) {
      this.logger.error("Failed to check setup status:", error);
      this.enabled = false;
    }
  }

  private async applyStateFromQueryParams(): Promise<void> {
    const params = this.activatedRoute.snapshot.queryParams;
    const manageActionParameter = params[StoredValue.MANAGE_ACTION];
    if (manageActionParameter && values(ManageAction).includes(manageActionParameter)) {
      this.manageAction = manageActionParameter;
    }
    const environmentParameter = params[StoredValue.ENVIRONMENT];
    const matched = this.existingEnvironments.find(environment => environment.name === environmentParameter);
    if (matched) {
      this.selectedExistingEnv = matched;
      await this.onExistingEnvironmentSelected(matched);
    } else if (this.manageAction === ManageAction.MIGRATE_FLY_ORG) {
      await this.populateFlyMigrateForm();
    }
  }

  private updateQueryParams(queryParams: Record<string, string | null>): void {
    this.router.navigate([], { queryParams, queryParamsHandling: "merge" });
  }

  setManageAction(action: ManageAction): void {
    this.manageAction = action;
    this.updateQueryParams({ [StoredValue.MANAGE_ACTION]: action });
    if (action === ManageAction.MIGRATE_FLY_ORG) {
      void this.populateFlyMigrateForm();
    }
  }

  private async populateFlyMigrateForm(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.resetFlyMigrateForm();
    } else {
      try {
        await this.environmentConfigService.refresh();
        const config = this.environmentConfigService.cachedEnvironmentsConfig();
        const envConfig = (config?.environments || []).find(item => item.environment === this.selectedExistingEnv.name);
        const flyio = envConfig?.flyio;
        const appName = flyio?.appName || this.selectedExistingEnv.appName || "";
        const preferredAppName = appName.replace(/-cutover$/, "") || appName;
        const currentOrg = flyio?.organisation || this.selectedExistingEnv.organisation || "personal";
        const currentApiKey = flyio?.apiKey || "";
        if (flyio?.previous?.apiKey) {
          const oldOrganisation = flyio.previous.organisation || currentOrg || "personal";
          this.flyMigrateForm = {
            oldApiKey: flyio.previous.apiKey || "",
            oldOrganisation,
            oldAppName: flyio.previous.appName || preferredAppName,
            newApiKey: currentApiKey,
            newOrganisation: currentOrg || oldOrganisation,
            newAppName: preferredAppName
          };
        } else {
          this.flyMigrateForm = {
            oldApiKey: currentApiKey,
            oldOrganisation: currentOrg,
            oldAppName: preferredAppName,
            newApiKey: "",
            newOrganisation: currentOrg,
            newAppName: preferredAppName
          };
        }
        await this.probeFlyOrgMigrationStatus();
      } catch (error) {
        this.logger.error("Failed to load Fly credentials for migration form:", error);
        const fallbackOrg = this.selectedExistingEnv.organisation || "personal";
        this.flyMigrateForm = {
          oldApiKey: "",
          oldOrganisation: fallbackOrg,
          oldAppName: this.selectedExistingEnv.appName || "",
          newApiKey: "",
          newOrganisation: fallbackOrg,
          newAppName: this.selectedExistingEnv.appName || ""
        };
      }
    }
  }

  private resetFlyMigrateForm(): void {
    this.flyMigrateForm = {
      oldApiKey: "",
      oldOrganisation: "",
      oldAppName: "",
      newApiKey: "",
      newOrganisation: "",
      newAppName: ""
    };
    this.flyMigrationStatus = null;
    this.flyMigrationStatusError = null;
  }

  async probeFlyOrgMigrationStatus(): Promise<void> {
    if (!this.selectedExistingEnv || !this.canProbeFlyOrgMigration()) {
      this.flyMigrationStatus = null;
    } else {
      this.loadingFlyMigrationStatus = true;
      this.flyMigrationStatusError = null;
      try {
        this.flyMigrationStatus = await this.environmentSetupService.flyOrgMigrationStatus(
          this.selectedExistingEnv.name,
          {
            previousApiKey: this.flyMigrateForm.oldApiKey,
            previousOrganisation: this.flyMigrateForm.oldOrganisation || "personal",
            previousAppName: this.flyMigrateForm.oldAppName,
            newApiKey: this.flyMigrateForm.newApiKey,
            newOrganisation: this.flyMigrateForm.newOrganisation || "personal",
            newAppName: this.flyMigrateForm.newAppName
          }
        );
      } catch (error) {
        this.flyMigrationStatus = null;
        this.flyMigrationStatusError = this.extractErrorDetail(error);
        this.logger.error("Failed to probe Fly org migration status:", error);
      } finally {
        this.loadingFlyMigrationStatus = false;
      }
    }
  }

  private async connectWebSocket(): Promise<void> {
    try {
      await this.websocketService.connect();
      this.wsConnected = true;
      this.logger.info("WebSocket connected");

      this.subscriptions.push(
        this.websocketService.receiveMessages<{ message: string }>(MessageType.PROGRESS).subscribe(data => {
          this.logger.info("Progress:", data);
          if (data?.message) {
            this.progressMessages.push(data.message);
          }
        }),
        this.websocketService.receiveMessages<{ message: string; result?: { environmentName: string; appName: string; appUrl: string } }>(MessageType.COMPLETE).subscribe(async data => {
          this.logger.info("Complete:", data);
          const pendingResult = data?.result ? {
            environmentName: data.result.environmentName,
            appName: data.result.appName,
            appUrl: data.result.appUrl
          } : null;
          this.progressMessages.push(data?.message || "Completed");
          if (this.operationInProgress === OperationInProgress.MIGRATING_FLY_ORG) {
            await this.finishFlyOrgMigration(pendingResult);
          } else {
            await this.finishResumeAfterDeploy(pendingResult);
          }
          this.operationInProgress = OperationInProgress.NONE;
        }),
        this.websocketService.receiveMessages<{ message?: string; transient?: boolean }>(MessageType.ERROR).subscribe(data => {
          this.logger.error("WebSocket error:", data);
          const isTransient = data?.transient === true;
          if (isTransient) {
            this.progressMessages.push("Connection lost - server operation may still be running. Check Fly.io dashboard for deployment status.");
          } else {
            this.operationInProgress = OperationInProgress.NONE;
            this.setupError = data?.message || "An error occurred";
            this.progressMessages.push(`Error: ${this.setupError}`);
          }
        })
      );
    } catch (error) {
      this.logger.error("Failed to connect WebSocket:", error);
      this.wsConnected = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  async loadExistingEnvironments(): Promise<void> {
    this.loading = true;
    try {
      const response = await this.environmentSetupService.existingEnvironments();
      this.existingEnvironments = (response.environments || []).sort(sortBy("name"));
      this.logger.info("Loaded existing environments:", this.existingEnvironments.length);
    } catch (error) {
      this.logger.error("Failed to load existing environments:", error);
      this.notify.error({ title: "Error", message: "Failed to load environments" });
    } finally {
      this.loading = false;
    }
  }

  async onExistingEnvironmentSelected(env: ExistingEnvironment): Promise<void> {
    const preservedManageAction = this.manageAction;
    this.clearState();
    this.manageAction = preservedManageAction;
    this.updateQueryParams({ [StoredValue.ENVIRONMENT]: env?.name || null });
    if (env) {
      await Promise.all([this.probeEnvironmentStatus(env.name), this.probeHostnameHealth(env.name)]);
      this.apexRedirectHostname = this.suggestedApexRedirectHostname(env);
      if (this.manageAction === ManageAction.MIGRATE_FLY_ORG) {
        await this.populateFlyMigrateForm();
      }
    }
  }

  private suggestedApexRedirectHostname(env: ExistingEnvironment): string {
    const serving = (this.hostnameHealthReport?.hostnames || []).find(hostname => hostname.health === HostnameHealth.SERVING);
    const attached = (env.customDomains || []).find(domain => domain.status === CustomDomainStatus.ATTACHED);
    return serving?.hostname || attached?.hostname || "";
  }

  private async probeHostnameHealth(environmentName: string): Promise<void> {
    this.loadingHostnameHealth = true;
    this.hostnameHealthReport = null;
    this.hostnameHealthError = null;
    try {
      this.hostnameHealthReport = await this.environmentSetupService.hostnameHealth(environmentName);
      this.logger.info("Hostname health:", this.hostnameHealthReport);
    } catch (error) {
      this.hostnameHealthError = this.extractErrorDetail(error);
      this.logger.error("Failed to probe hostname health:", error);
    } finally {
      this.loadingHostnameHealth = false;
    }
  }

  hostnameDetail(hostname: HostnameStatus): string {
    return hostname.health === HostnameHealth.REDIRECTING ? hostname.message : "";
  }

  hostnameStatuses(): HostnameStatus[] {
    return this.hostnameHealthReport?.hostnames || [];
  }

  hostnameProblems(): HostnameStatus[] {
    return this.hostnameStatuses().filter(hostname => !hostname.healthy);
  }

  hostnameBadgeClass(hostname: HostnameStatus): string {
    if (hostname.healthy) {
      return "bg-success";
    } else if (hostname.health === HostnameHealth.NO_DNS || hostname.health === HostnameHealth.REDIRECT_TARGET_MISSING) {
      return "bg-danger";
    } else {
      return "bg-warning text-dark";
    }
  }

  hostnameHealthLabel(hostname: HostnameStatus): string {
    return hostnameHealthLabels[hostname.health] || hostname.health;
  }

  hostnameOriginLabel(hostname: HostnameStatus): string {
    return hostnameOriginLabels[hostname.origin] || hostname.origin;
  }

  hostnameDnsSummary(hostname: HostnameStatus): string {
    if (!hostname.dnsRecordType) {
      return "no record";
    } else {
      const proxyState = hostname.proxied ? "proxied" : "DNS only";
      return `${hostname.dnsRecordType} ${hostname.dnsContent} (${proxyState})`;
    }
  }

  hostnameActionStatement(hostname: HostnameStatus): string {
    if (hostname.origin === HostnameOrigin.SITE_URL && this.isNationalSiteUrl(hostname)) {
      return "Wrong Site URL (Ramblers national group page). Clear it, then once the environment subdomain is live use Use as Site URL on that row.";
    } else if (hostname.origin === HostnameOrigin.SITE_URL && this.isEnvironmentSubdomainHost(hostname)) {
      return "Site URL is already the free environment host you want. It is not live yet: tick Deploy to Fly.io and Setup subdomain under Steps to run, then Run selected steps. No need to clear this URL.";
    } else if (hostname.origin === HostnameOrigin.SITE_URL) {
      return `${hostname.message} If this is not the address you want, Clear Site URL; otherwise bring the host online first.`;
    } else if (hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN) {
      return "Not live yet. Use Setup subdomain under Steps to run, then Run selected steps.";
    } else if (hostname.origin === HostnameOrigin.CUSTOM_DOMAIN) {
      return `${hostname.message} Check or re-attach the domain in Attach a custom domain below.`;
    } else if (hostname.origin === HostnameOrigin.SIBLING) {
      return `${hostname.message} Use Apex / www redirect below if only one variant should serve.`;
    } else {
      return hostname.message;
    }
  }

  isNationalSiteUrl(hostname: HostnameStatus): boolean {
    return ramblersNationalUrl(`https://${hostname.hostname}`);
  }

  isEnvironmentSubdomainHost(hostname: HostnameStatus): boolean {
    return hostname.hostname === this.environmentSubdomainHint()
      || hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN;
  }

  shouldOfferClearSiteUrl(hostname: HostnameStatus): boolean {
    return hostname.origin === HostnameOrigin.SITE_URL
      && !this.isEnvironmentSubdomainHost(hostname);
  }

  async refreshHostnameHealth(): Promise<void> {
    if (this.selectedExistingEnv) {
      await this.probeHostnameHealth(this.selectedExistingEnv.name);
    }
  }

  canUseAsSiteUrl(hostname: HostnameStatus): boolean {
    const alreadySite = this.hostnameStatuses().some(status =>
      status.origin === HostnameOrigin.SITE_URL && status.hostname === hostname.hostname);
    return !alreadySite
      && (hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN || hostname.origin === HostnameOrigin.CUSTOM_DOMAIN);
  }

  environmentSubdomainHint(): string {
    const fromHealth = this.hostnameStatuses().find(status => status.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN);
    if (fromHealth) {
      return fromHealth.hostname;
    } else if (this.selectedExistingEnv) {
      return `${this.selectedExistingEnv.name}.ngx-ramblers.org.uk`;
    } else {
      return "your-env.ngx-ramblers.org.uk";
    }
  }

  environmentSubdomainReady(): boolean {
    return this.envStatus?.subdomainConfigured === true
      || this.hostnameStatuses().some(status =>
        status.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN && status.healthy);
  }

  canSetupApexRedirect(): boolean {
    return this.customDomains().length > 0
      || this.hostnameStatuses().some(status =>
        status.origin === HostnameOrigin.CUSTOM_DOMAIN && status.healthy);
  }

  async clearSiteUrl(): Promise<void> {
    if (this.selectedExistingEnv) {
      this.siteUrlBusy = true;
      try {
        const result = await this.environmentSetupService.updateSiteUrl(this.selectedExistingEnv.name, null);
        if (result.success) {
          this.notify.success({title: "Site URL cleared", message: result.message});
          await this.probeHostnameHealth(this.selectedExistingEnv.name);
        } else {
          this.notify.error({title: "Could not clear Site URL", message: result.message});
        }
      } catch (error) {
        this.notify.error({title: "Could not clear Site URL", message: this.extractErrorDetail(error)});
      } finally {
        this.siteUrlBusy = false;
      }
    }
  }

  async setSiteUrlFromHostname(hostname: HostnameStatus): Promise<void> {
    if (this.selectedExistingEnv) {
      this.siteUrlBusy = true;
      try {
        const siteUrl = `https://${hostname.hostname}`;
        const result = await this.environmentSetupService.updateSiteUrl(this.selectedExistingEnv.name, siteUrl);
        if (result.success) {
          this.notify.success({title: "Site URL updated", message: result.message});
          await this.probeHostnameHealth(this.selectedExistingEnv.name);
        } else {
          this.notify.error({title: "Could not set Site URL", message: result.message});
        }
      } catch (error) {
        this.notify.error({title: "Could not set Site URL", message: this.extractErrorDetail(error)});
      } finally {
        this.siteUrlBusy = false;
      }
    }
  }

  private async probeEnvironmentStatus(environmentName: string): Promise<void> {
    this.loadingStatus = true;
    this.envStatus = null;
    try {
      this.envStatus = await this.environmentSetupService.environmentStatus(environmentName);
      this.resumeOptions = {
        runDbInit: !this.envStatus.databaseInitialised,
        runFlyDeployment: !this.envStatus.flyAppDeployed,
        copyStandardAssets: !this.envStatus.standardAssetsPresent,
        setupSubdomain: !this.envStatus.subdomainConfigured,
        includeSamplePages: !this.envStatus.samplePagesPresent,
        includeNotificationConfigs: !this.envStatus.notificationConfigsPresent,
        authenticateBrevoDomain: !this.envStatus.brevoDomainAuthenticated
      };
      this.logger.info("Environment status:", this.envStatus, "Resume options:", this.resumeOptions);
    } catch (error) {
      this.logger.error("Failed to probe environment status:", error);
      this.resumeOptions = {
        runDbInit: false,
        runFlyDeployment: true,
        copyStandardAssets: false,
        setupSubdomain: false,
        includeSamplePages: false,
        includeNotificationConfigs: false,
        authenticateBrevoDomain: false
      };
    } finally {
      this.loadingStatus = false;
    }
  }

  private clearState(): void {
    this.progressMessages = [];
    this.setupResult = null;
    this.setupError = null;
    this.setupWarnings = [];
    this.flyMigrationComplete = false;
    this.resetFlyMigrateForm();
    this.flyMigrationStatus = null;
    this.flyMigrationStatusError = null;
    this.destroyProgressMessages = [];
    this.destroyComplete = false;
    this.destroyError = null;
    this.passwordResetResult = null;
    this.manageAction = ManageAction.MODIFY;
    this.envStatus = null;
    this.customDomainHostname = "";
    this.customDomainMessages = [];
    this.customDomainError = null;
    this.removingDomainHostname = null;
    this.checkingDomainHostname = null;
    this.alsoAttachWww = true;
    this.apexRedirectHostname = "";
    this.apexRedirectBusy = false;
    this.apexRedirectError = null;
    this.apexRedirectMessages = [];
    this.hostnameHealthReport = null;
    this.hostnameHealthError = null;
    this.loadingHostnameHealth = false;
  }

  customDomains(): CustomDomainEntry[] {
    return this.selectedExistingEnv?.customDomains || [];
  }

  domainBadgeClass(status: CustomDomainStatus | string | undefined): string {
    if (status === CustomDomainStatus.ATTACHED) {
      return "bg-success";
    }
    if (status === CustomDomainStatus.FAILED) {
      return "bg-danger";
    }
    return "bg-warning text-dark";
  }

  domainStatusLabel(status: CustomDomainStatus | string | undefined): string {
    if (status === CustomDomainStatus.ATTACHED) return "Attached";
    if (status === CustomDomainStatus.FAILED) return "Failed";
    return "Awaiting configuration";
  }

  async addCustomDomain(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment first" });
      return;
    }
    const hostname = this.normaliseHostname(this.customDomainHostname);
    if (!hostname) {
      this.customDomainError = "Enter a hostname to add";
      return;
    }
    this.customDomainBusy = true;
    this.customDomainError = null;
    this.customDomainMessages = [`Attaching custom domain: ${hostname}`];
    const queue = [hostname];
    if (this.shouldAttachWwwFor(hostname)) {
      queue.push(`www.${hostname}`);
    }
    try {
      for (const target of queue) {
        if (target !== hostname) {
          this.customDomainMessages.push(`Attaching companion domain: ${target}`);
        }
        const response = await this.environmentSetupService.addCustomDomain(this.selectedExistingEnv.name, target);
        if (response.success) {
          this.appendLogs(response.logs, response.message || `Custom domain ${response.hostname} attached`);
        } else {
          this.customDomainError = response.message || "Custom domain add failed";
          this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
          break;
        }
      }
      if (!this.customDomainError) {
        this.customDomainHostname = "";
      }
      await this.refreshSelectedEnvironment();
    } catch (error) {
      this.customDomainError = this.extractErrorDetail(error);
      this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
      this.logger.error("Add custom domain failed:", error);
    } finally {
      this.customDomainBusy = false;
    }
  }

  private normaliseHostname(input: string | null | undefined): string {
    return (input || "").trim().toLowerCase().replace(/\.$/, "").replace(/^https?:\/\//, "");
  }

  shouldShowAlsoAttachWwwOption(): boolean {
    const normalised = this.normaliseHostname(this.customDomainHostname);
    return !!normalised && !normalised.startsWith("www.") && normalised.split(".").length >= 2;
  }

  private shouldAttachWwwFor(hostname: string): boolean {
    return this.alsoAttachWww && !hostname.startsWith("www.") && hostname.split(".").length >= 2;
  }

  async removeCustomDomain(domain: CustomDomainEntry): Promise<void> {
    if (!this.selectedExistingEnv) return;
    this.customDomainBusy = true;
    this.removingDomainHostname = domain.hostname;
    this.customDomainError = null;
    this.customDomainMessages = [`Removing custom domain: ${domain.hostname}`];
    try {
      const response = await this.environmentSetupService.removeCustomDomain(this.selectedExistingEnv.name, domain.hostname);
      if (response.success) {
        this.appendLogs(response.logs, response.message || `Custom domain ${domain.hostname} removed`);
        await this.refreshSelectedEnvironment();
      } else {
        this.customDomainError = response.message || "Custom domain remove failed";
        this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
      }
    } catch (error) {
      this.customDomainError = this.extractErrorDetail(error);
      this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
      this.logger.error("Remove custom domain failed:", error);
    } finally {
      this.customDomainBusy = false;
      this.removingDomainHostname = null;
    }
  }

  async checkCustomDomain(domain: CustomDomainEntry): Promise<void> {
    if (!this.selectedExistingEnv) return;
    this.customDomainBusy = true;
    this.checkingDomainHostname = domain.hostname;
    this.customDomainError = null;
    this.customDomainMessages = [`Checking custom domain: ${domain.hostname}`];
    try {
      const response = await this.environmentSetupService.checkCustomDomain(this.selectedExistingEnv.name, domain.hostname);
      if (response.success) {
        this.appendLogs(response.logs, response.message || `Status checked for ${domain.hostname}`);
        await this.refreshSelectedEnvironment();
      } else {
        this.customDomainError = response.message || "Status check failed";
        this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
      }
    } catch (error) {
      this.customDomainError = this.extractErrorDetail(error);
      this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
      this.logger.error("Check custom domain failed:", error);
    } finally {
      this.customDomainBusy = false;
      this.checkingDomainHostname = null;
    }
  }

  async setupApexRedirect(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment first" });
      return;
    }
    const hostname = this.normaliseHostname(this.apexRedirectHostname);
    if (!hostname) {
      this.apexRedirectError = "Enter the hostname the site is served on";
      return;
    }
    this.apexRedirectBusy = true;
    this.apexRedirectError = null;
    this.apexRedirectMessages = [`Setting up apex/www redirect for ${hostname}`];
    try {
      const response = await this.environmentSetupService.setupApexRedirect(this.selectedExistingEnv.name, hostname);
      if (response.success) {
        this.apexRedirectMessages = response.logs?.length
          ? [...this.apexRedirectMessages, ...response.logs]
          : [...this.apexRedirectMessages, response.message];
      } else {
        this.apexRedirectError = response.message || "Apex redirect setup failed";
        if (response.logs?.length) {
          this.apexRedirectMessages = [...this.apexRedirectMessages, ...response.logs];
        }
      }
    } catch (error) {
      this.apexRedirectError = this.extractErrorDetail(error);
      this.apexRedirectMessages = [...this.apexRedirectMessages, `Error: ${this.apexRedirectError}`];
      this.logger.error("Apex redirect setup failed:", error);
    } finally {
      this.apexRedirectBusy = false;
    }
  }

  async removeApexRedirect(hostname: HostnameStatus): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment first" });
      return;
    }
    this.apexRedirectBusy = true;
    this.apexRedirectError = null;
    this.apexRedirectMessages = [`Removing redirect for ${hostname.hostname}`];
    try {
      const response = await this.environmentSetupService.removeApexRedirect(this.selectedExistingEnv.name, hostname.hostname);
      if (response.success) {
        this.apexRedirectMessages = response.logs?.length
          ? [...this.apexRedirectMessages, ...response.logs]
          : [...this.apexRedirectMessages, response.message];
        await this.refreshHostnameHealth();
      } else {
        this.apexRedirectError = response.message || "Redirect removal failed";
        if (response.logs?.length) {
          this.apexRedirectMessages = [...this.apexRedirectMessages, ...response.logs];
        }
      }
    } catch (error) {
      this.apexRedirectError = this.extractErrorDetail(error);
      this.apexRedirectMessages = [...this.apexRedirectMessages, `Error: ${this.apexRedirectError}`];
      this.logger.error("Redirect removal failed:", error);
    } finally {
      this.apexRedirectBusy = false;
    }
  }

  private appendLogs(logs: string[] | undefined, fallback: string): void {
    if (logs && logs.length > 0) {
      this.customDomainMessages = [...this.customDomainMessages, ...logs];
    } else {
      this.customDomainMessages.push(fallback);
    }
  }

  private async refreshSelectedEnvironment(): Promise<void> {
    if (!this.selectedExistingEnv) return;
    const currentName = this.selectedExistingEnv.name;
    await this.loadExistingEnvironments();
    const refreshed = this.existingEnvironments.find(env => env.name === currentName) || null;
    if (refreshed) {
      this.selectedExistingEnv = refreshed;
    }
  }

  async runFlyOrgMigration(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment to migrate" });
    } else if (!this.wsConnected) {
      this.setupError = "WebSocket not connected — refresh the page and try again";
      this.progressMessages = [this.setupError];
    } else {
      this.operationInProgress = OperationInProgress.MIGRATING_FLY_ORG;
      this.progressMessages = [];
      this.setupError = null;
      this.setupWarnings = [];
      this.setupResult = null;
      this.flyMigrationComplete = false;
      try {
        await this.probeFlyOrgMigrationStatus();
        if (this.flyMigrationStatus?.phase === FlyOrgMigrationPhase.COMPLETE && !this.flyMigrationStatus.needsCustomDomainReattach) {
          this.progressMessages = [this.flyMigrationStatus.summary || "Cutover already complete"];
          this.flyMigrationComplete = true;
          this.operationInProgress = OperationInProgress.NONE;
        } else {
          this.progressMessages.push(`Starting Fly organisation migration for ${this.selectedExistingEnv.name}`);
          const payload: {
            environmentName: string;
            destroyOldApp: boolean;
            reattachSubdomain: boolean;
            previousApiKey?: string;
            previousOrganisation?: string;
            previousAppName?: string;
            newApiKey?: string;
            newOrganisation?: string;
            newAppName?: string;
          } = {
            environmentName: this.selectedExistingEnv.name,
            destroyOldApp: this.flyMigrateOptions.destroyOldApp,
            reattachSubdomain: this.flyMigrateOptions.reattachSubdomain
          };
          if (this.flyMigrateForm.oldApiKey) {
            payload.previousApiKey = this.flyMigrateForm.oldApiKey;
          }
          if (this.flyMigrateForm.oldOrganisation) {
            payload.previousOrganisation = this.flyMigrateForm.oldOrganisation;
          }
          if (this.flyMigrateForm.oldAppName) {
            payload.previousAppName = this.flyMigrateForm.oldAppName;
          }
          if (this.flyMigrateForm.newApiKey) {
            payload.newApiKey = this.flyMigrateForm.newApiKey;
          }
          if (this.flyMigrateForm.newOrganisation) {
            payload.newOrganisation = this.flyMigrateForm.newOrganisation;
          }
          if (this.flyMigrateForm.newAppName) {
            payload.newAppName = this.flyMigrateForm.newAppName;
          }
          this.websocketService.sendMessage(EventType.FLY_ORG_MIGRATE, payload);
        }
      } catch (error) {
        this.operationInProgress = OperationInProgress.NONE;
        this.setupError = this.extractErrorDetail(error);
        this.progressMessages = [`Error: ${this.setupError}`];
      }
    }
  }

  private async finishFlyOrgMigration(
    pendingResult: { environmentName: string; appName: string; appUrl: string } | null
  ): Promise<void> {
    if (pendingResult) {
      this.setupResult = pendingResult;
    }
    this.flyMigrationComplete = true;
    await this.refreshSelectedEnvironment();
    if (this.selectedExistingEnv) {
      await this.probeEnvironmentStatus(this.selectedExistingEnv.name);
      await this.probeHostnameHealth(this.selectedExistingEnv.name);
    }
    await this.populateFlyMigrateForm();
    await this.probeFlyOrgMigrationStatus();
  }

  async resumeSetup(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment to resume" });
      return;
    }

    this.operationInProgress = OperationInProgress.CREATING;
    this.progressMessages = [];
    this.setupError = null;
    this.setupWarnings = [];
    this.setupResult = null;
    this.flyMigrationComplete = false;

    this.progressMessages.push(`Modifying environment: ${this.selectedExistingEnv.name}`);

    try {
      if (this.resumeOptions.copyStandardAssets) {
        this.progressMessages.push("Copying standard assets...");
        const copyResponse = await this.environmentSetupService.copyAssets(this.selectedExistingEnv.name);
        if (copyResponse.copiedAssets) {
          const { icons, logos, backgrounds } = copyResponse.copiedAssets;
          this.progressMessages.push(`Copied ${icons.length} icons, ${logos.length} logos, ${backgrounds.length} backgrounds`);
        }
        if (copyResponse.failures && copyResponse.failures.length > 0) {
          this.progressMessages.push(`Failed to copy ${copyResponse.failures.length} files:`);
          copyResponse.failures.forEach(f => this.progressMessages.push(`  - ${f.file}: ${f.error}`));
          if (!copyResponse.success) {
            this.setupError = copyResponse.message;
            this.operationInProgress = OperationInProgress.NONE;
            return;
          }
        } else if (!copyResponse.success) {
          this.setupError = copyResponse.message;
          this.progressMessages.push(`Error: ${copyResponse.message}`);
          this.operationInProgress = OperationInProgress.NONE;
          return;
        }
      }

      if (this.resumeOptions.includeSamplePages) {
        this.progressMessages.push("Seeding sample page content...");
        const samplePagesResponse = await this.environmentSetupService.seedSamplePages(this.selectedExistingEnv.name);
        if (samplePagesResponse.success) {
          this.progressMessages.push(samplePagesResponse.message);
        } else {
          this.setupError = samplePagesResponse.message;
          this.progressMessages.push(`Error: ${samplePagesResponse.message}`);
          this.operationInProgress = OperationInProgress.NONE;
          return;
        }
      }

      if (this.resumeOptions.includeNotificationConfigs) {
        this.progressMessages.push("Seeding notification configs...");
        const notifResponse = await this.environmentSetupService.seedNotificationConfigs(this.selectedExistingEnv.name);
        if (notifResponse.success) {
          this.progressMessages.push(notifResponse.message);
        } else {
          this.setupError = notifResponse.message;
          this.progressMessages.push(`Error: ${notifResponse.message}`);
          this.operationInProgress = OperationInProgress.NONE;
          return;
        }
      }

      if (this.wsConnected && (this.resumeOptions.runDbInit || this.resumeOptions.runFlyDeployment)) {
        this.websocketService.sendMessage(EventType.ENVIRONMENT_SETUP, {
          environmentName: this.selectedExistingEnv.name,
          runDbInit: this.resumeOptions.runDbInit,
          runFlyDeployment: this.resumeOptions.runFlyDeployment
        });
        if (this.resumeOptions.setupSubdomain || this.resumeOptions.authenticateBrevoDomain) {
          this.progressMessages.push("Subdomain setup and Brevo domain authentication run after deployment completes...");
        }
      } else {
        const response = await this.environmentSetupService.resumeEnvironment(
          this.selectedExistingEnv.name,
          this.resumeOptions.runDbInit,
          this.resumeOptions.runFlyDeployment
        );

        const pendingResult = response.result ? {
          environmentName: response.result.environmentName,
          appName: response.result.appName,
          appUrl: response.result.appUrl
        } : null;

        await this.finishResumeAfterDeploy(pendingResult);
        if (!this.setupError) {
          this.progressMessages.push("Environment modified successfully!");
        }
        this.operationInProgress = OperationInProgress.NONE;
      }
    } catch (error) {
      this.setupError = this.extractErrorDetail(error);
      this.progressMessages.push(`Error: ${this.setupError}`);
      this.logger.error("Resume setup failed:", error);
      this.operationInProgress = OperationInProgress.NONE;
    }
  }

  private async finishResumeAfterDeploy(
    pendingResult: { environmentName: string; appName: string; appUrl: string } | null
  ): Promise<void> {
    const result = pendingResult ? {...pendingResult} : null;
    if (this.resumeOptions.setupSubdomain) {
      const subdomainHostname = await this.runSubdomainSetup();
      if (subdomainHostname && result) {
        result.appUrl = `https://${subdomainHostname}`;
      }
    }
    if (this.resumeOptions.authenticateBrevoDomain) {
      await this.runBrevoDomainAuth();
    }
    if (result) {
      this.setupResult = result;
    }
    if (!this.setupError) {
      await this.generateAdminPasswordReset();
    }
  }

  private async runSubdomainSetup(): Promise<string | null> {
    if (this.selectedExistingEnv) {
      this.progressMessages.push("Setting up subdomain...");
      try {
        const subdomainResponse = await this.environmentSetupService.setupSubdomain(this.selectedExistingEnv.name);
        if (subdomainResponse.success) {
          this.progressMessages.push(`Subdomain configured: ${subdomainResponse.hostname}`);
          return subdomainResponse.hostname;
        } else {
          this.setupError = subdomainResponse.message || "Subdomain setup failed";
          this.progressMessages.push(`Subdomain setup failed: ${this.setupError}`);
          return null;
        }
      } catch (error) {
        this.setupError = this.extractErrorDetail(error);
        this.progressMessages.push(`Subdomain setup failed: ${this.setupError}`);
        this.logger.error("Subdomain setup failed:", error);
        return null;
      }
    } else {
      return null;
    }
  }

  private async runBrevoDomainAuth(): Promise<void> {
    if (this.selectedExistingEnv) {
      this.progressMessages.push("Authenticating Brevo sending domain...");
      try {
        const authResponse = await this.environmentSetupService.authenticateBrevoDomain(this.selectedExistingEnv.name);
        if (authResponse.authenticated) {
          this.progressMessages.push(authResponse.message);
        } else {
          const warning = authResponse.message
            || "Brevo domain authentication did not complete via API; finish it in the Brevo UI and re-run this step later.";
          this.setupWarnings = [...this.setupWarnings, `Brevo sending domain: ${warning}`];
          this.progressMessages.push(`Warning: ${warning}`);
          this.logger.warn("Brevo domain authentication incomplete:", authResponse);
        }
      } catch (error) {
        const warning = this.extractErrorDetail(error);
        this.setupWarnings = [...this.setupWarnings, `Brevo sending domain: ${warning}`];
        this.progressMessages.push(`Warning: ${warning}`);
        this.logger.warn("Brevo domain authentication failed (non-fatal):", error);
      }
    }
  }

  async destroyEnvironment(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment to destroy" });
      return;
    }

    const environmentName = this.selectedExistingEnv.name;
    this.operationInProgress = OperationInProgress.DESTROYING;
    this.destroyProgressMessages = [];
    this.destroyComplete = false;
    this.destroyError = null;

    this.destroyProgressMessages.push(`Starting destruction of environment: ${environmentName}`);

    try {
      const response = await this.environmentSetupService.destroyEnvironment(environmentName);

      if (response.steps) {
        response.steps.forEach(step => {
          this.destroyProgressMessages.push(`${step.success ? "\u2713" : "\u2717"} ${step.step}: ${step.message}`);
        });
      }

      this.destroyProgressMessages.push(response.message || `Environment ${environmentName} destroyed`);

      if (response.success) {
        this.destroyComplete = true;
        this.selectedExistingEnv = null;
        await this.loadExistingEnvironments();
      } else {
        this.destroyError = "Some steps failed - check details above";
      }
    } catch (error) {
      this.destroyError = this.extractErrorDetail(error);
      this.logger.error("Destroy environment failed:", error);
      this.destroyProgressMessages.push(`Error: ${this.destroyError}`);
      this.notify.error({ title: "Error", message: this.destroyError });
    } finally {
      this.operationInProgress = OperationInProgress.NONE;
    }
  }

  canRemoveNgxSubdomain(): boolean {
    if (!this.selectedExistingEnv || !this.envStatus?.subdomainConfigured) return false;
    return this.customDomains().some(domain => domain.status === CustomDomainStatus.ATTACHED);
  }

  requestRemoveNgxSubdomain(): void {
    if (!this.selectedExistingEnv) return;
    this.removeNgxSubdomainConfirming = true;
  }

  cancelRemoveNgxSubdomain(): void {
    this.removeNgxSubdomainConfirming = false;
  }

  async confirmRemoveNgxSubdomain(): Promise<void> {
    if (!this.selectedExistingEnv) return;
    this.removeNgxSubdomainConfirming = false;
    this.removingNgxSubdomain = true;
    this.progressMessages = [`Removing NGX subdomain for ${this.selectedExistingEnv.name}...`];
    try {
      const response = await this.environmentSetupService.removeSubdomain(this.selectedExistingEnv.name);
      if (response.logs?.length) {
        this.progressMessages = [...this.progressMessages, ...response.logs];
      } else {
        this.progressMessages.push(response.message || "NGX subdomain removed");
      }
      if (response.success) {
        await this.probeEnvironmentStatus(this.selectedExistingEnv.name);
      } else {
        this.setupError = response.message || "Failed to remove NGX subdomain";
      }
    } catch (error) {
      this.setupError = this.extractErrorDetail(error);
      this.progressMessages.push(`Error: ${this.setupError}`);
      this.logger.error("Remove NGX subdomain failed:", error);
    } finally {
      this.removingNgxSubdomain = false;
    }
  }

  async generateAdminPasswordReset(): Promise<void> {
    if (this.selectedExistingEnv) {
      this.generatingPasswordReset = true;
      this.passwordResetResult = null;
      try {
        const response = await this.environmentSetupService.adminPasswordReset(this.selectedExistingEnv.name);
        if (response.success) {
          this.passwordResetResult = response;
          this.progressMessages.push(
            `Admin sign-in ready: username ${response.userName || response.email} - set password via the link shown below`
          );
        } else {
          this.setupWarnings = [...this.setupWarnings, `Admin sign-in: ${response.message}`];
          this.progressMessages.push(`Warning: could not prepare admin sign-in: ${response.message}`);
        }
      } catch (error) {
        const detail = this.extractErrorDetail(error);
        this.setupWarnings = [...this.setupWarnings, `Admin sign-in: ${detail}`];
        this.progressMessages.push(`Warning: could not prepare admin sign-in: ${detail}`);
        this.logger.error("Admin password reset failed:", error);
      } finally {
        this.generatingPasswordReset = false;
      }
    }
  }

  private extractErrorDetail(error: any): string {
    if (error?.error?.error) {
      return error.error.error;
    }
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    return error?.toString() || "Unknown error occurred";
  }
}
