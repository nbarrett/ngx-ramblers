import { Component, inject, Input } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { cloneDeep } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSpinner, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { AlertTarget } from "../../../../models/alert-target.model";
import { ListInfo, MailMessagingConfig } from "../../../../models/mail.model";
import {
  APPLIED_OUTCOMES,
  ListSubscriptionAction,
  ListSubscriptionChangeCount,
  ListSubscriptionImportSummary,
  ListSubscriptionOutcome,
  ListSubscriptionResult,
  ListSubscriptionRow
} from "../../../../models/mail-list-subscription.model";
import { Member } from "../../../../models/member.model";
import { MailListUpdaterService } from "../../../../services/mail/mail-list-updater.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";

const EXPORT_FILE_NAME = "list-subscriptions.xlsx";

@Component({
  selector: "app-list-subscription-import-export",
  template: `
    <hr/>
    <div class="row mt-3">
      <div class="col">
        <h5>Import and export subscriptions</h5>
      </div>
      <div class="col-auto">
        <div class="float-end">
          <app-brevo-button button title="Download Subscriptions" [loading]="downloading()"
                            [disabled]="actionsDisabled()" (click)="download()"/>
          <app-brevo-button class="ms-2" button title="Import Subscriptions" [loading]="parsing()"
                            [disabled]="actionsDisabled()" (click)="fileElement.click()"/>
          <input #fileElement class="d-none" type="file" accept=".xlsx,.xls,.csv" (change)="fileSelected($event)">
        </div>
      </div>
    </div>
    <div class="row mt-3">
      <div class="col-12">
        <p class="mb-0">Download every member with their current list subscriptions, edit the file, then import it back
          to subscribe and unsubscribe members in bulk. The download has one row for each member and list, with the list
          named in its own column, so a single file can span every list. It doubles as the import template: change a Yes
          to No to unsubscribe someone, or a No to Yes to subscribe them. An empty Subscribed cell counts as No. Rows are
          matched to members on email address, and no member record is ever created, updated or deleted.</p>
      </div>
    </div>
    @if (importSummary) {
      <div class="row mt-3">
        <div class="col">
          <div class="alert alert-warning">
            <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
            <strong>Review {{ fileName }} before applying</strong>
            <p class="mt-2 mb-2">{{ summaryMessage() }}</p>
            @if (changeCounts.length > 0) {
              <div class="ngx-data-table-card mb-3">
                <table class="ngx-data-table">
                  <thead>
                  <tr>
                    <th scope="col">List</th>
                    <th scope="col">Subscribers Before</th>
                    <th scope="col">Subscribed</th>
                    <th scope="col">Unsubscribed</th>
                    <th scope="col">Subscribers After</th>
                  </tr>
                  </thead>
                  <tbody>
                    @for (count of changeCounts; track count.listName) {
                      <tr>
                        <td>{{ count.listName || "No list named" }}</td>
                        <td>{{ count.subscribersBefore }}</td>
                        <td>{{ count.subscribing }}</td>
                        <td>{{ count.unsubscribing }}</td>
                        <td>{{ count.subscribersAfter }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
            @if (problemResults().length > 0) {
              <p class="mb-1"><strong>These rows will be skipped:</strong></p>
              <ul class="mb-2">
                @for (result of problemResults(); track $index) {
                  <li>{{ describeResult(result) }}: {{ result.outcome }}</li>
                }
              </ul>
            }
            @if (applying()) {
              <p class="mb-3">
                <fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>
                <strong>{{ progressMessage() }}</strong>
              </p>
            }
            <app-brevo-button button [title]="applyTitle()" [loading]="applying()" [disabled]="applyDisabled()"
                              (click)="applyImport()"/>
            <app-brevo-button class="ms-2" button title="Cancel" [disabled]="busy()" (click)="cancelImport()"/>
          </div>
        </div>
      </div>
    }`,
  imports: [BrevoButtonComponent, FontAwesomeModule]
})
export class ListSubscriptionImportExportComponent {

  private logger: Logger = inject(LoggerFactory).createLogger("ListSubscriptionImportExportComponent", NgxLoggerLevel.ERROR);
  private mailListUpdaterService = inject(MailListUpdaterService);
  protected stringUtilsService = inject(StringUtilsService);
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faSpinner = faSpinner;
  @Input() mailMessagingConfig: MailMessagingConfig;
  @Input() members: Member[] = [];
  @Input() notify: AlertInstance;
  @Input() notifyTarget: AlertTarget;
  public importSummary: ListSubscriptionImportSummary;
  public importedRows: ListSubscriptionRow[];
  public changeCounts: ListSubscriptionChangeCount[] = [];
  public fileName: string;
  public action: ListSubscriptionAction;

