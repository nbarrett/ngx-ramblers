import { inject, Injectable, Type } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { WalkEventNotificationMapping, WalkEventType } from "../../models/walk-event-type.model";
import { WalkMailMessageConfiguration, WalkNotification } from "../../models/walk-notification.model";
import { DisplayedWalk, EventType } from "../../models/walk.model";
import { MarkdownService } from "ngx-markdown";
import {
  WalkNotificationDetailsComponent
} from "../../notifications/walks/templates/common/walk-notification-details.component";
import {
  WalkNotificationCoordinatorApprovedComponent
} from "../../notifications/walks/templates/coordinator/walk-notification-coordinator-approved.component";
import {
  WalkNotificationCoordinatorAwaitingApprovalComponent
} from "../../notifications/walks/templates/coordinator/walk-notification-coordinator-awaiting-approval.component";
import {
  WalkNotificationCoordinatorAwaitingWalkDetailsComponent
} from "../../notifications/walks/templates/coordinator/walk-notification-coordinator-awaiting-walk-details.component";
import {
  WalkNotificationCoordinatorDeletedComponent
} from "../../notifications/walks/templates/coordinator/walk-notification-coordinator-deleted.component";
import {
  WalkNotificationCoordinatorRequestedComponent
} from "../../notifications/walks/templates/coordinator/walk-notification-coordinator-requested.component";
import {
  WalkNotificationCoordinatorUpdatedComponent
} from "../../notifications/walks/templates/coordinator/walk-notification-coordinator-updated.component";
import {
  WalkNotificationLeaderApprovedComponent
} from "../../notifications/walks/templates/leader/walk-notification-leader-approved.component";
import {
  WalkNotificationLeaderAwaitingApprovalComponent
} from "../../notifications/walks/templates/leader/walk-notification-leader-awaiting-approval.component";
import {
  WalkNotificationLeaderAwaitingWalkDetailsComponent
} from "../../notifications/walks/templates/leader/walk-notification-leader-awaiting-walk-details.component";
import {
  WalkNotificationLeaderRequestedComponent
} from "../../notifications/walks/templates/leader/walk-notification-leader-requested.component";
import {
  WalkNotificationLeaderUpdatedComponent
} from "../../notifications/walks/templates/leader/walk-notification-leader-updated.component";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberService } from "../member/member.service";
import { AlertInstance } from "../notifier.service";
import { RamblersWalksAndEventsService } from "../walks-and-events/ramblers-walks-and-events.service";
import { GroupEventService } from "../walks-and-events/group-event.service";
import { WalksReferenceService } from "./walks-reference-data.service";
import { WalksAndEventsService } from "../walks-and-events/walks-and-events.service";
import { NotificationComponent } from "../../notifications/common/notification.component";
import { NotificationDirective } from "../../notifications/common/notification.directive";
import { MailMessagingService } from "../mail/mail-messaging.service";
import { MailMessagingConfig, NotificationConfig } from "../../models/mail.model";
import { MailService } from "../mail/mail.service";

@Injectable({
  providedIn: "root"
})

