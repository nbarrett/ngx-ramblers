import { EmailComposerEventSelectionService } from "../../services/email-composer/email-composer-event-selection.service";
import { EmailComposerSessionService } from "../../services/email-composer/email-composer-session.service";
import { EmailComposerRecipientsService } from "../../services/email-composer/email-composer-recipients.service";
import { EmailComposerRecipientSourcesService } from "../../services/email-composer/email-composer-recipient-sources.service";
import { EmailComposerUpdateSettingsService } from "../../services/email-composer/email-composer-update-settings.service";
import { ArticleBlock, ComposerFragment, DEFAULT_NEWSLETTER_CADENCE, EmailComposerStepKey, EmailCompositionKind, EventInclusionMode, NEWSLETTER_CADENCE_OPTIONS, NewsletterCadence, NewsletterCadenceOption, NewsletterStartMode, NewsletterWindow, PreviousNewsletter, RecipientMode } from "../../models/email-composer.model";
import { EmailComposerFragmentsService } from "../../services/email-composer/email-composer-fragments.service";
import { inject } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { defaultNewsletterSettings, defaultReleaseNoteUpdateSettings, releaseNoteUpdateArticlesFrom, releaseNoteUpdateFragmentOrder, releaseNoteUpdateSubject } from "../../functions/email-composer";
import { newEventCount, newsletterWindowFrom } from "../../functions/newsletter-window";
import { AiService } from "../../services/ai/ai.service";
import { DEFAULT_NEWSLETTER_INTRO_PURPOSE, NEWSLETTER_INTRO_PURPOSE_OPTIONS, NewsletterIntroEvent, NewsletterIntroPurpose, NewsletterPlan, ReleaseNoteUpdateDraftOutcome, ReleaseNoteUpdateResponse } from "../../models/ai.model";
import { eventsForPurpose } from "../../functions/newsletter-purpose";
import { ComposerDrafting } from "../../models/mail.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { EmailCompositionsService } from "../../services/email-composer/email-compositions.service";
import { GroupEventSummary } from "../../models/committee.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { StoredValue } from "../../models/ui-actions";
import { Injectable } from "@angular/core";


@Injectable()
export class EmailComposerDraftingService {
  logger: Logger = inject(LoggerFactory).createLogger("EmailComposer", NgxLoggerLevel.ERROR);

  session = inject(EmailComposerSessionService);

  dateUtils = inject(DateUtilsService);

  events = inject(EmailComposerEventSelectionService);

  compositionsService = inject(EmailCompositionsService);

  aiService = inject(AiService);

  updateSettings = inject(EmailComposerUpdateSettingsService);

  recipients = inject(EmailComposerRecipientsService);

  recipientSources = inject(EmailComposerRecipientSourcesService);

  fragmentEditor = inject(EmailComposerFragmentsService);

  readonly newsletterCadenceOptions: NewsletterCadenceOption[] = NEWSLETTER_CADENCE_OPTIONS;

  readonly newsletterPeriodOptions: NewsletterCadenceOption[] = NEWSLETTER_CADENCE_OPTIONS.filter(option => option.days !== null);

  newsletterStartMode: NewsletterStartMode = NewsletterStartMode.PERIOD;

  newsletterStartPeriod: NewsletterCadence = DEFAULT_NEWSLETTER_CADENCE;

  newsletterFreeText = "";

  creatingNewsletter = false;

  creatingReleaseNoteUpdate = false;

  draftingIntro = false;

  draftingReleaseNoteUpdate = false;

  draftPurpose: NewsletterIntroPurpose = DEFAULT_NEWSLETTER_INTRO_PURPOSE;

  readonly draftPurposeOptions = NEWSLETTER_INTRO_PURPOSE_OPTIONS;

  introBeforeDraft: string | null = null;

  articlesBeforeDraft: ArticleBlock[] | null = null;

  fragmentOrderBeforeDraft: ComposerFragment[] | null = null;

  previousNewsletter: PreviousNewsletter | null = null;

  draftingOffered(): boolean {
      return this.session.state.notificationConfig?.composerDrafting?.offerDraftedIntro === true;
    }

