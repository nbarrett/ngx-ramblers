import { FieldChange } from "./field-change.model";

export type ChangedItem = FieldChange<string, any>;

export interface DescribedChangedItem extends FieldChange<string, string> {
  label: string;
}

export type NotificationChangedItem = DescribedChangedItem;
