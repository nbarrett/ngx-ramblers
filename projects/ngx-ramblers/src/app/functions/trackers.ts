import { ContentMetadataItem } from "../models/content-metadata.model";
import { ExpenseEvent, ExpenseItem, ExpenseType } from "../notifications/expenses/expense.model";

export function imageTracker(image: ContentMetadataItem) {
  return image?._id || image?.image || image?.base64Content;
}

export function itemTracker(index: number, item: ExpenseItem) {
  return item.expenseDate && item.expenseType;
}

export function eventTracker(index: number, event: ExpenseEvent) {
  return event.date && event.eventType;
}

export function expenseTypeTracker(expenseType: ExpenseType) {
  return expenseType.value;
}