  busy(): boolean {
    return !!this.action;
  }

  downloading(): boolean {
    return this.action === ListSubscriptionAction.DOWNLOADING;
  }

  parsing(): boolean {
    return this.action === ListSubscriptionAction.PARSING;
  }

  applying(): boolean {
    return this.action === ListSubscriptionAction.APPLYING;
  }

  actionsDisabled(): boolean {
    return this.busy() || !!this.importSummary || this.lists().length === 0;
  }

  applyDisabled(): boolean {
    return this.busy() || this.changedMemberCount() === 0;
  }

  applyTitle(): string {
    if (this.applying()) {
      return `Applying to ${this.stringUtilsService.pluraliseWithCount(this.changedMemberCount(), "member")}`;
    }
    return this.changedMemberCount() === 0 ? "Nothing to apply"
      : `Apply to ${this.stringUtilsService.pluraliseWithCount(this.changedMemberCount(), "member")}`;
  }

  changedMemberCount(): number {
    return this.importSummary?.membersChanged?.length || 0;
  }

  progressMessage(): string {
    return this.notifyTarget?.alertMessage || "Saving subscription changes";
  }

  problemResults(): ListSubscriptionResult[] {
    return (this.importSummary?.results || [])
      .filter(result => !APPLIED_OUTCOMES.includes(result.outcome) && result.outcome !== ListSubscriptionOutcome.UNCHANGED);
  }

  summaryMessage(): string {
    const rows = this.importedRows?.length || 0;
    return `${this.stringUtilsService.pluraliseWithCount(rows, "row")} read from the file. `
      + `${this.stringUtilsService.pluraliseWithCount(this.changedMemberCount(), "member")} would change. `
      + `Nothing has been saved yet.`;
  }

  describeResult(result: ListSubscriptionResult): string {
    return [result.row.email || "Row with no email address", result.row.listName].filter(item => !!item).join(" — ");
  }

  async download(): Promise<void> {
    this.action = ListSubscriptionAction.DOWNLOADING;
    this.notify.hide();
    try {
      const exported = await this.mailListUpdaterService.downloadSpreadsheet(this.members, this.lists(), EXPORT_FILE_NAME);
      this.notify.success({
        title: "Subscriptions export",
        message: `Downloaded ${this.stringUtilsService.pluraliseWithCount(exported, "row")} for ${this.stringUtilsService.pluraliseWithCount(this.members.length, "member")} across ${this.stringUtilsService.pluraliseWithCount(this.lists().length, "list")}`
      });
    } catch (error) {
      this.logger.error("download failed", error);
      this.notify.error({title: "Subscriptions export failed", message: error});
    } finally {
      this.action = null;
    }
  }

  async fileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file: File = input.files?.[0];
    input.value = null;
    if (!file) {
      return;
    }
    this.action = ListSubscriptionAction.PARSING;
    this.notify.hide();
    this.fileName = file.name;
    try {
      const previewMembers: Member[] = cloneDeep(this.members);
      this.importedRows = await this.mailListUpdaterService.parseFile(file);
      this.importSummary = this.mailListUpdaterService.applyRows(this.importedRows, previewMembers, this.lists());
      this.changeCounts = this.mailListUpdaterService.changeCountsByList(this.importSummary.results, this.members, previewMembers, this.lists());
      this.logger.info("previewed", this.importedRows.length, "rows from", file.name);
    } catch (error) {
      this.logger.error("import preview failed", error);
      this.cancelImport();
      this.notify.error({title: "Subscriptions import failed", message: error});
    } finally {
      this.action = null;
    }
  }

  async applyImport(): Promise<void> {
    this.action = ListSubscriptionAction.APPLYING;
    this.notify.hide();
    try {
      const summary = this.mailListUpdaterService.applyRows(this.importedRows, this.members, this.lists());
      await this.mailListUpdaterService.saveAndSyncChanges(this.notify, summary.membersChanged, this.members);
      this.notify.success({
        title: "Subscriptions import",
        message: `Updated ${this.stringUtilsService.pluraliseWithCount(summary.membersChanged.length, "member")} from ${this.fileName}`
      });
      this.cancelImport();
    } catch (error) {
      this.logger.error("import failed", error);
      this.notify.error({title: "Subscriptions import failed", message: error});
    } finally {
      this.action = null;
    }
  }

  cancelImport(): void {
    this.importSummary = null;
    this.importedRows = null;
    this.changeCounts = [];
    this.fileName = null;
  }

  private lists(): ListInfo[] {
    return this.mailMessagingConfig?.brevo?.lists?.lists || [];
  }
}