  availableStartModes(): NewsletterStartMode[] {
      return [
        ...(this.draftingOffered() ? [NewsletterStartMode.PERIOD, NewsletterStartMode.FREE_TEXT] : []),
        ...(this.session.platformAdminEnabled ? [NewsletterStartMode.UPDATE] : [])
      ];
    }

  effectiveStartMode(): NewsletterStartMode {
      const available = this.availableStartModes();
      return available.includes(this.newsletterStartMode) ? this.newsletterStartMode : (available[0] ?? NewsletterStartMode.PERIOD);
    }

  startModeLabel(mode: NewsletterStartMode): string {
      return mode === NewsletterStartMode.PERIOD ? "Create a newsletter for a period"
        : mode === NewsletterStartMode.FREE_TEXT ? "Create one from free text"
          : "Create a platform update";
    }

  startModeHint(): string {
      return this.effectiveStartMode() === NewsletterStartMode.UPDATE
        ? "Draft a short update for chairs, webmasters and committee members about what has shipped on NGX since the last one. You review and edit it before anything goes out."
        : "Have the coming walks and social events pulled in for you, with an intro drafted from them. Everything stays editable afterwards.";
    }

  composerDrafting(): ComposerDrafting {
      return this.session.state.notificationConfig?.composerDrafting ?? {
        offerDraftedIntro: true,
        onlyApprovedWalks: true
      };
    }

  setOfferDraftedIntro(offerDraftedIntro: boolean): void {
      if (this.session.state.notificationConfig) {
        this.session.state.notificationConfig.composerDrafting = {...this.composerDrafting(), offerDraftedIntro};
      }
    }

  setOnlyApprovedWalks(onlyApprovedWalks: boolean): void {
      if (this.session.state.notificationConfig) {
        this.session.state.notificationConfig.composerDrafting = {...this.composerDrafting(), onlyApprovedWalks};
      }
    }

  async onNewsletterModeToggled(enabled: boolean): Promise<void> {
      this.session.state.compositionKind = enabled ? EmailCompositionKind.NEWSLETTER : EmailCompositionKind.STANDARD;
      if (enabled) {
        this.session.state.releaseNoteUpdate = null;
        this.session.state.newsletter = this.session.state.newsletter ?? defaultNewsletterSettings();
        await this.loadPreviousNewsletter();
        this.applyNewsletterWindow();
        await this.events.populateGroupEvents();
      } else {
        this.session.state.newsletter = null;
        this.previousNewsletter = null;
        this.session.state.groupEvents = this.events.markNewSinceLastNewsletter(this.session.state.groupEvents);
      }
    }

  async loadPreviousNewsletter(): Promise<void> {
      this.previousNewsletter = await this.compositionsService.previousNewsletter(this.session.currentDraftId);
      const existing = this.session.state.newsletter ?? defaultNewsletterSettings();
      this.session.state.newsletter = {
        ...existing,
        cadence: this.previousNewsletter?.cadence ?? existing.cadence,
        previousNewsletterId: this.previousNewsletter?.id ?? null,
        previousSentAt: this.previousNewsletter?.sentAt ?? null,
        previousWindowEnd: this.previousNewsletter?.windowEnd ?? null,
        previouslyAnnouncedEventIds: this.previousNewsletter?.announcedEventIds ?? []
      };
      if (this.previousNewsletter?.selectedListId && !this.session.state.selectedListId) {
        this.session.state.selectedListId = this.previousNewsletter.selectedListId;
      }
    }

  async onNewsletterCadenceChange(cadence: NewsletterCadence): Promise<void> {
      if (this.session.state.newsletter) {
        this.session.state.newsletter.cadence = cadence;
        this.applyNewsletterWindow();
        await this.events.populateGroupEvents();
      }
    }

  onMarkNewEventsChanged(): void {
      this.session.state.groupEvents = this.events.markNewSinceLastNewsletter(this.session.state.groupEvents);
    }

  currentNewsletterWindow(): NewsletterWindow | null {
      const filter = this.session.state.groupEventsFilter;
      return filter?.fromDate?.value && filter?.toDate?.value
        ? {fromMillis: filter.fromDate.value, toMillis: filter.toDate.value, continuesPreviousWindow: false}
        : null;
    }

