import { ApiResponse } from "./api-response.model";

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

export enum ExpenseEventTypeDescription {
  CREATED = "Created",
  SUBMITTED = "Submitted",
  FIRST_APPROVAL = "First Approval",
  SECOND_APPROVAL = "Second Approval",
  RETURNED = "Returned",
  PAID = "Paid"
}

export enum ExpenseEventDisplayDescription {
  CREATED = "Created",
  SUBMITTED = "Submitted",
  FIRST_APPROVAL = "First Approval: payment created in Unity",
  SECOND_APPROVAL = "Second Approval: authorised in Unity",
  RETURNED = "Returned",
  PAID = "Paid: authorised in Unity"
}

export enum ExpenseStageActionLabel {
  PAYMENT_CREATED_IN_UNITY = "Payment created in Unity",
  AUTHORISED_IN_UNITY = "Authorised in Unity"
}

export enum UnityBankUrl {
  NEW_PAYMENT = "https://online.unity.co.uk/payments/newpayment",
  AWAITING_AUTHORISATION = "https://online.unity.co.uk/awaiting-authorisation"
}

export enum UnityExpenseGuidanceMode {
  OVERVIEW = "overview",
  CREATE_PAYMENT = "create-payment",
  AUTHORISE = "authorise"
}

export enum ExpenseItemTableColumn {
  COST = "cost",
  DATE = "date",
  DESCRIPTION = "description"
}

export enum ExpenseEventTableColumn {
  DATE = "date",
  DESCRIPTION = "description",
  WHO = "who"
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

export function expenseEventDisplayDescription(description?: string): string {
  if (description === ExpenseEventTypeDescription.FIRST_APPROVAL) {
    return ExpenseEventDisplayDescription.FIRST_APPROVAL;
  } else if (description === ExpenseEventTypeDescription.SECOND_APPROVAL) {
    return ExpenseEventDisplayDescription.SECOND_APPROVAL;
  } else if (description === ExpenseEventTypeDescription.PAID) {
    return ExpenseEventDisplayDescription.PAID;
  } else if (description) {
    return description;
  } else {
    return "";
  }
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
