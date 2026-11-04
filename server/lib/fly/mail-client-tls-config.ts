import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

export function nativeMailTlsConfiguration(configuration: string): string {
  return configuration.split("[[services]]").map((section, index) => index > 0 && /\bport\s*=\s*(465|993)\b/.test(section)
    ? section.replace(/handlers\s*=\s*\["tls"\]/g, "handlers = []")
    : section).join("[[services]]");
}

export async function withMailClientTlsConfiguration(source: string, enabled: boolean, deploy: (configurationPath: string) => Promise<void>): Promise<void> {
  if (enabled) {
    const temporary = path.join(os.tmpdir(), `mail-client-tls-${randomUUID()}.toml`);
    try {
      fs.writeFileSync(temporary, nativeMailTlsConfiguration(fs.readFileSync(source, "utf8")));
      await deploy(temporary);
    } finally {
      if (fs.existsSync(temporary)) {
        fs.unlinkSync(temporary);
      }
    }
  } else {
    await deploy(source);
  }
}
