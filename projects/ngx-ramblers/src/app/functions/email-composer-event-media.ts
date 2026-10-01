import { isNumber } from "es-toolkit/compat";
import { GroupEventSummary } from "../models/committee.model";
export function mediaUrlAtIndex(event: GroupEventSummary, index: number): string | null {
    const item = event.media?.[index];
    return item?.styles?.find(style => style.style === "medium")?.url ?? item?.styles?.[0]?.url ?? null;
}
export function clampMediaIndex(event: GroupEventSummary, index: number | null | undefined): number {
    const count = event.media?.length ?? 0;
    if (count === 0 || !isNumber(index)) {
        return 0;
    }
    else {
        return Math.min(Math.max(index, 0), count - 1);
    }
}
export function applyMediaSelection(event: GroupEventSummary, index: number): void {
    event.selectedMediaIndex = index;
    const url = mediaUrlAtIndex(event, index);
    if (url) {
        event.image = url;
    }
}
