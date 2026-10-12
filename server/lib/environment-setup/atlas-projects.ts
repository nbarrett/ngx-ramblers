import { AtlasApiAccess, AtlasError, AtlasProjectDescription } from "./atlas-admin-api.model";
import { atlasRequest } from "./atlas-admin-api";
import { configuredEnvironments } from "../environments/environments-config";
import * as configController from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";

export async function atlasProjectForCluster(atlas: AtlasApiAccess, name: string): Promise<AtlasApiAccess> {
  const config = await configuredEnvironments();
  const existing = config.atlas?.managedProjects?.find(project => project.name === name);
  if (existing) {
    return {...atlas, projectId: existing.projectId};
  } else {
    const parent = await atlasRequest<AtlasProjectDescription & AtlasError>(atlas, "GET", `/groups/${atlas.projectId}`);
    if (parent.status >= 300 || !parent.body?.orgId) {
      throw new Error(`Could not resolve the Atlas organisation: ${parent.body?.detail || parent.status}`);
    } else {
      const created = await atlasRequest<AtlasProjectDescription & AtlasError>(atlas, "POST", "/groups", {name, orgId: parent.body.orgId});
      if (created.status >= 300 || !created.body?.id) {
        throw new Error(`Could not create the Atlas project (${created.status}): ${created.body?.detail || "The API key needs Organisation Project Creator."}`);
      } else {
        const document = await configController.queryKey(ConfigKey.ENVIRONMENTS);
        const current: EnvironmentsConfig = document?.value || {environments: []};
        const project = {name, projectId: created.body.id};
        await configController.createOrUpdateKey(ConfigKey.ENVIRONMENTS, {...current, atlas: {...current.atlas, managedProjects: [...(current.atlas?.managedProjects || []), project]}});
        return {...atlas, projectId: project.projectId};
      }
    }
  }
}
