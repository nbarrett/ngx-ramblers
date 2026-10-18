import initialiseHeif from "libheif-js/libheif-wasm/libheif-bundle.mjs";
import { HeicConversionResult } from "../models/heic-conversion.model";

addEventListener("message", async (event: MessageEvent<File>) => {
  try {
    const libheif = await initialiseHeif();
    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(new Uint8Array(await event.data.arrayBuffer()));
    try {
      const image = images.find(candidate => candidate.get_width() > 0 && candidate.get_height() > 0);
      if (!image) {
        throw new Error("The HEIC file contains no readable photo");
      } else {
        const width = image.get_width();
        const height = image.get_height();
        const pixels = await new Promise<ImageData>((resolve, reject) => {
          image.display(new ImageData(width, height), result => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("The HEIC photo could not be decoded"));
            }
          });
        });
        const canvas = new OffscreenCanvas(width, height);
        try {
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("The HEIC photo could not be prepared");
          } else {
            context.putImageData(pixels, 0, 0);
            const jpeg = await canvas.convertToBlob({type: "image/jpeg", quality: 0.92});
            const result: HeicConversionResult = {jpeg, error: null};
            postMessage(result);
          }
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    } finally {
      images.forEach(image => image.free());
      decoder.decoder?.delete();
    }
  } catch (error) {
    const result: HeicConversionResult = {jpeg: null, error: error instanceof Error ? error.message : "The HEIC photo could not be converted"};
    postMessage(result);
  }
});
