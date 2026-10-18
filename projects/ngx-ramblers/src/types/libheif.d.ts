declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  export default function initialiseHeif(): Promise<import("../app/models/heic-conversion.model").HeifModule>;
}
