import { Component, inject, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRefresh, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayDateAndTimePipe } from "../../../../pipes/display-date-and-time.pipe";
import { MemberBulkLoadAudit } from "../../../../models/member.model";
import { memberBulkLoadSourceLabel } from "../../../../models/salesforce.model";
import { ALERT_WARNING, AlertTarget } from "../../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MemberBulkLoadAuditService } from "../../../../services/member/member-bulk-load-audit.service";
import { MemberLoginService } from "../../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { first } from "es-toolkit/compat";

@Component({
  selector: "app-member-bulk-load-audit-settings",
  imports: [FontAwesomeModule, DisplayDateAndTimePipe],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Member bulk-load audits</div>
      <div class="col-sm-12">
        <p>
          Upload History sessions drive “received in last bulk load” and the next Ramblers Team Emails snapshot reconciliation.
          Clearing them is a maintenance step (for example after switching area/team code or wiping members for a clean
          re-import). Only file admins and member admins can do this.
        </p>
        @if (!canManageAudits) {
          <div class="alert alert-warning mb-0">
            <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
            You need file admin or member admin access to clear bulk-load audits.
          </div>
        } @else {
          <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
            <button type="button" class="btn btn-primary" [disabled]="busy" (click)="refresh()">
              <fa-icon [icon]="busy ? faSpinner : faRefresh" [animation]="busy ? 'spin' : null" class="me-1"/>
              Refresh list
            </button>
            <button type="button"
                    class="btn btn-quiet"
                    [disabled]="busy || sessionCount === 0"
                    (click)="clearAll()">
              {{ clearAllArmed ? "Confirm clear all sessions" : "Clear all sessions" }}
            </button>
            @if (clearAllArmed) {
              <button type="button" class="btn btn-quiet" [disabled]="busy" (click)="clearAllArmed = false">
                Cancel
              </button>
            }
          </div>
          @if (notifyTarget.showAlert) {
            <div class="alert {{ notifyTarget.alertClass }} mb-3">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              @if (notifyTarget.alertTitle) {
                <strong> {{ notifyTarget.alertTitle }}: </strong>
              }
              {{ notifyTarget.alertMessage }}
            </div>
          }
          <p class="form-text mb-2">
            {{ stringUtils.pluraliseWithCount(sessionCount, "upload session") }} stored.
            @if (latestSession) {
              Latest: {{ latestSession.createdDate | displayDateAndTime }}
              ({{ stringUtils.pluraliseWithCount(latestSession.members?.length || 0, "member") }} in snapshot).
            }
          </p>
          @if (sessions.length > 0) {
            <div class="ngx-data-table-card">
              <table class="ngx-data-table">
                <thead>
                <tr>
                  <th>Uploaded at</th>
                  <th>Source</th>
                  <th>Members in session</th>
                  <th></th>
                </tr>
                </thead>
                <tbody>
                  @for (session of sessions; track session.id) {
                    <tr>
                      <td>{{ session.createdDate | displayDateAndTime }}</td>
                      <td>{{ memberBulkLoadSourceLabel(session.source) }}</td>
                      <td>{{ session.members?.length || 0 }}</td>
                      <td class="text-end">
                        <button type="button"
                                class="btn btn-sm btn-quiet"
                                [disabled]="busy"
                                (click)="deleteSession(session)">
                          Delete
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </div>
    </div>
  `
})
export class MemberBulkLoadAuditSettingsComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("MemberBulkLoadAuditSettingsComponent", NgxLoggerLevel.ERROR);
  private memberBulkLoadAuditService = inject(MemberBulkLoadAuditService);
  private memberLoginService = inject(MemberLoginService);
  private notifierService = inject(NotifierService);
  private dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);

  protected readonly faRefresh = faRefresh;
  protected readonly faSpinner = faSpinner;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  protected readonly memberBulkLoadSourceLabel = memberBulkLoadSourceLabel;

  public canManageAudits = false;
  public busy = false;
  public clearAllArmed = false;
  public sessions: MemberBulkLoadAudit[] = [];
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance;

  get sessionCount(): number {
    return this.sessions.length;
  }

  get latestSession(): MemberBulkLoadAudit | null {
    return first(this.sessions) ?? null;
  }

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.canManageAudits = this.memberLoginService.allowFileAdmin() || this.memberLoginService.allowMemberAdminEdits();
    if (this.canManageAudits) {
      await this.refresh();
    }
  }

  async refresh(): Promise<void> {
    this.busy = true;
    try {
      this.sessions = await this.memberBulkLoadAuditService.all({sort: {createdDate: -1}});
      this.clearAllArmed = false;
    } catch (error) {
      this.logger.error("refresh failed:", error);
      this.notify.error({title: "Bulk-load audits", message: this.stringUtils.stringify(error), continue: true});
    } finally {
      this.busy = false;
    }
  }

  async deleteSession(session: MemberBulkLoadAudit): Promise<void> {
    if (this.busy || !session?.id) {
      return;
    }
    const label = this.dateUtils.displayDateAndTime(session.createdDate);
    this.busy = true;
    this.notify.progress({title: "Bulk-load audits", message: `Deleting session from ${label}`}, true);
    try {
      await this.memberBulkLoadAuditService.delete(session);
      await this.refresh();
      this.notify.success({
        title: "Bulk-load audits",
        message: `Deleted session from ${label} and its member action rows. The next supporter snapshot will not reconcile against it.`
      });
    } catch (error) {
      this.logger.error("deleteSession failed:", error);
      this.notify.error({title: "Bulk-load audits", message: this.stringUtils.stringify(error), continue: true});
    } finally {
      this.busy = false;
    }
  }

  async clearAll(): Promise<void> {
    if (this.busy || this.sessionCount === 0) {
      return;
    }
    if (!this.clearAllArmed) {
      this.clearAllArmed = true;
      this.notify.warning({
        title: "Bulk-load audits",
        message: `Click again to permanently delete ${this.stringUtils.pluraliseWithCount(this.sessionCount, "upload session")}. This cannot be undone.`
      });
      return;
    }
    this.busy = true;
    this.notify.progress({title: "Bulk-load audits", message: "Clearing all upload sessions"}, true);
    try {
      const result = await this.memberBulkLoadAuditService.clearAll();
      await this.refresh();
      this.notify.success({
        title: "Bulk-load audits",
        message: result.message || `Cleared ${this.stringUtils.pluraliseWithCount(result.deletedCount, "upload session")}`
      });
    } catch (error) {
      this.logger.error("clearAll failed:", error);
      this.notify.error({title: "Bulk-load audits", message: this.stringUtils.stringify(error), continue: true});
    } finally {
      this.busy = false;
      this.clearAllArmed = false;
    }
  }
}
