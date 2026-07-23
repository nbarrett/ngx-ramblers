export interface FormSaveActions {
  save: () => unknown | Promise<unknown>;
  saveAndExit: () => unknown | Promise<unknown>;
  undo: () => unknown | Promise<unknown>;
  cancel: () => unknown | Promise<unknown>;
}