export class WalkNotificationService {
  private ramblersWalksAndEventsService: RamblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private mailMessagingService: MailMessagingService = inject(MailMessagingService);
  private mailMessagingConfig: MailMessagingConfig;
  private mailService: MailService = inject(MailService);
  protected memberService: MemberService = inject(MemberService);
  private display: WalkDisplayService = inject(WalkDisplayService);
  private walkEventService: GroupEventService = inject(GroupEventService);
  private walksReferenceService: WalksReferenceService = inject(WalksReferenceService);
  private walksAndEventsService: WalksAndEventsService = inject(WalksAndEventsService);
  private fullNameWithAliasPipe: FullNameWithAliasPipe = inject(FullNameWithAliasPipe);
  private displayDatePipe: DisplayDatePipe = inject(DisplayDatePipe);
  private markdownService: MarkdownService = inject(MarkdownService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkNotificationService", NgxLoggerLevel.ERROR);

  constructor() {
    this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
    });
  }

  public async createEventAndSendNotifications(notify: AlertInstance, members: Member[], notificationDirective: NotificationDirective,
                                               displayedWalk: DisplayedWalk, sendNotification: boolean, reason?: string): Promise<boolean> {
    notify.setBusy();
    const event = this.walkEventService.createEventIfRequired(displayedWalk.walk, displayedWalk.status, reason);
    if (event && sendNotification) {
      const notificationConfig = this.mailMessagingService.queryNotificationConfig(notify, this.mailMessagingConfig, "walkNotificationConfigId");
        const walkEventType = this.walksReferenceService.toWalkEventType(event.eventType);
        this.logger.info("walkEventType", walkEventType, "from event:", event);
        this.walkEventService.writeEventIfRequired(displayedWalk.walk, event);
        displayedWalk.walk = await this.walksAndEventsService.createOrUpdate(displayedWalk.walk);
        this.display.refreshDisplayedWalk(displayedWalk);
        await this.sendNotificationsToAllRoles(notificationConfig, members, notificationDirective, displayedWalk, walkEventType, notify);
        return true;
    } else {
      this.logger.info("Not sending notification sendNotification:", sendNotification, "event:", event);
      await Promise.resolve(this.walkEventService.writeEventIfRequired(displayedWalk.walk, event));
      return false;
    }
  }

  private walkEventNotificationMappingsFor(eventType: EventType) {
    const mappings: WalkEventNotificationMapping[] = [
      {
        eventType: EventType.AWAITING_WALK_DETAILS,
        notifyLeader: WalkNotificationLeaderAwaitingWalkDetailsComponent,
        notifyCoordinator: WalkNotificationCoordinatorAwaitingWalkDetailsComponent
      },
      {
        eventType: EventType.WALK_DETAILS_REQUESTED,
        notifyLeader: WalkNotificationLeaderRequestedComponent,
        notifyCoordinator: WalkNotificationCoordinatorRequestedComponent
      }, {
        eventType: EventType.WALK_DETAILS_UPDATED,
        notifyLeader: WalkNotificationLeaderUpdatedComponent,
        notifyCoordinator: WalkNotificationCoordinatorUpdatedComponent
      }, {
        eventType: EventType.AWAITING_APPROVAL,
        notifyLeader: WalkNotificationLeaderAwaitingApprovalComponent,
        notifyCoordinator: WalkNotificationCoordinatorAwaitingApprovalComponent
      }, {
        eventType: EventType.APPROVED,
        notifyLeader: WalkNotificationLeaderApprovedComponent,
        notifyCoordinator: WalkNotificationCoordinatorApprovedComponent
      }, {
        eventType: EventType.DELETED,
        notifyLeader: WalkNotificationCoordinatorDeletedComponent,
        notifyCoordinator: WalkNotificationCoordinatorDeletedComponent
      }];
    return mappings.find(mapping => mapping.eventType === eventType);
  }

  public toWalkNotification(displayedWalk: DisplayedWalk, members: Member[], reason?: string): WalkNotification {
    const data = {
      walk: displayedWalk.walk,
      status: displayedWalk.status,
      event: this.walkEventService.latestEvent(displayedWalk.walk),
      walkDataAudit: this.walkEventService.walkDataAuditFor(displayedWalk.walk, displayedWalk.status, false),
      validationMessages: this.ramblersWalksAndEventsService.toWalkExport({
        localWalk: displayedWalk.walk,
        ramblersWalk: null
      }).validationMessages,
      reason
    };
    this.logger.info("toWalkNotification ->", data);
    return data;
  }

  public generateNotificationHTML(walkNotification: WalkNotification, notificationDirective: NotificationDirective, component: Type<WalkNotificationDetailsComponent>): Promise<string> {
    const componentAndData = new NotificationComponent<WalkNotificationDetailsComponent>(component);
    const viewContainerRef = notificationDirective.viewContainerRef;
    viewContainerRef.clear();
    const componentRef = viewContainerRef.createComponent(componentAndData.component);
    componentRef.instance.data = walkNotification;
    componentRef.changeDetectorRef.detectChanges();
    const html = componentRef.location.nativeElement.innerHTML;
    this.logger.info("notification html ->", html);
    return Promise.resolve(html);
  }

  public async generateNotificationHTMLWithMarkdownRendering(walkNotification: WalkNotification, notificationDirective: NotificationDirective, component: Type<WalkNotificationDetailsComponent>): Promise<string> {
    const componentAndData = new NotificationComponent<WalkNotificationDetailsComponent>(component);
    const viewContainerRef = notificationDirective.viewContainerRef;
    const componentType: Type<WalkNotificationDetailsComponent> = componentAndData.component;
    viewContainerRef.clear();
    const componentRef = viewContainerRef.createComponent(componentType);
    componentRef.instance.data = walkNotification;
    componentRef.changeDetectorRef.detectChanges();
    const html = componentRef.location.nativeElement.innerHTML;
    this.logger.info("notification html ->", html);
    const markdownHtml = await this.markdownService.parse(html);
    this.logger.info("markdownHtml html ->", markdownHtml);
    return markdownHtml;
  }

  private async sendNotificationsToAllRoles(notificationConfig: NotificationConfig, members: Member[], notificationDirective: NotificationDirective, displayedWalk: DisplayedWalk, walkEventType: WalkEventType, notify: AlertInstance): Promise<void> {
    const walkNotification: WalkNotification = this.toWalkNotification(displayedWalk, members);
    const walkLeaderMember = await this.memberService.getById(displayedWalk.walk?.fields?.contactDetails?.memberId);
    this.logger.info("sendNotification:", "memberId", displayedWalk.walk?.fields?.contactDetails?.memberId, "member", walkLeaderMember);
    const walkLeaderName = this.fullNameWithAliasPipe.transform(walkLeaderMember);
    const walkDate = this.displayDatePipe.transform(displayedWalk.walk?.groupEvent?.start_date_time);
    await this.sendLeaderNotifications(notificationConfig, notify, notificationDirective, walkNotification, walkEventType, walkDate);
    return await this.sendCoordinatorNotifications(notificationConfig, notify, walkLeaderMember, members, notificationDirective, walkNotification, walkEventType, walkLeaderName, walkDate);
  }

  private async sendLeaderNotifications(notificationConfig: NotificationConfig, notify: AlertInstance,
                                  notificationDirective: NotificationDirective, walkNotification: WalkNotification, walkEventType: WalkEventType, walkDate: string): Promise<any> {
    if (walkEventType.notifyLeader) {
      const notificationText = await this.generateNotificationHTML(walkNotification, notificationDirective, this.walkEventNotificationMappingsFor(walkEventType.eventType).notifyLeader);
      return this.sendNotificationsTo({
        notificationDirective,
        notify,
        walkEventType,
        notificationConfig,
        memberIds: [walkNotification.walk?.fields?.contactDetails?.memberId],
        notificationText,
        emailSubject: `Your walk on ${walkDate}`,
        destination: "walk leader"
      });
    }
    this.logger.info("not sending leader notification");
  }

  private async sendCoordinatorNotifications(notificationConfig: NotificationConfig, notify: AlertInstance, member: Member, members: Member[],
                                       notificationDirective: NotificationDirective, displayedWalk: WalkNotification, walkEventType: WalkEventType, walkLeaderName: string, walkDate: string): Promise<any> {
    if (walkEventType.notifyCoordinator) {
      const notificationText = await this.generateNotificationHTML(displayedWalk, notificationDirective, this.walkEventNotificationMappingsFor(walkEventType.eventType).notifyCoordinator);
      const walkChangeNotificationMemberIds = this.memberService.allMemberIdsWithPrivilege("walkChangeNotifications", members);
      if (walkChangeNotificationMemberIds.length > 0) {
        return this.sendNotificationsTo({
          notificationDirective,
          notify,
          walkEventType,
          notificationConfig,
          memberIds: walkChangeNotificationMemberIds,
          notificationText,
          emailSubject: `${walkLeaderName}'s walk on ${walkDate}`,
          destination: "walk co-ordinators"
        });
      } else {
        this.logger.info("not sending coordinator notifications as none are configured with walkChangeNotifications");
      }
    } else {
      this.logger.info("not sending coordinator notifications as event type is", walkEventType.eventType);
    }
  }

  private async sendNotificationsTo(walkMailMessageConfiguration: WalkMailMessageConfiguration) {
    const {walkEventType, notify, notificationDirective} = walkMailMessageConfiguration;
    if (walkMailMessageConfiguration.memberIds.length === 0) {
      this.logger.info(`No members have been configured as ${walkMailMessageConfiguration.destination}`);
    } else {
      const qualifiedSubject = `${walkMailMessageConfiguration.emailSubject} (${walkEventType.description})`;
      const members: Member[] = await Promise.all(walkMailMessageConfiguration.memberIds.map(memberId => this.memberService.getById(memberId)));
      const responses = await Promise.all(members.map(member => this.sendEmailMessage(notificationDirective, notify, member, qualifiedSubject, walkMailMessageConfiguration)));
      this.logger.info("sendNotificationsTo:", walkMailMessageConfiguration, "responses:", responses);
      return this.notifyEmailSendComplete(notify, qualifiedSubject);
    }
  }

  private sendEmailMessage(notificationDirective: NotificationDirective, notify: AlertInstance, member: Member, qualifiedSubject: string, walkMailMessageConfiguration: WalkMailMessageConfiguration): Promise<void> {
    notify.progress({title: "Sending Notifications", message: `Sending ${qualifiedSubject}`});
    return this.mailService.sendTransactionalMessage(this.mailMessagingService.createEmailRequest({
      member,
      notificationConfig: walkMailMessageConfiguration.notificationConfig,
      notificationDirective,
      bodyContent: walkMailMessageConfiguration.notificationText,
      emailSubject: qualifiedSubject
    })).then(() => {
        notify.progress({
          title: "Sending Notifications", message: `Sending of ${qualifiedSubject} was successful`
        }, true);
      });
  }

  private notifyEmailSendComplete(notify: AlertInstance, qualifiedSubject: string) {
    notify.success({
      title: "Sending Notifications",
      message: `Sending of ${qualifiedSubject} was successful. Check your inbox for details.`
    });
    return true;
  }

}
