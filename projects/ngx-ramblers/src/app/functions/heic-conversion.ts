import { firstValueFrom, from, timeout } from "rxjs";
import { HeicConversionResult } from "../models/heic-conversion.model";

export async function heicToJpeg(file: File): Promise<Blob> {
  const worker = new Worker(new URL("./heic-conversion.worker", import.meta.url), {type: "module"});
  try {
    return await firstValueFrom(from(new Promise<Blob>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<HeicConversionResult>) => {
        if (event.data.jpeg) {
          resolve(event.data.jpeg);
        } else {
          reject(new Error(event.data.error || "The HEIC photo could not be converted"));
        }
      };
      worker.onerror = () => reject(new Error("The HEIC photo decoder could not start"));
      worker.onmessageerror = () => reject(new Error("The converted HEIC photo could not be read"));
      worker.postMessage(file);
    })).pipe(timeout(30000)));
  } finally {
    worker.terminate();
  }
}
