import { Component, inject, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faCheckCircle, faExclamationTriangle, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GitHubEnvironmentDiff, GitHubSecretStatus } from "../../../models/environment-setup.model";

@Component({
  selector: "app-environment-github-secrets",
  standalone: true,
  imports: [FontAwesomeModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
        <fa-icon [icon]="faGithub" style="font-size: 1.5rem;"></fa-icon>
        <span>GitHub Secrets</span>
      </div>
      @if (status?.error) {
        <div class="alert alert-danger">
          <fa-icon [icon]="faTimesCircle" class="me-2"></fa-icon><strong>Error</strong> — {{ status.error }}
        </div>
      } @else if (status) {
        <div class="col-sm-12 mb-3">
          <table class="table table-sm table-borderless w-auto">
            <tbody>
              <tr>
                <td class="text-muted pe-3">GitHub secret last updated:</td>
                <td>{{ status.secretUpdatedAt ? dateUtils.displayDateAndTime(status.secretUpdatedAt) : "Unknown" }}</td>
              </tr>
            </tbody>
          </table>
          @if (status.isUpToDate) {
            <div class="alert alert-success">
              <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
              <strong>Up to date</strong> — {{ status.environmentCount }} environments
            </div>
          } @else {
            <div class="alert alert-warning">
              <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
              <strong>Out of date</strong> — {{ diffSummary }}
              @if (problemEnvironments.length > 0) {
                    <table class="table table-sm table-borderless mt-2 mb-0" style="--bs-table-bg: transparent;">
                  <tbody>
                    @for (env of problemEnvironments; track env.name) {
                      <tr>
                        <td class="fw-semibold pe-3" style="width: 180px; white-space: nowrap;">{{ env.name }}</td>
                        <td>
                          @if (!env.inDatabase) {
                            removed from database
                          } @else if (!env.inConfigsJson) {
                            not yet in secret
                          } @else {
                            {{ env.differences.join(", ") }}
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }
        </div>
      } @else if (loading) {
        <div class="col-sm-12 mb-3 text-muted">Loading status...</div>
      }
      <div class="col-sm-12">
        <button type="button"
                class="btn btn-primary me-2"
                [disabled]="pushing"
                (click)="push()">
          Push to GitHub
        </button>
        <button type="button"
                class="btn btn-outline-secondary"
                [disabled]="loading || pushing"
                (click)="refresh()">
          Refresh
        </button>
      </div>
    </div>
  `
})
export class EnvironmentGitHubSecrets implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("EnvironmentGitHubSecrets", NgxLoggerLevel.ERROR);
  private environmentSetupService = inject(EnvironmentSetupService);
  private notifierService = inject(NotifierService);
  protected dateUtils = inject(DateUtilsService);
  protected readonly faGithub = faGithub;
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faTimesCircle = faTimesCircle;

  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  status: GitHubSecretStatus = null;
  loading = false;
  pushing = false;

  get problemEnvironments(): GitHubEnvironmentDiff[] {
    return (this.status?.reconciliation || []).filter(
      e => !e.inDatabase || !e.inConfigsJson || e.differences.length > 0
    );
  }

  get diffSummary(): string {
    const problems = this.problemEnvironments;
    const newCount = problems.filter(e => !e.inConfigsJson).length;
    const removedCount = problems.filter(e => !e.inDatabase).length;
    const changedCount = problems.filter(e => e.inConfigsJson && e.inDatabase && e.differences.length > 0).length;
    const parts: string[] = [];
    if (newCount > 0) parts.push(`${newCount} new`);
    if (removedCount > 0) parts.push(`${removedCount} removed`);
    if (changedCount > 0) parts.push(`${changedCount} changed`);
    return parts.length > 0 ? parts.join(", ") : "push to sync";
  }

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.loading = true;
    this.environmentSetupService.githubStatus().then(result => {
      this.status = result;
      this.loading = false;
    }).catch(err => {
      this.logger.error("Error fetching GitHub secret status:", err);
      this.status = {
        secretUpdatedAt: null,
        environmentCount: 0,
        isUpToDate: false,
        reconciliation: [],
        error: err.message || "Failed to fetch status"
      };
      this.loading = false;
    });
  }

  push() {
    this.pushing = true;
    this.environmentSetupService.pushToGitHub().then(result => {
      this.pushing = false;
      this.notify.success({
        title: "GitHub Secret Updated",
        message: `Successfully pushed ${result.environmentCount} environments to GitHub`
      });
      this.refresh();
    }).catch(err => {
      this.pushing = false;
      this.notify.error({
        title: "Push Failed",
        message: err.message || "Failed to push to GitHub"
      });
    });
  }
}
