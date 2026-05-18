import { ApiResponse } from "./api-response.model";

export interface MemberEmailSend {
  id?: string;
  memberId: string;
  email?: string;
  notificationConfigId?: string;
  subject?: string;
  jobId?: string;
  sentAt: number;
  sentBy?: string;
}

export interface MemberEmailSendsApiResponse extends ApiResponse {
  response: MemberEmailSend[];
}
