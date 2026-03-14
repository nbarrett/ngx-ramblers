import { Type } from "@angular/core";
import { Member } from "../../models/member.model";
import { AlertInstance } from "../../services/notifier.service";
import { NotificationDirective } from "../common/notification.directive";
import { ExpenseNotificationDetailsComponent } from "./templates/common/expense-notification-details.component";
import { NotificationConfig } from "../../models/mail.model";
import { ExpenseClaim, ExpenseClaimApiResponse, ExpenseEvent, ExpenseEventType, ExpenseItem, ExpenseType } from "../../models/expense-claim.model";

export type { ExpenseClaim, ExpenseClaimApiResponse, ExpenseEvent, ExpenseEventType, ExpenseItem, ExpenseType } from "../../models/expense-claim.model";

export interface ExpenseFilter {
  filter: (arg?: any) => boolean;
  description: string;
  disabled?: boolean;
}

export interface ExpenseNotificationRequest {
  expenseClaim: ExpenseClaim;
  notificationConfig: NotificationConfig;
  notify: AlertInstance;
  members: Member[];
  eventType: ExpenseEventType;
  notificationDirective: NotificationDirective;
  expenseClaimCreatedEvent?: ExpenseEvent;
  member?: Member;
  memberIds?: string[];
  component?: Type<ExpenseNotificationDetailsComponent>;
  notificationType?: string;
  notificationTypeSuffix?: string;
  memberFullName?: string;
  qualifiedSubject?: string;
  qualifiedSubjectAndMember?: string;
  destination?: string;
  reason?: string;
}

export interface ExpenseNotificationMapping {
  expenseEventType: ExpenseEventType;
  notifyCreator?: Type<ExpenseNotificationDetailsComponent>;
  notifyApprover?: Type<ExpenseNotificationDetailsComponent>;
  notifyTreasurer?: Type<ExpenseNotificationDetailsComponent>;
}
