import { Component, EventEmitter, inject, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { keys } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { InboxOrphanedThreadGroup, InboxRemapCandidate, isInboxGeneralRoleType, OrphanedInboxThread } from "../../../models/inbox.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { InboxService } from "../../../services/inbox/inbox.service";

@Component({
  selector: "app-inbox-orphaned-threads",
  imports: [FormsModule, FontAwesomeModule],
  template: `
    @if (totalCount > 0 || folderlessThreadIds.length > 0) {
      <div class="alert alert-warning inbox-alert orphaned-threads">
        @if (totalCount > 0) {
          <div class="d-flex align-items-start orphaned-title">
            <fa-icon [icon]="faTriangleExclamation" class="mt-1 me-2"/>
            <div>
              <strong>{{ totalCount }} conversation{{ totalCount === 1 ? '' : 's' }} cannot be shown -</strong>
              <span class="ms-1">their mailbox no longer exists, most likely because a committee role was renamed or removed. Pick where each old mailbox's conversations should go and remap them in one go. Nothing is deleted.</span>
            </div>
          </div>
        }
        <div class="orphaned-body">
          @for (group of groups; track group.roleType) {
            <div class="orphaned-row">
              <span class="orphaned-desc"><strong>{{ group.count }}</strong> from {{ groupDescription(group.roleType) }}</span>
              <select class="form-select form-select-sm orphaned-target" [(ngModel)]="group.targetRoleType"
                      [name]="'target-' + group.roleType" [disabled]="busy">
                <option [ngValue]="null" disabled>Move to&hellip;</option>
                @for (candidate of remapCandidates; track candidate.roleType) {
                  <option [ngValue]="candidate.roleType">{{ candidateLabel(candidate) }}</option>
                }
              </select>
              <button type="button" class="btn btn-sm btn-primary orphaned-action"
                      [disabled]="busy || !group.targetRoleType" (click)="remapGroup(group)">
                Remap {{ group.count }}
              </button>
            </div>
          }
          @if (folderlessThreadIds.length > 0) {
            <div class="orphaned-row">
              <span class="orphaned-desc">
                <strong>{{ folderlessThreadIds.length }}</strong> conversation{{ folderlessThreadIds.length === 1 ? '' : 's' }} are not filed in any folder
              </span>
              <span class="orphaned-target"></span>
              <button type="button" class="btn btn-sm btn-primary orphaned-action"
                      [disabled]="busy" (click)="restoreToInbox()">
                Restore to inbox
              </button>
            </div>
          }
          @if (statusMessage) {
            <div class="orphaned-status">{{ statusMessage }}</div>
          }
        </div>
      </div>
    }`,
  styles: [`
    .orphaned-title
      margin-bottom: 1rem
    .orphaned-body
      padding: 0 1rem 0.75rem 1rem
    .orphaned-status
      font-size: 0.875rem
      font-style: italic
    .orphaned-row
      display: flex
      align-items: center
      gap: 0.75rem
      margin-bottom: 0.75rem
      flex-wrap: wrap
    .orphaned-row:last-child
      margin-bottom: 0
    .orphaned-desc
      flex: 1 1 16rem
      min-width: 12rem
    .orphaned-target
      flex: 0 0 auto
      width: 15rem
    .orphaned-action
      flex: 0 0 auto
      min-width: 7rem
  `]
})
export class InboxOrphanedThreadsComponent implements OnInit {

  @Output() remapped = new EventEmitter<void>();

  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected groups: InboxOrphanedThreadGroup[] = [];
  protected remapCandidates: InboxRemapCandidate[] = [];
  protected folderlessThreadIds: string[] = [];
  protected totalCount = 0;
  protected busy = false;
  protected statusMessage: string | null = null;

  private inboxService = inject(InboxService);
  private logger = inject(LoggerFactory).createLogger("InboxOrphanedThreadsComponent", NgxLoggerLevel.ERROR);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    try {
      const response = await this.inboxService.orphanedThreads();
      this.remapCandidates = response.remapCandidates;
      this.totalCount = response.totalCount;
      this.groups = this.groupByRoleType(response.orphanedThreads);
      this.folderlessThreadIds = response.folderlessThreadIds;
    } catch (error) {
      this.logger.info("orphaned-threads unavailable (likely not an inbox administrator):", error);
      this.groups = [];
      this.totalCount = 0;
      this.folderlessThreadIds = [];
    }
  }

  async restoreToInbox(): Promise<void> {
    if (this.folderlessThreadIds.length > 0) {
      this.busy = true;
      this.statusMessage = null;
      try {
        const result = await this.inboxService.restoreThreadsToInbox(this.folderlessThreadIds);
        this.statusMessage = `Restored ${result.modified} conversation${result.modified === 1 ? "" : "s"} to the inbox.`;
        await this.load();
        this.remapped.emit();
      } catch (error) {
        this.statusMessage = `Could not restore: ${(error as Error).message}`;
        this.logger.error("restore to inbox failed:", error);
      } finally {
        this.busy = false;
      }
    }
  }

  private groupByRoleType(orphanedThreads: OrphanedInboxThread[]): InboxOrphanedThreadGroup[] {
    const byRoleType = orphanedThreads.reduce((groups, item) => {
      const existing = groups[item.thread.roleType] ?? [];
      groups[item.thread.roleType] = existing.concat(item);
      return groups;
    }, {} as Record<string, OrphanedInboxThread[]>);
    return keys(byRoleType).map(roleType => {
      const items = byRoleType[roleType];
      const proposal = this.mostCommonProposal(items);
      const suggestedRoleType = this.remapCandidates.some(candidate => candidate.roleType === proposal) ? proposal : null;
      return {
        roleType,
        count: items.length,
        threadIds: items.map(item => item.thread.id),
        suggestedRoleType,
        targetRoleType: suggestedRoleType
      };
    });
  }

  private mostCommonProposal(items: OrphanedInboxThread[]): string | null {
    const counts = items.reduce((tally, item) => {
      if (item.proposedRoleType) {
        tally[item.proposedRoleType] = (tally[item.proposedRoleType] ?? 0) + 1;
      }
      return tally;
    }, {} as Record<string, number>);
    return keys(counts).sort((left, right) => counts[right] - counts[left])[0] ?? null;
  }

  candidateLabel(candidate: InboxRemapCandidate): string {
    return candidate.roleEmail || candidate.roleType;
  }

  groupDescription(roleType: string): string {
    return isInboxGeneralRoleType(roleType)
      ? "a general (catch-all) mailbox that no longer exists"
      : `the removed "${roleType}" mailbox`;
  }

  async remapGroup(group: InboxOrphanedThreadGroup): Promise<void> {
    await this.applyRemap(group.threadIds, group.targetRoleType);
  }

  private async applyRemap(threadIds: string[], targetRoleType: string | null): Promise<void> {
    if (targetRoleType && threadIds.length > 0) {
      this.busy = true;
      this.statusMessage = null;
      try {
        const result = await this.inboxService.remapThreads({threadIds, targetRoleType});
        this.statusMessage = `Remapped ${result.modified} conversation${result.modified === 1 ? "" : "s"}.`;
        await this.load();
        this.remapped.emit();
      } catch (error) {
        this.statusMessage = `Could not remap: ${(error as Error).message}`;
        this.logger.error("remap failed:", error);
      } finally {
        this.busy = false;
      }
    }
  }
}
