import { Type } from "@angular/core";

export class NotificationComponent<T> {
  constructor(public component: Type<T>) {
  }
}
