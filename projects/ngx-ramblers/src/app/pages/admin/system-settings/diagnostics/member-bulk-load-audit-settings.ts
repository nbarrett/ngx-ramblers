import { MemberBulkLoadSessionsComponent } from "../../../../modules/common/member-bulk-load-sessions/member-bulk-load-sessions";
import { Component, inject, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRefresh, faSpinner, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { DisplayDateAndTimePipe } from "../../../../pipes/display-date-and-time.pipe";
import { memberBulkLoadSessionMemberCount } from "../../../../functions/member-bulk-load-rows";
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
  imports: [MemberBulkLoadSessionsComponent, FontAwesomeModule, DisplayDateAndTimePipe],
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
          <div class="alert alert-warning d-flex align-items-start mb-0">
            <fa-icon [icon]="ALERT_WARNING.icon" class="me-2"/>
            <div><strong class="d-block">Administrator access required</strong>You need file admin or member admin access to clear bulk-load audits.</div>
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
              <fa-icon [icon]="faTrash" class="me-1"/>
              {{ clearAllArmed ? "Confirm clear all sessions" : "Clear all sessions" }}
            </button>
            @if (clearAllArmed || pendingDeleteSessionId) {
              <button type="button" class="btn btn-quiet" [disabled]="busy" (click)="cancelDeletion()">
                <fa-icon [icon]="faXmark" class="me-1"/>Cancel
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
              ({{ stringUtils.pluraliseWithCount(memberBulkLoadSessionMemberCount(latestSession), "member") }} in snapshot).
            }
          </p>
          <app-member-bulk-load-sessions [sessions]="sessions" [disabled]="busy" (deleteSession)="deleteSession($event)"/>
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
  protected readonly faTrash = faTrash;
  protected readonly faXmark = faXmark;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  protected readonly memberBulkLoadSourceLabel = memberBulkLoadSourceLabel;
  protected readonly memberBulkLoadSessionMemberCount = memberBulkLoadSessionMemberCount;

  public canManageAudits = false;
  public busy = false;
  public clearAllArmed = false;
  protected pendingDeleteSessionId: string | null = null;
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
      this.sessions = await this.memberBulkLoadAuditService.summaries();
      this.clearAllArmed = false;
      this.pendingDeleteSessionId = null;
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
    if (this.pendingDeleteSessionId !== session.id) {
      this.pendingDeleteSessionId = session.id;
      this.clearAllArmed = false;
      this.notify.warning({title: "Delete upload session?", message: `Click Delete session again to permanently delete the session from ${this.dateUtils.displayDateAndTime(session.createdDate)} and its member action rows. This cannot be undone.`});
    } else {
      this.pendingDeleteSessionId = null;
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
  }

  cancelDeletion(): void {
    this.pendingDeleteSessionId = null;
    this.clearAllArmed = false;
    this.notify.hide();
  }

  async clearAll(): Promise<void> {
    if (this.busy || this.sessionCount === 0) {
      return;
    }
    this.pendingDeleteSessionId = null;
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