  applyNewsletterWindow(): void {
      if (this.session.state.newsletter) {
        this.events.ensureGroupEventsFilter();
        const window = newsletterWindowFrom(this.previousNewsletter, this.session.state.newsletter.cadence, this.dateUtils.dateTimeNow().toMillis(), this.currentNewsletterWindow());
        this.applyNewsletterDates(window.fromMillis, window.toMillis);
      }
    }

  applyNewsletterDates(fromMillis: number, toMillis: number): void {
      this.session.state.groupEventsFilter!.fromDate = this.dateUtils.asDateValue(fromMillis);
      this.session.state.groupEventsFilter!.toDate = this.dateUtils.asDateValue(toMillis);
      this.events.recomputeSliderBoundsFromCurrentRange();
      this.events.selectedDateRangePreset = this.events.matchPresetToCurrentRange();
    }

  async createNewsletter(): Promise<void> {
      const freeText = this.newsletterFreeText.trim();
      if (this.newsletterStartMode === NewsletterStartMode.FREE_TEXT && !freeText) {
        this.session.notify.warning({
          title: "Create newsletter",
          message: "Describe the newsletter you want first, such as everything up to the end of September."
        });
      } else {
        this.creatingNewsletter = true;
        try {
          await this.buildNewsletter(this.newsletterStartMode === NewsletterStartMode.FREE_TEXT ? await this.plannedNewsletter(freeText) : null);
        } catch (error) {
          this.logger.error("createNewsletter failed", error);
          this.session.notify.warning({
            title: "Create newsletter",
            message: `The newsletter could not be created: ${this.session.errorMessage(error)}`
          });
        } finally {
          this.creatingNewsletter = false;
          this.session.contentChanged.next();
        }
      }
    }

  async plannedNewsletter(request: string): Promise<NewsletterPlan | null> {
      try {
        const plan = await this.aiService.newsletterPlan({request});
        if (!plan?.understood) {
          this.session.notify.warning({
            title: "Create newsletter",
            message: "The period in that description was not clear, so the next month has been used. The dates can be changed on the Events step."
          });
        }
        return plan ?? null;
      } catch (error) {
        this.logger.error("plannedNewsletter failed", error);
        this.session.notify.warning({
          title: "Create newsletter",
          message: `The description could not be worked out, so the next month has been used instead: ${this.session.errorMessage(error)}`
        });
        return null;
      }
    }

  async buildNewsletter(plan: NewsletterPlan | null): Promise<void> {
      this.session.state.compositionKind = EmailCompositionKind.NEWSLETTER;
      this.session.state.releaseNoteUpdate = null;
      this.session.state.eventInclusion = EventInclusionMode.AUTO_INCLUDE;
      this.events.ensureGroupEventsFilter();
      await this.loadPreviousNewsletter();
      this.session.state.newsletter!.cadence = plan ? NewsletterCadence.CUSTOM : this.newsletterStartPeriod;
      this.session.state.newsletter!.guidance = plan?.guidance ?? (this.newsletterStartMode === NewsletterStartMode.FREE_TEXT ? this.newsletterFreeText.trim() : null);
      if (plan) {
        this.applyNewsletterDates(plan.fromMillis, plan.toMillis);
      } else {
        this.applyNewsletterWindow();
      }
      this.session.syncStateToUrl({[StoredValue.EVENT_INCLUSION]: EventInclusionMode.AUTO_INCLUDE});
      await this.events.populateGroupEvents();
      this.applyNewsletterSubject();
      await this.draftNewsletterIntro();
      this.session.requestStep.next(EmailComposerStepKey.COMPOSE);
    }

  applyNewsletterSubject(): void {
      const period = this.newsletterPeriodDescription();
      if (period && !this.session.state.subject?.trim()) {
        this.session.state.subject = `What's coming up: ${period}`;
      }
    }

  previousNewsletterExists(): boolean {
      return !!this.previousNewsletter || !!this.session.state.newsletter?.previousNewsletterId;
    }

