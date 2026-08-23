const REDACTED = "REDACTED";
const CREDENTIAL_PARAMS = ["api_key"];

const credentialParamPattern = new RegExp(`([?&](?:${CREDENTIAL_PARAMS.join("|")})=)[^&#\\s"']+`, "gi");

export function redactCredentials(value: string): string {
  return value.replace(credentialParamPattern, `$1${REDACTED}`);
}
