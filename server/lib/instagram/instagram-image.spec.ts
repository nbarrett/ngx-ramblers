import expect from "expect";
import { describe, it } from "mocha";
import sharp from "sharp";
import { prepareInstagramImage } from "./instagram-image-transform";

describe("Instagram image preparation", () => {
  it("preserves images within Instagram's aspect ratio range", async () => {
    const input = await sharp({create: {width: 1200, height: 800, channels: 3, background: "green"}}).jpeg().toBuffer();
    const result = await prepareInstagramImage(input);

    expect(result.transformed).toEqual(false);
    expect(result.body).toBe(input);
  });

  it("crops extra-wide phone images to Instagram's widest supported ratio", async () => {
    const input = await sharp({create: {width: 2400, height: 1080, channels: 3, background: "green"}}).jpeg().toBuffer();
    const result = await prepareInstagramImage(input);
    const metadata = await sharp(result.body).metadata();

    expect(result.transformed).toEqual(true);
    expect(metadata.width).toEqual(1080);
    expect(metadata.height).toEqual(566);
    expect(metadata.width / metadata.height).toBeLessThanOrEqual(1.91);
  });

  it("crops extra-tall phone images to Instagram's tallest supported ratio", async () => {
    const input = await sharp({create: {width: 800, height: 1400, channels: 3, background: "green"}}).jpeg().toBuffer();
    const result = await prepareInstagramImage(input);
    const metadata = await sharp(result.body).metadata();

    expect(result.transformed).toEqual(true);
    expect(metadata.width).toEqual(800);
    expect(metadata.height).toEqual(1000);
    expect(metadata.width / metadata.height).toEqual(0.8);
  });
});
