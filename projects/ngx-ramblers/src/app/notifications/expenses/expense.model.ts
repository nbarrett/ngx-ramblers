import { Type } from "@angular/core";
import { ApiResponse } from "../../models/api-response.model";
import { Member } from "../../models/member.model";
import { AlertInstance } from "../../services/notifier.service";
import { ExpenseNotificationDirective } from "./expense-notification.directive";
import { ExpenseNotificationDetailsComponent } from "./templates/common/expense-notification-details.component";

export interface ExpenseFilter {
  filter: (arg?: any) => boolean;
  description: string;
  disabled?: boolean;
}

export interface ExpenseClaim {
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    sortCode?: string;
  };
  id?: string;
  expenseEvents: ExpenseEvent[];
  expenseItems: ExpenseItem[];
  cost: number;
}

export interface ExpenseType {
  value: string;
  name: string;
  travel?: boolean;
}

export interface ExpenseItem {
  cost: number;
  description?: string;
  expenseType: ExpenseType;
  expenseDate: number;
  travel?: {
    costPerMile: number;
    miles: number;
    from?: string;
    to?: string;
    returnJourney: boolean
  };
  receipt?: {
    awsFileName?: string;
    originalFileName?: string;
    title: string;
  };
}

export interface ExpenseNotificationRequest {
  expenseClaim: ExpenseClaim;
  notify: AlertInstance;
  members: Member[];
  eventType: ExpenseEventType;
  notificationDirective: ExpenseNotificationDirective;
  expenseClaimCreatedEvent?: ExpenseEvent;
  member?: Member;
  memberIds?: string[];
  component?: Type<ExpenseNotificationDetailsComponent>;
  segmentType?: string;
  segmentNameSuffix?: string;
  memberFullName?: string;
  campaignName?: string;
  campaignNameAndMember?: string;
  segmentName?: string;
  destination?: string;
  reason?: string;
}

export interface ExpenseEventType {
  description?: string;
  atEndpoint?: boolean;
  actionable?: boolean;
  editable?: boolean;
  returned?: boolean;
  notifyCreator?: boolean;
  notifyApprover?: boolean;
  notifyTreasurer?: boolean;
}

export interface ExpenseEvent {
  reason?: string;
  eventType?: ExpenseEventType;
  date?: number;
  memberId?: string;
}

export interface ExpenseClaimApiResponse extends ApiResponse {
  request: any;
  response?: ExpenseClaim | ExpenseClaim[];
}

export interface ExpenseNotificationMapping {
  expenseEventType: ExpenseEventType;
  notifyCreator?: any;
  notifyApprover?: any;
  notifyTreasurer?: any;
}
