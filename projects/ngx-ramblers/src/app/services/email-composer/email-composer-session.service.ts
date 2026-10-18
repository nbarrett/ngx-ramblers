import {AlertTarget} from "../../models/alert-target.model";
import {AlertInstance} from "../notifier.service";
import {SystemConfig} from "../../models/system.model";
import {Subject} from "rxjs";
import {inject} from "@angular/core";
import {BrandingMode, EmailCompositionKind, EmailComposerStepKey, EmailComposerState} from "../../models/email-composer.model";
import {composerApiErrorMessage, defaultEmailComposerState} from "../../functions/email-composer";
import {InboxReplyOutboundContext} from "../../models/inbox.model";
import {Injectable} from "@angular/core";
import {StoredValue} from "../../models/ui-actions";
import {UiActionsService} from "../ui-actions.service";

@Injectable()
export class EmailComposerSessionService {
  systemConfig: SystemConfig | null = null;
  currentDraftId: string | null = null;
  platformAdminEnabled = false;
  notifyTarget: AlertTarget = {};
  notify!: AlertInstance;
  private uiActions = inject(UiActionsService);
  private pendingUrlParams: Record<string, string | null | undefined> = {};
  private scheduledUrlSync: Promise<boolean> | null = null;
  readonly requestStep = new Subject<EmailComposerStepKey>();
  readonly contentChanged = new Subject<void>();
  attachmentWarning: string | null = null;
  state: EmailComposerState = defaultEmailComposerState();
  public inboxReplyContext: InboxReplyOutboundContext | null = null;

  errorMessage(error: unknown): string {
    return composerApiErrorMessage(error);
  }

  newsletterMode(): boolean {
    return this.state.brandingMode !== BrandingMode.UNBRANDED && this.state.compositionKind === EmailCompositionKind.NEWSLETTER;
  }

  releaseNoteUpdateMode(): boolean {
    return this.state.brandingMode !== BrandingMode.UNBRANDED && this.state.compositionKind === EmailCompositionKind.RELEASE_NOTE_UPDATE;
  }

  eventsStepOmitted(): boolean {
    return this.releaseNoteUpdateMode() || this.state.brandingMode === BrandingMode.UNBRANDED || !!this.state.notificationConfig?.omitEventsStep;
  }

  syncStateToUrl(extra: Record<string, string | null | undefined>): Promise<boolean> {
    const params = this.state.brandingMode === BrandingMode.UNBRANDED ? {...extra, [StoredValue.CONFIG_ID]: null} : extra;
    this.pendingUrlParams = {...this.pendingUrlParams, ...params};
    if (!this.scheduledUrlSync) {
      this.scheduledUrlSync = Promise.resolve().then(() => {
        const queryParams = this.pendingUrlParams;
        this.pendingUrlParams = {};
        this.scheduledUrlSync = null;
        return this.uiActions.updateQueryParameters(queryParams);
      });
    }
    return this.scheduledUrlSync;
  }
}
