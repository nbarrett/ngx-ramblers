import { Db } from "mongodb";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { Image } from "../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { createDefaultLogoAndTextBanner } from "../../../environment-setup/templates/sample-data/banner-template";

const BANNERS_COLLECTION = "banners";

export async function seedDefaultLogoBanner(
  db: Db,
  log: (message: string) => void = () => {}
): Promise<{seeded: boolean; reason: string}> {
  const banners = db.collection(BANNERS_COLLECTION);
  const existingCount = await banners.countDocuments({});
  const outcome = {seeded: false, reason: ""};
  if (existingCount > 0) {
    outcome.reason = `Banners collection already has ${existingCount} document(s)`;
    log(outcome.reason);
  } else {
    const systemConfigDoc = await db.collection("config").findOne({key: ConfigKey.SYSTEM});
    const logos: Image[] = systemConfigDoc?.value?.logos?.images || [];
    const selectedLogoName = systemConfigDoc?.value?.header?.selectedLogo || "";
    const groupLongName = systemConfigDoc?.value?.group?.longName || "Group";
    const preferredLogo = logos.find(image => image?.originalFileName && image.originalFileName === selectedLogoName)
      || logos.find(image => !!image?.originalFileName && !!image?.awsFileName)
      || logos.find(image => !!image?.originalFileName)
      || null;
    if (!preferredLogo?.originalFileName) {
      outcome.reason = "No logo available in system config to seed a default banner";
      log(outcome.reason);
    } else {
      const banner = createDefaultLogoAndTextBanner(groupLongName, preferredLogo);
      await banners.insertOne(banner);
      outcome.seeded = true;
      outcome.reason = `Seeded default banner "${banner.name}" using logo ${preferredLogo.originalFileName}`;
      log(outcome.reason);
    }
  }
  return outcome;
}