  newsletterWindowTitle(): string {
      const previousSentAt = this.previousNewsletter?.sentAt ?? this.session.state.newsletter?.previousSentAt;
      const sentAt = previousSentAt ? this.dateUtils.displayDate(previousSentAt) : "an unrecorded date";
      return this.previousNewsletterExists() ? `Last newsletter went out on ${sentAt}` : "This is the first newsletter";
    }

  newEventsSentence(): string {
      const newCount = newEventCount(this.session.state.groupEvents);
      const countDescription = newCount === 0 ? "None of them are" : newCount === 1 ? "One of them is" : `${newCount} of them are`;
      return this.session.state.newsletter?.markNewEvents ? ` ${countDescription} new since that newsletter.` : "";
    }

  newsletterWindowDescription(): string {
      const range = this.newsletterPeriodDescription() ?? "the dates chosen on the Events step";
      return this.previousNewsletterExists()
        ? `Covering ${range}, carrying on from the last one so members are not told the same thing twice.${this.newEventsSentence()}`
        : `There is no earlier newsletter to carry on from, so this one covers ${range}. Every event is shown as it is, with nothing marked as new.`;
    }

  introDraftUndoAvailable(): boolean {
      return this.introBeforeDraft !== null;
    }

  undoDraftedIntro(): void {
      if (this.introBeforeDraft !== null) {
        this.session.state.introMarkdown = this.introBeforeDraft;
        this.introBeforeDraft = null;
      }
      if (this.articlesBeforeDraft !== null) {
        this.session.state.articleBlocks = this.articlesBeforeDraft;
        this.articlesBeforeDraft = null;
      }
      if (this.fragmentOrderBeforeDraft !== null) {
        this.session.state.fragmentOrder = this.fragmentOrderBeforeDraft;
        this.fragmentOrderBeforeDraft = null;
      }
    }

  awaitingDetails(event: GroupEventSummary): boolean {
      const isWalk = event.ramblersEventType !== RamblersEventType.GROUP_EVENT;
      return isWalk && (!event.contactName?.trim() || !event.distance?.trim() || !event.title?.trim() || /^awaiting\b/i.test(event.title));
    }

  newsletterIntroEvents(): NewsletterIntroEvent[] {
      return this.events.selectedGroupEventsList().map(event => ({
        title: event.title,
        eventType: event.eventType?.description || "Event",
        dateDescription: this.dateUtils.displayDate(event.eventDate),
        distance: event.distance || undefined,
        location: event.location || undefined,
        description: event.description || undefined,
        newSinceLastNewsletter: this.session.state.newsletter?.markNewEvents ? event.newSinceLastNewsletter : undefined,
        awaitingDetails: this.awaitingDetails(event)
      }));
    }

  newsletterPeriodDescription(): string | undefined {
      const from = this.session.state.groupEventsFilter?.fromDate?.value;
      const to = this.session.state.groupEventsFilter?.toDate?.value;
      return from && to ? `${this.dateUtils.displayDate(from)} to ${this.dateUtils.displayDate(to)}` : undefined;
    }

  draftPurposeLabel(): string {
      return NEWSLETTER_INTRO_PURPOSE_OPTIONS.find(option => option.key === this.draftPurpose)?.label ?? "";
    }

  draftPurposeHint(): string {
      return NEWSLETTER_INTRO_PURPOSE_OPTIONS.find(option => option.key === this.draftPurpose)?.hint ?? "";
    }

  eventsForDraftPurpose(): NewsletterIntroEvent[] {
      const events = this.composerDrafting().onlyApprovedWalks
        ? this.newsletterIntroEvents().filter(event => !event.awaitingDetails)
        : this.newsletterIntroEvents();
      return eventsForPurpose(events, this.draftPurpose);
    }

  async draftNewsletterIntro(): Promise<void> {
      const events = this.eventsForDraftPurpose();
      if (events.length) {
        await this.requestDraftedIntro(events);
      } else {
        this.session.notify.warning({
          title: "Draft intro", message: this.draftPurpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST
            ? "None of the selected dates are empty slots, so there is nothing to ask for leaders for. Widen the dates on the Events step."
            : "No completed events are selected, so there is nothing to write an intro from. Choose events, or widen the dates, on the Events step."
        });
      }
    }

