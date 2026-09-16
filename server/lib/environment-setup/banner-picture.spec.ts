import expect from "expect";
import { describe, it } from "mocha";
import sharp from "sharp";
import { LOGO_BANNER_PICTURE_LAYOUT, renderLogoBannerPicture } from "./banner-picture";

describe("renderLogoBannerPicture", () => {
  it("draws the logo centred on white inside a dark border, at the standard banner size", async () => {
    const logo = await sharp({create: {width: 600, height: 150, channels: 3, background: {r: 255, g: 255, b: 255}}})
      .composite([{input: await sharp({create: {width: 400, height: 100, channels: 3, background: {r: 240, g: 128, b: 80}}}).png().toBuffer(), left: 100, top: 25}])
      .png()
      .toBuffer();
    const picture = await renderLogoBannerPicture(logo);
    const {data, info} = await sharp(picture).raw().toBuffer({resolveWithObject: true});
    const pixel = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
    const near = (actual: number[], expected: number[]) => actual.every((value, index) => Math.abs(value - expected[index]) <= 12);
    expect([info.width, info.height]).toEqual([LOGO_BANNER_PICTURE_LAYOUT.width, LOGO_BANNER_PICTURE_LAYOUT.height]);
    expect(near(pixel(5, 279), [64, 65, 65])).toBe(true);
    expect(near(pixel(60, 279), [255, 255, 255])).toBe(true);
    expect(near(pixel(1116, 279), [240, 128, 80])).toBe(true);
  });
});
