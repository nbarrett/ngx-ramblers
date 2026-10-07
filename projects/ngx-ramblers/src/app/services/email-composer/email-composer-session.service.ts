import {AlertTarget} from "../../models/alert-target.model";
import {AlertInstance} from "../notifier.service";
import {SystemConfig} from "../../models/system.model";
import {Subject} from "rxjs";
import {inject} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {keys} from "es-toolkit/compat";
import {BrandingMode, EmailCompositionKind, EmailComposerStepKey, EmailComposerState} from "../../models/email-composer.model";
import {composerApiErrorMessage, defaultEmailComposerState} from "../../functions/email-composer";
import {InboxReplyOutboundContext} from "../../models/inbox.model";
import {Injectable} from "@angular/core";

@Injectable()
export class EmailComposerSessionService {
  systemConfig: SystemConfig | null = null;
  currentDraftId: string | null = null;
  platformAdminEnabled = false;
  notifyTarget: AlertTarget = {};
  notify!: AlertInstance;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly requestStep = new Subject<EmailComposerStepKey>();
  readonly contentChanged = new Subject<void>();
  attachmentWarning: string | null = null;
  state: EmailComposerState = defaultEmailComposerState();
  public inboxReplyContext: InboxReplyOutboundContext | null = null;

  errorMessage(error: unknown): string {
    return composerApiErrorMessage(error);
  }

  newsletterMode(): boolean {
    return this.state.compositionKind === EmailCompositionKind.NEWSLETTER;
  }

  releaseNoteUpdateMode(): boolean {
    return this.state.compositionKind === EmailCompositionKind.RELEASE_NOTE_UPDATE;
  }

  eventsStepOmitted(): boolean {
    return this.releaseNoteUpdateMode() || this.state.brandingMode === BrandingMode.UNBRANDED || !!this.state.notificationConfig?.omitEventsStep;
  }

  syncStateToUrl(extra: Record<string, string | null | undefined>): void {
    const current = this.route.snapshot.queryParamMap;
    const changed = keys(extra).some(key => (extra[key] ?? null) !== (current.get(key) ?? null));
    if (changed) {
      this.router.navigate([], {
        queryParams: extra,
        queryParamsHandling: "merge",
        replaceUrl: true
      });
    }
  }
}
