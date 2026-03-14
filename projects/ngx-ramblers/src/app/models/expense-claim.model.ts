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