  selectCommitteeRoleRecipients(): void {
      const roleMemberIds = (this.recipientSources.committeeReferenceData?.committeeMembers() ?? [])
        .map(role => role.memberId)
        .filter((memberId): memberId is string => !!memberId);
      const uniqueIds = Array.from(new Set(roleMemberIds));
      if (uniqueIds.length) {
        this.recipients.setRecipientMode(RecipientMode.SELECTED_MEMBERS);
        this.session.state.selectedMemberIds = uniqueIds;
      }
    }

  applyReleaseNoteUpdateProfileRecipients(): void {
      const profile = this.updateSettings.releaseNoteUpdateConfiguration.profiles.find(candidate => candidate.id === this.updateSettings.selectedReleaseNoteUpdateProfileId);
      if (profile?.recipientMode === RecipientMode.ENTIRE_LIST && profile.selectedListId !== null) {
        this.recipients.setRecipientMode(RecipientMode.ENTIRE_LIST);
        this.session.state.selectedListId = profile.selectedListId;
      } else {
        this.selectCommitteeRoleRecipients();
      }
    }

  async createReleaseNoteUpdate(): Promise<void> {
      this.creatingReleaseNoteUpdate = true;
      try {
        this.session.state.compositionKind = EmailCompositionKind.RELEASE_NOTE_UPDATE;
        this.session.state.newsletter = null;
        this.session.state.eventInclusion = EventInclusionMode.NONE;
        this.updateSettings.releaseNoteUpdateSettings(this.session.state, this.session.currentDraftId);
        await this.updateSettings.loadPreviousReleaseNoteUpdate(this.session.state, this.session.currentDraftId);
        this.updateSettings.applyReleaseNoteUpdateWindow(this.session.state, this.session.currentDraftId);
        this.applyReleaseNoteUpdateProfileRecipients();
        this.applyReleaseNoteUpdateSubject();
        const drafted = await this.draftReleaseNoteUpdate();
        if (drafted) {
          this.session.requestStep.next(EmailComposerStepKey.COMPOSE);
        }
      } catch (error) {
        this.logger.error("createReleaseNoteUpdate failed", error);
        this.session.notify.warning({
          title: "Create update",
          message: `The update could not be created: ${this.session.errorMessage(error)}`
        });
      } finally {
        this.creatingReleaseNoteUpdate = false;
        this.session.contentChanged.next();
      }
    }

  applyReleaseNoteUpdateSubject(): void {
      const period = this.updateSettings.releaseNoteUpdatePeriodDescription(this.session.state, this.session.currentDraftId);
      this.session.state.subject = releaseNoteUpdateSubject(this.session.state.subject, this.session.state.notificationConfig?.subject?.text ?? null, period);
    }

  async draftReleaseNoteUpdate(): Promise<boolean> {
      const result = {drafted: false};
      if (!this.session.state.releaseNoteUpdate?.fromMillis || !this.session.state.releaseNoteUpdate?.toMillis) {
        this.session.notify.warning({title: "Draft update", message: "Choose the period to cover first."});
      } else {
        this.draftingReleaseNoteUpdate = true;
        const previousIntro = this.session.state.introMarkdown ?? "";
        try {
          const response = await this.aiService.releaseNoteUpdate({
            fromMillis: this.session.state.releaseNoteUpdate.fromMillis,
            toMillis: this.session.state.releaseNoteUpdate.toMillis,
            previouslyIncludedPaths: this.session.state.releaseNoteUpdate.excludePreviouslyIncluded ? this.session.state.releaseNoteUpdate.previouslyIncludedPaths : [],
            guidance: this.session.state.releaseNoteUpdate.guidance ?? undefined,
            groupName: this.session.systemConfig?.group?.longName || this.session.systemConfig?.group?.shortName,
            categories: [...this.session.state.releaseNoteUpdate.categories],
            coverage: this.session.state.releaseNoteUpdate.coverage,
            maximumThemes: this.session.state.releaseNoteUpdate.maximumThemes,
            maximumSourcesPerTheme: this.session.state.releaseNoteUpdate.maximumSourcesPerTheme,
            writingRules: this.session.state.releaseNoteUpdate.writingRules,
            includeTechnicalChanges: this.session.state.releaseNoteUpdate.includeTechnicalChanges,
            includeImages: this.session.state.releaseNoteUpdate.includeImages
          });
          this.applyReleaseNoteUpdateResponse(response, previousIntro);
          result.drafted = !!response?.draft;
        } catch (error) {
          this.logger.error("draftReleaseNoteUpdate failed", error);
          this.session.notify.warning({
            title: "Draft update",
            message: `The update could not be drafted, so it has been left as it was: ${this.session.errorMessage(error)}`
          });
        } finally {
          this.draftingReleaseNoteUpdate = false;
          this.session.contentChanged.next();
        }
      }
      return result.drafted;
    }

