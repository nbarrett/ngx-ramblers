import { EmailComposerEventSelectionService } from "./email-composer-event-selection.service";
import { EmailComposerSessionService } from "./email-composer-session.service";
import { EmailComposerRecipientsService } from "./email-composer-recipients.service";
import { EmailComposerRecipientSourcesService } from "./email-composer-recipient-sources.service";
import { EmailComposerUpdateSettingsService } from "./email-composer-update-settings.service";
import { ArticleBlock, BrandingMode, ComposerFragment, DEFAULT_NEWSLETTER_CADENCE, EmailComposerStepKey, EmailCompositionKind, EventInclusionMode, NEWSLETTER_CADENCE_OPTIONS, NewsletterCadence, NewsletterCadenceOption, NewsletterStartMode, NewsletterWindow, PreviousNewsletter, RecipientMode } from "../../models/email-composer.model";
import { EmailComposerFragmentsService } from "./email-composer-fragments.service";
import { inject } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { defaultNewsletterSettings, defaultReleaseNoteUpdateSettings, releaseNoteUpdateArticlesFrom, releaseNoteUpdateFragmentOrder, releaseNoteUpdateSubject } from "../../functions/email-composer";
import { newEventCount, newsletterPeriodPhrase, newsletterSubjectFromSelection, newsletterWindowFrom } from "../../functions/newsletter-window";
import { ProgrammeOverviewStatus, walkIsMemberFacing, walkNeedsLeader } from "../../models/walk-programme.model";
import { subjectStillDefault } from "../../functions/email-composer-intro-paste";
import { AiService } from "../ai/ai.service";
import { DEFAULT_NEWSLETTER_INTRO_DETAIL, NEWSLETTER_INTRO_DETAIL_OPTIONS, NEWSLETTER_INTRO_PURPOSE_OPTIONS, NewsletterIntroDetail, NewsletterIntroEvent, NewsletterIntroPurpose, NewsletterIntroPurposeOption, NewsletterPlan, ReleaseNoteUpdateDraftOutcome, ReleaseNoteUpdateResponse } from "../../models/ai.model";
import { emptyDraftPurposeCopy as purposeEmptyCopy, emptyDraftPurposeMessage as purposeEmptyMessage, eventsMatchingDraftPurpose, introPurposeFrom, walkTimeOfDayFromHour } from "../../functions/newsletter-purpose";
import { UIDateFormat } from "../../models/date-format.model";
import { walkChangeFieldsFrom, WALK_CHANGE_INTRO_LOOKBACK_DAYS } from "../../functions/walk-change-intro";
import { ComposerDrafting } from "../../models/mail.model";
import { WALK_CHANGE_INTRO_SELECT } from "../../models/walk.model";
import { GroupEventService } from "../walks-and-events/group-event.service";
import { WalksAndEventsService } from "../walks-and-events/walks-and-events.service";
import { DateUtilsService } from "../date-utils.service";
import { EmailCompositionsService } from "./email-compositions.service";
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
  walksAndEventsService = inject(WalksAndEventsService);
  groupEventService = inject(GroupEventService);
  readonly newsletterCadenceOptions: NewsletterCadenceOption[] = NEWSLETTER_CADENCE_OPTIONS;
  readonly newsletterPeriodOptions: NewsletterCadenceOption[] = NEWSLETTER_CADENCE_OPTIONS.filter(option => option.key !== NewsletterCadence.CUSTOM);
  newsletterStartMode: NewsletterStartMode = NewsletterStartMode.PERIOD;
  newsletterStartPeriod: NewsletterCadence = DEFAULT_NEWSLETTER_CADENCE;
  introDetail: NewsletterIntroDetail = DEFAULT_NEWSLETTER_INTRO_DETAIL;
  newsletterFreeText = "";
  creatingNewsletter = false;
  creatingReleaseNoteUpdate = false;
  draftingIntro = false;
  draftingReleaseNoteUpdate = false;
  draftPurposeOptions: NewsletterIntroPurposeOption[] = NEWSLETTER_INTRO_PURPOSE_OPTIONS;
  walkChangeIntroById: Map<string, NewsletterIntroEvent["changes"]> | null = null;
  introBeforeDraft: string | null = null;
  articlesBeforeDraft: ArticleBlock[] | null = null;
  fragmentOrderBeforeDraft: ComposerFragment[] | null = null;
  previousNewsletter: PreviousNewsletter | null = null;
  ignoredPreviousNewsletter = false;
  lastAppliedNewsletterSubject: string | null = null;
  private leaderRequestPeriodReady = false;
  private startPeriodFromPreviousApplied = false;

  walkLeaderRequest(): boolean {
    return this.currentDraftPurpose() === NewsletterIntroPurpose.WALK_LEADER_REQUEST;
  }

  draftingOffered(): boolean {
    return this.session.state.notificationConfig?.composerDrafting?.offerDraftedIntro === true;
  }

  introDraftOffered(): boolean {
    return this.draftingOffered()
      && !this.session.releaseNoteUpdateMode()
      && this.effectiveStartMode() !== NewsletterStartMode.UPDATE;
  }

  startUiOffered(): boolean {
    return this.session.state.brandingMode !== BrandingMode.UNBRANDED
      && !this.session.inboxReplyContext
      && !this.session.currentDraftId
      && !this.session.releaseNoteUpdateMode();
  }

  availableStartModes(): NewsletterStartMode[] {
    this.ensureWalkLeaderRequestPeriod();
    return this.startUiOffered()
      ? [
        ...(this.draftingOffered() ? [NewsletterStartMode.PERIOD, NewsletterStartMode.FREE_TEXT] : []),
        ...(this.session.platformAdminEnabled && !this.walkLeaderRequest() ? [NewsletterStartMode.UPDATE] : [])
      ]
      : [];
  }

  effectiveStartMode(): NewsletterStartMode {
    const available = this.availableStartModes();
    return available.includes(this.newsletterStartMode) ? this.newsletterStartMode : (available[0] ?? NewsletterStartMode.PERIOD);
  }

  startModeLabel(mode: NewsletterStartMode): string {
    return mode === NewsletterStartMode.PERIOD
      ? this.walkLeaderRequest() ? "Ask for walk leaders for a period" : "Create a newsletter for a period"
      : mode === NewsletterStartMode.FREE_TEXT
        ? this.walkLeaderRequest() ? "Describe the dates in your own words" : "Create one from free text"
        : "Create a platform update";
  }

  startModeHint(): string {
    return this.effectiveStartMode() === NewsletterStartMode.UPDATE
      ? "Draft a short update for chairs, webmasters and committee members about what has shipped on NGX since the last one. You review and edit it before anything goes out."
      : this.walkLeaderRequest()
        ? "Pull in the empty slots that still need a walk leader, then draft the opening paragraph below."
        : "Pull in the coming walks and social events for the period you choose, then draft the opening paragraph below.";
  }

  periodSelectLabel(): string {
    return this.walkLeaderRequest() ? "Ask for leaders covering:" : "Create a newsletter covering:";
  }

  createActionLabel(): string {
    return this.creatingNewsletter
      ? "Creating…"
      : this.walkLeaderRequest() ? "Select the empty slots" : "Create newsletter";
  }

  ensureWalkLeaderRequestPeriod(): void {
    if (this.walkLeaderRequest() && !this.leaderRequestPeriodReady) {
      this.newsletterStartPeriod = NewsletterCadence.PROGRAMME;
      this.leaderRequestPeriodReady = true;
    }
  }

  composerDrafting(): ComposerDrafting {
    return this.session.state.notificationConfig?.composerDrafting ?? {
      offerDraftedIntro: true,
      onlyApprovedWalks: true
    };
  }

  currentDraftPurpose(): NewsletterIntroPurpose {
    return introPurposeFrom(this.composerDrafting());
  }

  async onNewsletterModeToggled(enabled: boolean): Promise<void> {
    this.session.state.compositionKind = enabled ? EmailCompositionKind.NEWSLETTER : EmailCompositionKind.STANDARD;
    if (enabled) {
      this.ignoredPreviousNewsletter = false;
      this.session.state.releaseNoteUpdate = null;
      this.session.state.newsletter = this.session.state.newsletter ?? defaultNewsletterSettings();
      await this.loadPreviousNewsletter();
      this.applyNewsletterWindow();
      await this.events.populateGroupEvents();
    } else {
      this.session.state.newsletter = null;
      this.previousNewsletter = null;
      this.ignoredPreviousNewsletter = false;
      this.session.state.groupEvents = this.events.markNewSinceLastNewsletter(this.session.state.groupEvents);
    }
  }

  async loadPreviousNewsletter(): Promise<void> {
    if (this.ignoredPreviousNewsletter) {
      this.previousNewsletter = null;
      const existing = this.session.state.newsletter ?? defaultNewsletterSettings();
      this.session.state.newsletter = {
        ...existing,
        previousNewsletterId: null,
        previousSentAt: null,
        previousWindowEnd: null,
        previouslyAnnouncedEventIds: []
      };
    } else {
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
    const title = this.walkLeaderRequest() ? "Walk leader request" : "Create newsletter";
    if (!this.creatingNewsletter) {
      if (this.newsletterStartMode === NewsletterStartMode.FREE_TEXT && !freeText) {
        this.session.notify.warning({
          title,
          message: this.walkLeaderRequest()
            ? "Describe the dates you want to cover first, such as all empty Sunday slots for the rest of the year."
            : "Describe the newsletter you want first, such as everything up to the end of September."
        });
      } else {
        this.creatingNewsletter = true;
        try {
          await this.buildNewsletter(this.newsletterStartMode === NewsletterStartMode.FREE_TEXT ? await this.plannedNewsletter(freeText) : null);
        } catch (error) {
          this.logger.error("createNewsletter failed", error);
          this.session.notify.warning({
            title,
            message: this.walkLeaderRequest()
              ? `The empty slots could not be selected: ${this.session.errorMessage(error)}`
              : `The newsletter could not be created: ${this.session.errorMessage(error)}`
          });
        } finally {
          this.creatingNewsletter = false;
          this.session.contentChanged.next();
        }
      }
    }
  }

  onNewsletterStartPeriodChange(period: NewsletterCadence): void {
    this.newsletterStartPeriod = period;
    this.newsletterStartMode = NewsletterStartMode.PERIOD;
    this.startPeriodFromPreviousApplied = true;
    void this.createNewsletter();
  }

  resetForNewComposition(): void {
    this.newsletterStartMode = NewsletterStartMode.PERIOD;
    this.newsletterStartPeriod = DEFAULT_NEWSLETTER_CADENCE;
    this.introDetail = DEFAULT_NEWSLETTER_INTRO_DETAIL;
    this.newsletterFreeText = "";
    this.creatingNewsletter = false;
    this.creatingReleaseNoteUpdate = false;
    this.draftingIntro = false;
    this.draftingReleaseNoteUpdate = false;
    this.walkChangeIntroById = null;
    this.introBeforeDraft = null;
    this.articlesBeforeDraft = null;
    this.fragmentOrderBeforeDraft = null;
    this.previousNewsletter = null;
    this.ignoredPreviousNewsletter = false;
    this.lastAppliedNewsletterSubject = null;
    this.leaderRequestPeriodReady = false;
    this.startPeriodFromPreviousApplied = false;
  }

  onIntroDetailSelect(id: string): void {
    const selected = NEWSLETTER_INTRO_DETAIL_OPTIONS.find(option => option.key === id);
    if (selected) {
      this.introDetail = selected.key;
      void this.draftNewsletterIntro();
    }
  }

  ensurePeriodEvents(): void {
    void this.startPeriodEvents();
  }

  async startPeriodEvents(): Promise<void> {
    await this.applyDefaultStartPeriodFromPreviousNewsletter();
    if (this.startUiOffered() && this.effectiveStartMode() === NewsletterStartMode.PERIOD && this.draftingOffered()) {
      if (this.events.selectedGroupEventCount() === 0 || !this.session.newsletterMode()) {
        await this.createNewsletter();
      }
    }
  }

  async applyDefaultStartPeriodFromPreviousNewsletter(): Promise<void> {
    if (!this.startPeriodFromPreviousApplied && this.startUiOffered()) {
      this.startPeriodFromPreviousApplied = true;
      const previous = this.compositionsService
        ? await this.compositionsService.previousNewsletter(this.session.currentDraftId)
        : null;
      const cadence = previous?.cadence;
      if (cadence && this.newsletterPeriodOptions.some(option => option.key === cadence)) {
        this.newsletterStartPeriod = cadence;
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
    if (this.walkLeaderRequest()) {
      this.ignoredPreviousNewsletter = true;
    }
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
    this.session.state.groupEvents = this.session.state.groupEvents.map(event => ({...event, selected: this.selectEventForDraft(event)}));
    this.events.addEventsFragment();
    this.applyNewsletterSubject();
    await this.refreshWalkChangeIntroEvents();
  }

  selectEventForDraft(event: GroupEventSummary): boolean {
    const isWalk = this.walkIsWalk(event);
    return this.walkLeaderRequest()
      ? walkNeedsLeader(event.programmeStatus, event.contactName, event.title, isWalk)
      : this.composerDrafting().onlyApprovedWalks
        ? walkIsMemberFacing(event.programmeStatus, isWalk, event.deleted)
        : !event.deleted;
  }

  newsletterSubject(): string {
    const cadence = this.session.state.newsletter?.cadence ?? this.newsletterStartPeriod;
    const period = newsletterPeriodPhrase(cadence, this.newsletterPeriodDescription());
    if (this.walkLeaderRequest()) {
      return period ? `Walk leaders needed for ${period}` : "Walk leaders needed";
    } else {
      const selected = this.events.selectedGroupEventsList();
      const hasWalks = selected.some(event => event.ramblersEventType !== RamblersEventType.GROUP_EVENT);
      const hasSocials = selected.some(event => event.ramblersEventType === RamblersEventType.GROUP_EVENT);
      return newsletterSubjectFromSelection(hasWalks, hasSocials, cadence, this.newsletterPeriodDescription());
    }
  }

  applyNewsletterSubject(): void {
    const next = this.newsletterSubject();
    const current = this.session.state.subject ?? "";
    const template = this.session.state.notificationConfig?.subject?.text ?? "";
    const period = this.newsletterPeriodDescription();
    const previousAuto = [
      this.lastAppliedNewsletterSubject,
      period ? `What's coming up: ${period}` : null
    ].filter((subject): subject is string => !!subject);
    if (next && subjectStillDefault(current, template, previousAuto)) {
      this.session.state.subject = next;
      this.lastAppliedNewsletterSubject = next;
    }
  }

  previousNewsletterExists(): boolean {
    return !!this.previousNewsletter || !!this.session.state.newsletter?.previousNewsletterId;
  }

  newsletterWindowTitle(): string {
    const previousSentAt = this.previousNewsletter?.sentAt ?? this.session.state.newsletter?.previousSentAt;
    const sentAt = previousSentAt ? this.dateUtils.displayDate(previousSentAt) : "an unrecorded date";
    return this.ignoredPreviousNewsletter
      ? "Including dates already covered"
      : this.previousNewsletterExists()
        ? `Last newsletter: ${sentAt}`
        : "First newsletter";
  }

  newEventsBrief(): string {
    const newCount = newEventCount(this.session.state.groupEvents);
    return !this.session.state.newsletter?.markNewEvents || newCount === 0
      ? ""
      : newCount === 1 ? " 1 new event." : ` ${newCount} new events.`;
  }

  newsletterWindowDescription(): string {
    const range = this.newsletterPeriodDescription() ?? "the dates on the Events step";
    return `Covering ${range}.${this.previousNewsletterExists() ? this.newEventsBrief() : ""}`;
  }

  async ignorePreviousNewsletter(): Promise<void> {
    this.ignoredPreviousNewsletter = true;
    this.previousNewsletter = null;
    await this.loadPreviousNewsletter();
    this.applyNewsletterWindow();
    await this.events.populateGroupEvents();
    this.session.state.groupEvents = this.session.state.groupEvents.map(event => ({...event, selected: this.selectEventForDraft(event)}));
    this.events.addEventsFragment();
    this.applyNewsletterSubject();
    await this.refreshWalkChangeIntroEvents();
    this.session.contentChanged.next();
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

  walkIsWalk(event: GroupEventSummary): boolean {
    return event.ramblersEventType === RamblersEventType.GROUP_WALK || event.ramblersEventType === RamblersEventType.WELLBEING_WALK;
  }

  awaitingDetails(event: GroupEventSummary): boolean {
    return walkNeedsLeader(event.programmeStatus, event.contactName, event.title, this.walkIsWalk(event));
  }

  newsletterIntroEvents(): NewsletterIntroEvent[] {
    return this.events.selectedGroupEventsList().map(event => {
      const start = this.dateUtils.asDateTime(event.eventDate);
      const hourFromDate = start?.isValid ? start.hour : null;
      const hourFromTime = event.eventTime?.trim() ? this.dateUtils.parseTime(event.eventTime).hours : null;
      const hour = hourFromDate ? hourFromDate : hourFromTime;
      const needsLeader = this.awaitingDetails(event);
      return {
        title: event.title,
        eventType: event.eventType?.description || "Event",
        dateDescription: this.dateUtils.displayDate(event.eventDate),
        weekday: start?.isValid ? start.toFormat(UIDateFormat.DAY_NAME) : undefined,
        timeOfDay: walkTimeOfDayFromHour(hour) ?? undefined,
        distance: event.distance || undefined,
        location: event.location || undefined,
        description: event.description || undefined,
        leaderName: needsLeader ? undefined : event.contactName?.trim() || undefined,
        newSinceLastNewsletter: this.session.state.newsletter?.markNewEvents ? event.newSinceLastNewsletter : undefined,
        awaitingDetails: needsLeader,
        approvedForMembers: walkIsMemberFacing(event.programmeStatus, this.walkIsWalk(event), event.deleted),
        cancelled: event.programmeStatus === ProgrammeOverviewStatus.CANCELLED,
        changes: event.id ? this.walkChangeIntroById?.get(event.id) : undefined
      };
    });
  }

  newsletterPeriodDescription(): string | undefined {
    const from = this.session.state.groupEventsFilter?.fromDate?.value;
    const to = this.session.state.groupEventsFilter?.toDate?.value;
    return from && to ? `${this.dateUtils.displayDate(from)} to ${this.dateUtils.displayDate(to)}` : undefined;
  }

  draftPurposeHint(): string {
    return this.draftPurposeOptions.find(option => option.key === this.currentDraftPurpose())?.hint ?? "";
  }

  walkChangeSinceMillis(): number {
    const previousSentAt = this.previousNewsletter?.sentAt ?? this.session.state.newsletter?.previousSentAt;
    return previousSentAt ? previousSentAt : this.dateUtils.dateTimeNow().minus({days: WALK_CHANGE_INTRO_LOOKBACK_DAYS}).toMillis();
  }

  async refreshWalkChangeIntroEvents(): Promise<void> {
    if (this.currentDraftPurpose() === NewsletterIntroPurpose.WALK_LEADER_REQUEST) {
      this.walkChangeIntroById = null;
    } else {
      const eventIds = this.events.selectedGroupEventsList().map(event => event.id).filter((id): id is string => !!id);
      if (!eventIds.length) {
        this.walkChangeIntroById = new Map();
      } else {
        try {
          const walks = await this.walksAndEventsService.queryByIds(eventIds, WALK_CHANGE_INTRO_SELECT);
          const sinceMillis = this.walkChangeSinceMillis();
          const fields = walkChangeFieldsFrom(this.composerDrafting());
          this.walkChangeIntroById = new Map(eventIds.map(eventId => {
            const walk = walks.get(eventId);
            const changes = walk
              ? this.groupEventService.highlightedChangesSince(walk, sinceMillis, fields)
                .map(change => ({field: change.field, label: change.label, from: change.from, to: change.to}))
              : [];
            return [eventId, changes];
          }));
        } catch (error) {
          this.logger.error("refreshWalkChangeIntroEvents failed", error);
          this.walkChangeIntroById = new Map();
        }
      }
    }
  }

  eventsForDraftPurpose(): NewsletterIntroEvent[] {
    return eventsMatchingDraftPurpose(
      this.newsletterIntroEvents(),
      this.currentDraftPurpose(),
      this.composerDrafting().onlyApprovedWalks
    );
  }

  emptyDraftPurposeCopy() {
    return purposeEmptyCopy({
      purpose: this.currentDraftPurpose(),
      selectedEventCount: this.events.selectedGroupEventCount(),
      carryingOnFromLastNewsletter: this.previousNewsletterExists()
    });
  }

  emptyDraftPurposeMessage(): string {
    return purposeEmptyMessage({
      purpose: this.currentDraftPurpose(),
      selectedEventCount: this.events.selectedGroupEventCount(),
      carryingOnFromLastNewsletter: this.previousNewsletterExists()
    });
  }

  async draftNewsletterIntro(): Promise<void> {
    if (this.currentDraftPurpose() !== NewsletterIntroPurpose.WALK_LEADER_REQUEST) {
      await this.refreshWalkChangeIntroEvents();
    }
    const events = this.eventsForDraftPurpose();
    if (events.length) {
      await this.requestDraftedIntro(events);
    } else {
      this.session.notify.warning({
        title: "Draft intro", message: this.emptyDraftPurposeMessage()
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
        purpose: this.currentDraftPurpose(),
        detail: this.walkLeaderRequest() ? NewsletterIntroDetail.STANDARD : this.introDetail
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
