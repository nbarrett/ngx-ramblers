export interface AdminAlertRecipient {
  email: string;
  name: string;
}

export interface AdminAlertsConfiguration {
  recipients: AdminAlertRecipient[];
}
