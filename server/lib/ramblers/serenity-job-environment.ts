import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { RamblersUploadCredentials } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { SerenityFeature } from "../../../projects/ngx-ramblers/src/app/models/serenity-feature.model";

export function isOsMapsExportJob(job: RamblersUploadJob): boolean {
  return job.data.feature === SerenityFeature.OS_MAPS_EXPORT;
}

export function isOsMapsListJob(job: RamblersUploadJob): boolean {
  return job.data.feature === SerenityFeature.OS_MAPS_LIST;
}

export function isOsMapsWorkerJob(job: RamblersUploadJob): boolean {
  return isOsMapsExportJob(job) || isOsMapsListJob(job);
}

export function applyOsMapsExportEnvironment(job: RamblersUploadJob, credentials: RamblersUploadCredentials, jobPath: string): void {
  process.env[Environment.RAMBLERS_FEATURE] = job.data.feature;
  process.env[Environment.OS_EMAIL] = credentials.userName;
  process.env[Environment.OS_PASSWORD] = credentials.password;
  process.env[Environment.OS_MAPS_JOB_PATH] = jobPath;
  if (job.data.osMapsRouteUrls && job.data.osMapsRouteUrls.length > 0) {
    process.env[Environment.OS_MAPS_ROUTE_URLS] = JSON.stringify(job.data.osMapsRouteUrls);
    delete process.env[Environment.OS_MAPS_ROUTE_URL];
  } else if (job.data.osMapsRouteUrl) {
    process.env[Environment.OS_MAPS_ROUTE_URL] = job.data.osMapsRouteUrl;
    delete process.env[Environment.OS_MAPS_ROUTE_URLS];
  } else {
    delete process.env[Environment.OS_MAPS_ROUTE_URL];
    delete process.env[Environment.OS_MAPS_ROUTE_URLS];
  }
}
