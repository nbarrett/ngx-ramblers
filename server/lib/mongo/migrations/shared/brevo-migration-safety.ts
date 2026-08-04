import { MigrationUpResult } from "../../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";

export function brevoMigrationSkipReason(message: string): string {
  return `Brevo-related work skipped: ${message}`;
}

export async function withBrevoMigrationSafety(
  label: string,
  action: () => Promise<MigrationUpResult | void>,
  log: (message: string) => void = () => {}
): Promise<MigrationUpResult | void> {
  try {
    return (await action()) || {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = brevoMigrationSkipReason(`${label}: ${message}`);
    log(reason);
    return {skipped: true, reason};
  }
}
