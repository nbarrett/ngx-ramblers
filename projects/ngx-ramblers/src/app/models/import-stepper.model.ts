export enum ImportStepperKey {
  UPLOAD = "upload",
  MATCH = "match",
  IMAGES = "images",
  IMPORT = "import"
}

export interface ImportStepperStep {
  key: ImportStepperKey;
  label: string;
}
