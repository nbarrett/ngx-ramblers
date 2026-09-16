import debug from "debug";
import { isArray, isEqual, isPlainObject, isString, keys } from "es-toolkit/compat";
import { EnvironmentsConfig, EnvironmentsSecretFieldName } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { envConfig } from "../env-config/env-config";
import { enumValues } from "../../../projects/ngx-ramblers/src/app/functions/enums";
import { decryptJsonConfig, encryptJsonConfig } from "../shared/config-crypto";

const debugLog = debug(envConfig.logNamespace("environments-secrets-cipher"));
debugLog.enabled = true;

export const ENCRYPTED_VALUE_PREFIX = "enc:v1:";

export class EnvironmentsSecretsError extends Error {
}

const SECRET_FIELD_NAMES = new Set<string>(enumValues(EnvironmentsSecretFieldName));
const SECRETS_MAP_FIELD = "secrets";

function encryptionKey(): string {
  return process.env[Environment.ENVIRONMENTS_ENCRYPTION_KEY] || "";
}

export function environmentsEncryptionConfigured(): boolean {
  return !!encryptionKey();
}

export function isEncryptedValue(value: unknown): boolean {
  return isString(value) && value.startsWith(ENCRYPTED_VALUE_PREFIX);
}

function mapSecretStrings(node: any, withinSecrets: boolean, transform: (value: string) => string): any {
  if (isArray(node)) {
    return node.map(item => mapSecretStrings(item, withinSecrets, transform));
  } else if (isPlainObject(node)) {
    return keys(node).reduce((result, key) => {
      const value = (node as Record<string, any>)[key];
      const secret = withinSecrets || SECRET_FIELD_NAMES.has(key) || key === SECRETS_MAP_FIELD;
      if (isString(value)) {
        result[key] = secret ? transform(value) : value;
      } else {
        result[key] = mapSecretStrings(value, secret, transform);
      }
      return result;
    }, {} as Record<string, any>);
  } else {
    return node;
  }
}

function encryptValue(plain: string, key: string): string {
  return ENCRYPTED_VALUE_PREFIX + encryptJsonConfig(plain, key);
}

function decryptValue(stored: string, key: string): string {
  try {
    return decryptJsonConfig<string>(stored.slice(ENCRYPTED_VALUE_PREFIX.length), key);
  } catch {
    throw new EnvironmentsSecretsError(`Could not decrypt a config.environments secret: check ${Environment.ENVIRONMENTS_ENCRYPTION_KEY} is the key that encrypted it`);
  }
}

function verifiedRoundTrip<T extends EnvironmentsConfig>(original: T, encrypted: T): T {
  if (isEqual(decryptEnvironmentsSecrets(encrypted), decryptEnvironmentsSecrets(original))) {
    return encrypted;
  } else {
    throw new EnvironmentsSecretsError("Refusing to store config.environments: decrypting the encrypted document did not reproduce the original");
  }
}

export function encryptEnvironmentsSecrets<T extends EnvironmentsConfig>(value: T): T {
  const key = encryptionKey();
  if (!key) {
    debugLog(`${Environment.ENVIRONMENTS_ENCRYPTION_KEY} is not set: storing environment secrets unencrypted`);
    return value;
  } else {
    return verifiedRoundTrip(value, mapSecretStrings(value, false, plain => plain && !isEncryptedValue(plain) ? encryptValue(plain, key) : plain));
  }
}

export function decryptEnvironmentsSecrets<T extends EnvironmentsConfig>(value: T): T {
  const key = encryptionKey();
  return mapSecretStrings(value, false, stored => {
    if (!isEncryptedValue(stored)) {
      return stored;
    } else if (!key) {
      throw new EnvironmentsSecretsError(`config.environments contains encrypted secrets but ${Environment.ENVIRONMENTS_ENCRYPTION_KEY} is not set`);
    } else {
      return decryptValue(stored, key);
    }
  });
}

export function containsUnencryptedSecrets(value: EnvironmentsConfig): boolean {
  const found = {unencrypted: false};
  mapSecretStrings(value, false, stored => {
    if (stored && !isEncryptedValue(stored)) {
      found.unencrypted = true;
    }
    return stored;
  });
  return found.unencrypted;
}
