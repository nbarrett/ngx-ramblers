import { Command } from "commander";
import mongoose from "mongoose";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { decryptStoredEnvironmentsSecrets } from "../../environments/environments-config";
import { environmentsEncryptionConfigured } from "../../environments/environments-secrets-cipher";
import { error as logError, log } from "../cli-logger";

export function createEnvironmentsDecryptCommand(): Command {
  return new Command("environments-decrypt")
    .description(`Store the platform environments document with its secrets unencrypted again, using ${Environment.ENVIRONMENTS_ENCRYPTION_KEY}. Remove the key from the platform site first, or it encrypts the document again when it next starts`)
    .option("--confirm", "required: write the unencrypted document")
    .action(async (options: {confirm?: boolean}) => {
      try {
        if (!options.confirm) {
          throw new Error("add --confirm to write the environments document with its secrets unencrypted");
        } else if (!environmentsEncryptionConfigured()) {
          throw new Error(`${Environment.ENVIRONMENTS_ENCRYPTION_KEY} is not set, so the stored secrets cannot be decrypted`);
        } else {
          await decryptStoredEnvironmentsSecrets();
          log("The environments document is stored with its secrets unencrypted");
        }
      } catch (error) {
        logError(error.message);
        process.exitCode = 1;
      } finally {
        await mongoose.connection.close();
      }
    });
}
