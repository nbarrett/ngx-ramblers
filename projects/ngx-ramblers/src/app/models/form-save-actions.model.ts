export enum FormSaveExitAction {
  SAVE_AND_EXIT = "save-and-exit",
  CANCEL = "cancel"
}

export interface FormSaveActions {
  save: () => unknown | Promise<unknown>;
  saveAndExit: () => unknown | Promise<unknown>;
  undo: () => unknown | Promise<unknown>;
  cancel: () => unknown | Promise<unknown>;
}
