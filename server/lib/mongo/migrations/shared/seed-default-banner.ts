import { Db } from "mongodb";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { Image, RootFolder } from "../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { createDefaultLogoAndTextBanner } from "../../../environment-setup/templates/sample-data/banner-template";
import { BannerPictureStore } from "../../../environment-setup/banner-picture.model";
import { renderLogoBannerPicture } from "../../../environment-setup/banner-picture";
import { ServerFileNameData } from "../../../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { v4 as uuid } from "uuid";

const BANNERS_COLLECTION = "banners";

async function bannerPicture(bannerName: string, logo: Image, pictureStore: BannerPictureStore | null): Promise<ServerFileNameData | null> {
  const logoContent = pictureStore && logo.awsFileName ? await pictureStore.read(logo.awsFileName) : null;
  if (!logoContent) {
    return null;
  } else {
    const awsFileName = `${uuid()}.jpeg`;
    await pictureStore.write(`${RootFolder.bannerPhotos}/${awsFileName}`, await renderLogoBannerPicture(logoContent), "image/jpeg");
    return {rootFolder: RootFolder.bannerPhotos, originalFileName: bannerName, awsFileName};
  }
}

export async function seedDefaultLogoBanner(
  db: Db,
  log: (message: string) => void = () => {},
  pictureStore: BannerPictureStore | null = null
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
      const fileNameData = await bannerPicture(banner.name, preferredLogo, pictureStore);
      await banners.insertOne(fileNameData ? {...banner, fileNameData} : banner);
      outcome.seeded = true;
      outcome.reason = `Seeded default banner "${banner.name}" using logo ${preferredLogo.originalFileName}${fileNameData ? ", with its banner picture" : ""}`;
      log(outcome.reason);
    }
  }
  return outcome;
}
