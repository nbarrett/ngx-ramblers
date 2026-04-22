import { CloudflareForwardEnv, ForwardableEmailMessage } from "./types";

declare const __RECIPIENTS__: string[];

export default {
  async email(message: ForwardableEmailMessage, _env: CloudflareForwardEnv, _ctx: unknown): Promise<void> {
    const destinations: string[] = __RECIPIENTS__;
    for (const dest of destinations) {
      try {
        await message.forward(dest);
      } catch (error) {
        console.error("Failed to forward to " + dest + ":", (error as Error).message || error);
      }
    }
  }
};
