import { Provider } from "@angular/core";
import { TooltipConfig } from "ngx-bootstrap/tooltip";

export const TOOLTIP_SHOW_DELAY_MS = 800;

export function tooltipConfig(delay = 0): TooltipConfig {
  return Object.assign(new TooltipConfig(), {container: "body", delay});
}

export const DELAYED_TOOLTIP_PROVIDERS: Provider[] = [
  {provide: TooltipConfig, useFactory: () => tooltipConfig(TOOLTIP_SHOW_DELAY_MS)}
];
