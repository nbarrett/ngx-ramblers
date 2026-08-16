import { ExportedGpxSummary } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";

const lastExport: {value: ExportedGpxSummary | null} = {value: null};

export function rememberExportedGpx(summary: ExportedGpxSummary): void {
  lastExport.value = summary;
}

export function lastExportedGpx(): ExportedGpxSummary {
  if (!lastExport.value) {
    throw new Error("No OS Maps GPX export has been captured yet");
  } else {
    return lastExport.value;
  }
}

export function clearExportedGpx(): void {
  lastExport.value = null;
}
