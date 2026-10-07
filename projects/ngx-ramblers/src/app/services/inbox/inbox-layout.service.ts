import { MaximisablePanelComponent } from "../../modules/common/maximisable-panel/maximisable-panel";
import { ElementRef, inject, NgZone, OnDestroy } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { isUndefined, values } from "es-toolkit/compat";
import { LoggerFactory } from "../logger-factory.service";
import { validatedInboxColumnShare } from "../../functions/inbox-thread";
import { InboxGroupingMode, InboxColumnResizeEdge } from "../../models/inbox.model";
import { DeviceSize } from "../../models/page.model";
import { Injectable } from "@angular/core";
@Injectable()
export class InboxLayoutService implements OnDestroy {
    private logger = inject(LoggerFactory).createLogger("InboxLayoutService", NgxLoggerLevel.ERROR);
    panel: MaximisablePanelComponent | null = null;
    toggleNavCollapsed(): void {
        this.navCollapsed = !this.navCollapsed;
        if (!isUndefined(window)) {
            window.localStorage.setItem(InboxLayoutService.NAV_KEY, this.navCollapsed ? "collapsed" : "expanded");
        }
    }
    public stackedLayout = false;
    public mobile = false;
    public mobileShowDetail = false;
    public mobileFiltersOpen = false;
    public compactDetailHeader = false;
    public listSize = 352;
    public readonly minListSize = 140;
    private static readonly LAYOUT_KEY = "inbox-layout";
    private static readonly SIZE_KEY = "inbox-list-size";
    private static readonly NAV_KEY = "inbox-nav";
    private static readonly NAV_SIZE_KEY = "inbox-nav-size";
    private static readonly GROUPING_KEY = "inbox-grouping-mode";
    private static readonly DENSITY_KEY = "inbox-list-density";
    public compactList = false;
    public columnShare = { from: 1.1, to: 1.4, location: 1.2, subject: 2, date: 1.5 };
    public groupingMode: InboxGroupingMode = InboxGroupingMode.CONVERSATIONS;
    public mobileNavOpen = false;
    public navCollapsed = false;
    public navSize = 220;
    public readonly minNavSize = 150;
    get maxNavSize(): number {
        if (isUndefined(window)) {
            return Number.POSITIVE_INFINITY;
        }
        else {
            return window.innerWidth * 0.5;
        }
    }
    private inboxLayoutRef: ElementRef<HTMLElement> | null = null;
    private inboxShellRef: ElementRef<HTMLElement> | null = null;
    private zone = inject(NgZone);
    private layoutResizeObserver: ResizeObserver | null = null;
    private listRatio: number | null = null;
    private navRatio: number | null = null;
    private splitterDragging = false;
    updateMobile(): void {
        this.mobile = !isUndefined(window) && (window.innerWidth < DeviceSize.MEDIUM
            || (window.innerWidth > window.innerHeight && window.innerHeight < DeviceSize.SMALL));
    }
    get gridTemplateColumns(): string {
        return this.mobile
            ? "minmax(0, 1fr)"
            : this.stackedLayout ? "minmax(0, 1fr)" : `${this.listSize}px 8px minmax(0, 1fr)`;
    }
    get gridTemplateRows(): string {
        return this.mobile
            ? "minmax(0, 1fr)"
            : this.stackedLayout ? `${this.listSize}px 8px minmax(0, 1fr)` : "minmax(0, 1fr)";
    }
    get maxListSize(): number {
        if (isUndefined(window)) {
            return Number.POSITIVE_INFINITY;
        }
        else {
            return (this.stackedLayout ? window.innerHeight : window.innerWidth) * 0.7;
        }
    }
    persistListSize(): void {
        if (!isUndefined(window)) {
            window.localStorage.setItem(InboxLayoutService.SIZE_KEY, String(Math.round(this.listSize)));
        }
        const span = this.layoutSpan();
        if (span > 0) {
            this.listRatio = this.listSize / span;
        }
        this.splitterDragging = false;
    }
    persistNavSize(): void {
        if (!isUndefined(window)) {
            window.localStorage.setItem(InboxLayoutService.NAV_SIZE_KEY, String(Math.round(this.navSize)));
        }
        const width = this.shellWidth();
        if (width > 0) {
            this.navRatio = this.navSize / width;
        }
        this.splitterDragging = false;
        this.applyPaneRatios();
    }
    scheduleFitShellToWindow(): void {
        requestAnimationFrame(() => this.fitShellToWindow());
    }
    fitShellToWindow(): void {
        const el = this.inboxShellRef?.nativeElement ?? null;
        if (el && !isUndefined(window)) {
            if (this.mobile || this.panel?.maximised) {
                el.style.height = "";
            }
            else {
                const top = el.getBoundingClientRect().top;
                const height = Math.max(240, window.innerHeight - top - 16);
                el.style.height = `${height}px`;
            }
        }
    }
    observeLayoutSize(): void {
        if (!isUndefined(window) && "ResizeObserver" in window && this.inboxLayoutRef?.nativeElement) {
            this.layoutResizeObserver?.disconnect();
            this.layoutResizeObserver = new ResizeObserver(() => this.zone.run(() => this.applyPaneRatios()));
            this.layoutResizeObserver.observe(this.inboxLayoutRef.nativeElement);
            if (this.inboxShellRef?.nativeElement) {
                this.layoutResizeObserver.observe(this.inboxShellRef.nativeElement);
            }
            this.applyPaneRatios();
        }
    }
    private layoutSpan(): number {
        const rect = this.inboxLayoutRef?.nativeElement?.getBoundingClientRect();
        return rect ? (this.stackedLayout ? rect.height : rect.width) : 0;
    }
    private shellWidth(): number {
        return this.inboxShellRef?.nativeElement?.getBoundingClientRect()?.width ?? 0;
    }
    private applyPaneRatios(): void {
        if (!this.splitterDragging) {
            const width = this.shellWidth();
            if (width > 0 && !this.mobile && !this.navCollapsed) {
                if (this.navRatio === null) {
                    this.navRatio = this.navSize / width;
                }
                else {
                    this.navSize = Math.min(Math.max(Math.round(this.navRatio * width), this.minNavSize), this.maxNavSize);
                }
            }
            const span = this.layoutSpan();
            if (span > 0 && !this.mobile) {
                if (this.listRatio === null) {
                    this.listRatio = this.listSize / span;
                }
                else {
                    this.listSize = Math.min(Math.max(Math.round(this.listRatio * span), this.minListSize), this.maxListSize);
                }
            }
        }
    }
    onNavSizeChange(size: number): void {
        this.splitterDragging = true;
        this.navSize = size;
    }
    onListSizeChange(size: number): void {
        this.splitterDragging = true;
        this.listSize = size;
    }
    restoreLayout(): void {
        if (isUndefined(window)) {
        }
        else {
            this.stackedLayout = window.localStorage.getItem(InboxLayoutService.LAYOUT_KEY) === "stacked";
            const storedSize = Number(window.localStorage.getItem(InboxLayoutService.SIZE_KEY));
            this.listSize = Number.isFinite(storedSize) && storedSize >= this.minListSize ? storedSize : this.defaultListSize();
            this.navCollapsed = window.localStorage.getItem(InboxLayoutService.NAV_KEY) === "collapsed";
            const storedGrouping = window.localStorage.getItem(InboxLayoutService.GROUPING_KEY);
            this.groupingMode = values(InboxGroupingMode).includes(storedGrouping as InboxGroupingMode) ? storedGrouping as InboxGroupingMode : InboxGroupingMode.CONVERSATIONS;
            this.compactList = window.localStorage.getItem(InboxLayoutService.DENSITY_KEY) === "compact";
            const storedColumns = window.localStorage.getItem("inbox-column-share");
            if (storedColumns) {
                try {
                    this.columnShare = validatedInboxColumnShare(JSON.parse(storedColumns), this.columnShare);
                }
                catch (error) {
                    this.logger.warn("Ignoring invalid saved inbox column widths", error);
                }
            }
            const storedNavSize = Number(window.localStorage.getItem(InboxLayoutService.NAV_SIZE_KEY));
            this.navSize = Number.isFinite(storedNavSize) && storedNavSize >= this.minNavSize ? Math.min(storedNavSize, this.maxNavSize) : this.navSize;
        }
    }
    private defaultListSize(): number {
        return this.stackedLayout ? 240 : 352;
    }
    toggleDensity(): void {
        this.compactList = !this.compactList;
        if (!isUndefined(window)) {
            window.localStorage.setItem(InboxLayoutService.DENSITY_KEY, this.compactList ? "compact" : "comfortable");
        }
    }
    toggleLayout(): void {
        this.stackedLayout = !this.stackedLayout;
        this.listRatio = null;
        this.listSize = this.defaultListSize();
        if (!isUndefined(window)) {
            window.localStorage.setItem(InboxLayoutService.LAYOUT_KEY, this.stackedLayout ? "stacked" : "side-by-side");
            window.localStorage.setItem(InboxLayoutService.SIZE_KEY, String(this.listSize));
        }
    }
    startColumnResize(event: PointerEvent, edge: InboxColumnResizeEdge): void {
        event.preventDefault();
        event.stopPropagation();
        const left = (event.currentTarget as HTMLElement).parentElement as HTMLElement;
        const right = left.nextElementSibling as HTMLElement | null;
        const leftBox = left.getBoundingClientRect();
        const rightBox = right?.getBoundingClientRect();
        const pairWidth = Math.max((rightBox ? rightBox.right : leftBox.right) - leftBox.left, 1);
        const startShare = { ...this.columnShare };
        const move = (pointer: PointerEvent) => {
            const leftPx = Math.min(Math.max(pointer.clientX - leftBox.left, 48), pairWidth - 48);
            const rightPx = pairWidth - leftPx;
            const next = { ...startShare };
            if (edge === InboxColumnResizeEdge.FROM) {
                const scale = (startShare.from + startShare.to) / pairWidth;
                next.from = leftPx * scale;
                next.to = rightPx * scale;
            }
            else if (edge === InboxColumnResizeEdge.TO) {
                if (right?.classList.contains("inbox-column-location")) {
                    const scale = (startShare.to + startShare.location) / pairWidth;
                    next.to = leftPx * scale;
                    next.location = rightPx * scale;
                }
                else {
                    const scale = (startShare.to + startShare.subject) / pairWidth;
                    next.to = leftPx * scale;
                    next.subject = rightPx * scale;
                }
            }
            else if (edge === InboxColumnResizeEdge.LOCATION) {
                const scale = (startShare.location + startShare.subject) / pairWidth;
                next.location = leftPx * scale;
                next.subject = rightPx * scale;
            }
            else {
                const scale = (startShare.subject + startShare.date) / pairWidth;
                next.subject = leftPx * scale;
                next.date = rightPx * scale;
            }
            this.columnShare = next;
        };
        const stop = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", stop);
            window.localStorage.setItem("inbox-column-share", JSON.stringify(this.columnShare));
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop);
    }
    attachLayout(ref: ElementRef<HTMLElement> | null): void {
        this.inboxLayoutRef = ref;
    }
    attachShell(ref: ElementRef<HTMLElement> | null): void {
        this.inboxShellRef = ref;
    }
    changeGrouping(mode: InboxGroupingMode): void {
        this.groupingMode = mode;
        if (!isUndefined(window)) {
            window.localStorage.setItem(InboxLayoutService.GROUPING_KEY, mode);
        }
    }
    ngOnDestroy(): void {
        this.layoutResizeObserver?.disconnect();
    }
}
