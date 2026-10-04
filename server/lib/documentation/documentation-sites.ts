import { Request, Response } from "express";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { DocumentationSite } from "../../../projects/ngx-ramblers/src/app/models/documentation-links.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { documentationSiteOrigin } from "../../../projects/ngx-ramblers/src/app/functions/documentation-links";
import * as config from "../mongo/controllers/config";
import { environmentRamblersInfo } from "../environment-setup/environment-details";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { dateTimeNow } from "../shared/dates";

const errorDebugLog = createErrorDebugLog("documentation:sites");
const cache = {expires: 0, sites: null as Promise<DocumentationSite[]> | null};

export async function publicDocumentationSites(): Promise<DocumentationSite[]> {
  if (cache.sites && cache.expires > dateTimeNow().toMillis()) {
    return cache.sites;
  } else {
    cache.expires = dateTimeNow().plus({minutes: 5}).toMillis();
    cache.sites = loadDocumentationSites().catch(error => {
      cache.sites = null;
      errorDebugLog("Unable to load documentation sites", error);
      throw error;
    });
    return cache.sites;
  }
}

async function loadDocumentationSites(): Promise<DocumentationSite[]> {
  const document = await config.queryKey(ConfigKey.ENVIRONMENTS);
  const environments: EnvironmentsConfig = document?.value;
  if (environments?.environments?.length) {
    const sites = await Promise.all(environments.environments.map(async environment => {
      const info = await environmentRamblersInfo(environment);
      return {
        name: environment.environment,
        label: info.groupName || environment.environment,
        url: documentationSiteOrigin(info.siteHref) || ""
      };
    }));
    return sites.filter(site => !!site.url).sort((a, b) => a.label.localeCompare(b.label));
  } else {
    const systemDocument = await config.queryKey(ConfigKey.SYSTEM);
    const system: SystemConfig = systemDocument?.value;
    const url = documentationSiteOrigin(system?.group?.href);
    return url ? [{name: system.group.shortName || url, label: system.group.longName || url, url}] : [];
  }
}

export async function documentationSites(req: Request, res: Response): Promise<void> {
  try {
    res.json(await publicDocumentationSites());
  } catch {
    res.status(503).json({error: "The website list is unavailable. Please try again."});
  }
}
