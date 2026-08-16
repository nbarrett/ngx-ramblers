import { inject, Injectable } from "@angular/core";
import { ReleaseNoteUpdateConfiguration, ReleaseNoteUpdateDefaults } from "../../models/email-composer.model";
import { ConfigKey } from "../../models/config.model";
import { defaultReleaseNoteUpdateConfiguration, releaseNoteUpdateConfigurationFrom } from "../../functions/email-composer";
import { ConfigService } from "../config.service";

@Injectable({
  providedIn: "root"
})
export class ReleaseNoteUpdateConfigService {

  private configService = inject(ConfigService);

  async load(): Promise<ReleaseNoteUpdateDefaults> {
    const configuration = await this.loadConfiguration();
    return configuration.profiles.find(profile => profile.id === configuration.defaultProfileId)?.defaults ?? configuration.profiles[0].defaults;
  }

  async loadConfiguration(): Promise<ReleaseNoteUpdateConfiguration> {
    const config = await this.configService.queryConfig<ReleaseNoteUpdateConfiguration>(ConfigKey.RELEASE_NOTE_UPDATE, defaultReleaseNoteUpdateConfiguration());
    return releaseNoteUpdateConfigurationFrom(config);
  }

  async saveConfiguration(config: ReleaseNoteUpdateConfiguration): Promise<ReleaseNoteUpdateConfiguration> {
    const normalised = releaseNoteUpdateConfigurationFrom(config);
    const saved: any = await this.configService.saveConfig<ReleaseNoteUpdateConfiguration>(ConfigKey.RELEASE_NOTE_UPDATE, normalised);
    return releaseNoteUpdateConfigurationFrom(saved.value);
  }
}
