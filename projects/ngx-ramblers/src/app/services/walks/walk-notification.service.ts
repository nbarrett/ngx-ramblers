import { inject, Injectable, Type } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { WalkEventNotificationMapping, WalkEventType } from "../../models/walk-event-type.model";
import { WalkMailMessageConfiguration, WalkNotification } from "../../models/walk-notification.model";
import { DisplayedWalk, EventType } from "../../models/walk.model";
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
import { RamblersWalksAndEventsService } from "./ramblers-walks-and-events.service";
import { WalkEventService } from "./walk-event.service";
import { WalksReferenceService } from "./walks-reference-data.service";
import { WalksService } from "./walks.service";
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
  private walkEventService: WalkEventService = inject(WalkEventService);
  private walksReferenceService: WalksReferenceService = inject(WalksReferenceService);
  private walksService: WalksService = inject(WalksService);
  private fullNameWithAliasPipe: FullNameWithAliasPipe = inject(FullNameWithAliasPipe);
  private displayDatePipe: DisplayDatePipe = inject(DisplayDatePipe);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkNotificationService", NgxLoggerLevel.OFF);

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
        displayedWalk.walk = await this.walksService.createOrUpdate(displayedWalk.walk);
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
      validationMessages: this.ramblersWalksAndEventsService.validateWalk(displayedWalk.walk).validationMessages,
      reason
    };
    this.logger.info("toWalkNotification ->", data);
    return data;
  }

  public generateNotificationHTML(walkNotification: WalkNotification, notificationDirective: NotificationDirective, component: Type<WalkNotificationDetailsComponent>): string {
    const componentAndData = new NotificationComponent<WalkNotificationDetailsComponent>(component);
    const viewContainerRef = notificationDirective.viewContainerRef;
    viewContainerRef.clear();
    const componentRef = viewContainerRef.createComponent(componentAndData.component);
    componentRef.instance.data = walkNotification;
    componentRef.changeDetectorRef.detectChanges();
    const html = componentRef.location.nativeElement.innerHTML;
    this.logger.info("notification html ->", html);
    return html;
  }

  private async sendNotificationsToAllRoles(notificationConfig: NotificationConfig, members: Member[], notificationDirective: NotificationDirective, displayedWalk: DisplayedWalk, walkEventType: WalkEventType, notify: AlertInstance): Promise<void> {
    const walkNotification: WalkNotification = this.toWalkNotification(displayedWalk, members);
    const member = await this.memberService.getById(displayedWalk.walk.walkLeaderMemberId);
    this.logger.info("sendNotification:", "memberId", displayedWalk.walk.walkLeaderMemberId, "member", member);
    const walkLeaderName = this.fullNameWithAliasPipe.transform(member);
    const walkDate = this.displayDatePipe.transform(displayedWalk.walk.walkDate);
    await this.sendLeaderNotifications(notificationConfig, notify, member, notificationDirective, walkNotification, walkEventType, walkDate);
    return await this.sendCoordinatorNotifications(notificationConfig, notify, member, members, notificationDirective, walkNotification, walkEventType, walkLeaderName, walkDate);
  }

  private sendLeaderNotifications(notificationConfig: NotificationConfig, notify: AlertInstance, member: Member,
                                  notificationDirective: NotificationDirective, walkNotification: WalkNotification, walkEventType: WalkEventType, walkDate: string): Promise<any> {
    if (walkEventType.notifyLeader) {
      const leaderHTML = this.generateNotificationHTML(walkNotification, notificationDirective, this.walkEventNotificationMappingsFor(walkEventType.eventType).notifyLeader);
      return this.sendNotificationsTo({
        notificationDirective,
        notify,
        member,
        walkEventType,
        notificationConfig,
        memberIds: [walkNotification.walk.walkLeaderMemberId],
        notificationText: leaderHTML,
        emailSubject: "Your walk on " + walkDate,
        destination: "walk leader"
      });
    }
    this.logger.info("not sending leader notification");
  }

  private sendCoordinatorNotifications(notificationConfig: NotificationConfig, notify: AlertInstance, member: Member, members: Member[],
                                       notificationDirective: NotificationDirective, displayedWalk: WalkNotification, walkEventType: WalkEventType, walkLeaderName: string, walkDate: string): Promise<any> {
    if (walkEventType.notifyCoordinator) {
      const coordinatorHTML = this.generateNotificationHTML(displayedWalk, notificationDirective, this.walkEventNotificationMappingsFor(walkEventType.eventType).notifyCoordinator);
      const memberIds = this.memberService.allMemberIdsWithPrivilege("walkChangeNotifications", members);
      if (memberIds.length > 0) {
        return this.sendNotificationsTo({
          notificationDirective,
          notify,
          member,
          walkEventType,
          notificationConfig,
          memberIds,
          notificationText: coordinatorHTML,
          emailSubject: walkLeaderName + "'s walk on " + walkDate,
          destination: "walk co-ordinators"
        });
      } else {
        this.logger.info("not sending coordinator notifications as none are configured with walkChangeNotifications");
      }
    } else {
      this.logger.info("not sending coordinator notifications as event type is", walkEventType.eventType);
    }
  }

  private sendNotificationsTo(walkMailMessageConfiguration: WalkMailMessageConfiguration) {
    const {member, walkEventType, notify, notificationDirective} = walkMailMessageConfiguration;
    if (walkMailMessageConfiguration.memberIds.length === 0) {
      return Promise.reject("No members have been configured as " + walkMailMessageConfiguration.destination
        + " therefore notifications cannot be sent");
    }
    this.logger.info("sendNotificationsTo:", walkMailMessageConfiguration);
    const qualifiedSubject = walkMailMessageConfiguration.emailSubject + " (" + walkEventType.description + ")";
    return this.sendEmailMessage(notificationDirective, notify, member, qualifiedSubject, walkMailMessageConfiguration)
      .then(() => this.notifyEmailSendComplete(notify, qualifiedSubject));
  }

  private sendEmailMessage(notificationDirective: NotificationDirective, notify: AlertInstance, member: Member, qualifiedSubject: string, walkMailMessageConfiguration: WalkMailMessageConfiguration): Promise<void> {
    notify.progress({
      title: "Sending Notifications", message: "Sending " + qualifiedSubject
    });
    return this.mailService.sendTransactionalMessage(this.mailMessagingService.createEmailRequest({
      member,
      notificationConfig: walkMailMessageConfiguration.notificationConfig,
      notificationDirective,
      bodyContent: walkMailMessageConfiguration.notificationText,
      emailSubject: qualifiedSubject
    })).then(() => {
        notify.progress({
          title: "Sending Notifications", message: "Sending of " + qualifiedSubject + " was successful"
        }, true);
      });
  }

  private notifyEmailSendComplete(notify: AlertInstance, qualifiedSubject: string) {
    notify.success({
      title: "Sending Notifications",
      message: "Sending of " + qualifiedSubject + " was successful. Check your inbox for details."
    });
    return true;
  }

}
