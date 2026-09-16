import sharp from "sharp";
import { BannerPictureLayout } from "./banner-picture.model";

export const LOGO_BANNER_PICTURE_LAYOUT: BannerPictureLayout = {
  width: 2232,
  height: 558,
  border: 20,
  borderColour: "#404141",
  logoWidth: 2042,
  logoHeight: 324
};

const WHITE = {r: 255, g: 255, b: 255, alpha: 1};

export async function renderLogoBannerPicture(logo: Buffer | Uint8Array, layout: BannerPictureLayout = LOGO_BANNER_PICTURE_LAYOUT): Promise<Buffer> {
  const trimmedLogo = await sharp(logo).flatten({background: WHITE}).trim({threshold: 10}).toBuffer();
  const fittedLogo = await sharp(trimmedLogo)
    .resize({width: layout.logoWidth, height: layout.logoHeight, fit: "inside"})
    .toBuffer();
  const innerWidth = layout.width - layout.border * 2;
  const innerHeight = layout.height - layout.border * 2;
  const fittedSize = await sharp(fittedLogo).metadata();
  const inner = await sharp({create: {width: innerWidth, height: innerHeight, channels: 3, background: WHITE}})
    .composite([{
      input: fittedLogo,
      left: Math.round((innerWidth - (fittedSize.width || 0)) / 2),
      top: Math.round((innerHeight - (fittedSize.height || 0)) / 2)
    }])
    .png()
    .toBuffer();
  return sharp(inner)
    .extend({top: layout.border, bottom: layout.border, left: layout.border, right: layout.border, background: layout.borderColour})
    .jpeg({quality: 90})
    .toBuffer();
}
