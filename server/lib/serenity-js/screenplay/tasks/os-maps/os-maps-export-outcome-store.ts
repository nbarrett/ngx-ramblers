import { OsMapsExportClickOutcome } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";

const pendingOutcome = {current: null as OsMapsExportClickOutcome | null};

export function rememberOsMapsExportOutcome(outcome: OsMapsExportClickOutcome): void {
  pendingOutcome.current = outcome;
}

export function osMapsExportOutcome(): OsMapsExportClickOutcome {
  if (!pendingOutcome.current) {
    throw new Error("No OS Maps export click outcome has been recorded yet");
  } else {
    return pendingOutcome.current;
  }
}

export function clearOsMapsExportOutcome(): void {
  pendingOutcome.current = null;
}
