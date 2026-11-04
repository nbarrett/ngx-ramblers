export interface MailClientTlsCredentials {
  accountKey: string;
  privateKey: string;
  certificate: string;
}

export interface MailClientTlsCertificate {
  _id: string;
  encryptedCredentials: string;
  expiresAt: number;
}

export interface MailClientTlsChallenge {
  _id: string;
  keyAuthorization: string;
  expiresAt: number;
}

export interface MailClientTlsLease {
  _id: string;
  owner: string;
  expiresAt: number;
}