  applyReleaseNoteUpdateResponse(response: ReleaseNoteUpdateResponse, previousIntro: string): void {
      const draft = response?.draft;
      if (!draft) {
        this.session.notify.warning({
          title: "Draft update",
          message: "Nothing came back, so the update has been left as it was."
        });
      } else {
        this.introBeforeDraft = previousIntro;
        this.articlesBeforeDraft = [...(this.session.state.articleBlocks ?? [])];
        this.fragmentOrderBeforeDraft = [...(this.session.state.fragmentOrder ?? [])];
        this.session.state.introMarkdown = draft.intro ?? "";
        this.session.state.articleBlocks = releaseNoteUpdateArticlesFrom(draft);
        this.session.state.fragmentOrder = releaseNoteUpdateFragmentOrder(this.session.state.articleBlocks);
        this.session.state.releaseNoteUpdate = {
          ...(this.session.state.releaseNoteUpdate ?? defaultReleaseNoteUpdateSettings()),
          includedPaths: Array.from(new Set((draft.items ?? []).flatMap(item => item.sourcePaths))),
          indexPath: draft.indexPath
        };
        (this.session.state.articleBlocks ?? []).forEach(block => this.fragmentEditor.expandedFragmentIds.add(block.id));
        this.fragmentEditor.expandedFragmentIds.add("intro");
        if (response.emptyWindow) {
          this.session.notify.warning({
            title: "Draft update",
            message: "Nothing shipped in this period, so the draft says so rather than inventing news."
          });
        } else if (response.drafted) {
          this.session.notify.success({
            title: "Draft update",
            message: "Update drafted from the release notes. Read it over and change anything you would say differently."
          });
        } else if (response.draftOutcome === ReleaseNoteUpdateDraftOutcome.AI_DISABLED) {
          this.session.notify.warning({
            title: "Draft update",
            message: "AI drafting is not enabled for this environment, so no summary was generated. The release-note headlines have been added for writing by hand."
          });
        } else {
          this.session.notify.warning({
            title: "Draft update",
            message: "The drafting service returned a response that could not be read, so no summary was generated. The release-note headlines have been added for writing by hand."
          });
        }
      }
    }

  async requestDraftedIntro(events: NewsletterIntroEvent[]): Promise<void> {
      this.draftingIntro = true;
      const previousIntro = this.session.state.introMarkdown ?? "";
      try {
        const output = await this.aiService.newsletterIntro({
          events,
          periodDescription: this.newsletterPeriodDescription(),
          groupName: this.session.systemConfig?.group?.longName || this.session.systemConfig?.group?.shortName,
          guidance: this.session.state.newsletter?.guidance ?? undefined,
          purpose: this.draftPurpose
        });
        if (output?.trim()) {
          this.introBeforeDraft = previousIntro;
          this.session.state.introMarkdown = output.trim();
          this.session.notify.success({
            title: "Draft intro",
            message: "Intro drafted from the selected events. Read it over and change anything you would say differently."
          });
        } else {
          this.session.notify.warning({
            title: "Draft intro",
            message: "Nothing came back, so the intro has been left as it was."
          });
        }
      } catch (error) {
        this.logger.error("draftNewsletterIntro failed", error);
        this.session.notify.warning({
          title: "Draft intro",
          message: `The intro could not be drafted, so it has been left as it was: ${this.session.errorMessage(error)}`
        });
      } finally {
        this.draftingIntro = false;
        this.session.contentChanged.next();
      }
    }
}
