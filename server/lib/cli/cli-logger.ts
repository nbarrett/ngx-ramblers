import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cli"));
export function log(message: string, ...args: any[]): void {
  if (args.length > 0) {
    console.log(message.replace(/%[sd]/g, () => String(args.shift())));
  } else {
    console.log(message);
  }
}

export function error(message: string, ...args: any[]): void {
  if (args.length > 0) {
    console.error(message.replace(/%[sd]/g, () => String(args.shift())));
  } else {
    console.error(message);
  }
}

export function debug_(message: string, ...args: any[]): void {
  debugLog(message, ...args);
}

export const cliLogger = {
  log,
  error,
  debug: debug_
};
