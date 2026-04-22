export interface ForwardableEmailMessage {
  raw: ReadableStream<Uint8Array>;
  from: string;
  to: string;
  headers: Headers;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

export interface BrevoResendEnv {
  NGX_INBOUND_SECRET: string;
}

export type CloudflareForwardEnv = Record<string, never>;
