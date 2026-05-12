export interface ExternalRecipient {
  id?: string;
  email: string;
  name?: string;
  createdBy: string;
  createdAt: number;
  lastUsedAt?: number;
  lastUsedBy?: string;
}

export interface CreateExternalRecipientRequest {
  email: string;
  name?: string;
}
