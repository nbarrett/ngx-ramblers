import { CanDeactivateFn } from "@angular/router";

export interface ComposerLeaveCheck {
  confirmNavigationAway(): boolean | Promise<boolean>;
}

export const ComposerLeaveGuard: CanDeactivateFn<ComposerLeaveCheck> = component => component.confirmNavigationAway();
