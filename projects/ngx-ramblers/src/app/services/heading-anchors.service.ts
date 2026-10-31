import { DOCUMENT } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { MarkdownService } from "ngx-markdown";
import { NgxLoggerLevel } from "ngx-logger";
import { filter } from "rxjs/operators";
import { Subscription } from "rxjs";
import { applyHeadingAnchors, headingAnchorUrl, showHeadingCopyIcon } from "../functions/heading-anchors";
import { TOOLTIP_SHOW_DELAY_MS } from "../modules/common/tooltip-config";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({providedIn: "root"})
export class HeadingAnchorService {
  private document = inject(DOCUMENT);
  private router = inject(Router);
  private markdownService = inject(MarkdownService, {optional: true});
  private logger: Logger = inject(LoggerFactory).createLogger("HeadingAnchorService", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];
  private listening = false;
  private markdownBound = false;
  private settled = {fragment: "", found: false};
  private copyTimer = {id: 0};
  private frame = {id: 0};
  private tip = {timer: 0, element: null as HTMLElement | null};
  private pass = {running: false};

  watchDocument(): void {
    if (!this.listening) {
      this.listening = true;
      this.bindMarkdownRender();
      this.subscriptions.push(this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
        this.settled.found = false;
        this.hideTip();
        this.schedule();
      }));
      if (this.markdownService) {
        this.subscriptions.push(this.markdownService.reload$.subscribe(() => this.schedule()));
      }
      this.document.addEventListener("click", event => this.onCopyClick(event));
      this.schedule();
    }
  }

  schedule(): void {
    const view = this.document.defaultView;
    if (view && !this.frame.id) {
      this.frame.id = view.requestAnimationFrame(() => {
        this.frame.id = 0;
        this.decorate();
      });
    }
  }

  private bindMarkdownRender(): void {
    if (!this.markdownBound && this.markdownService) {
      this.markdownBound = true;
      const original = this.markdownService.render.bind(this.markdownService);
      this.markdownService.render = (element, options, viewContainerRef) => {
        original(element, options, viewContainerRef);
        this.schedule();
      };
    }
  }

  private decorate(): void {
    if (!this.pass.running) {
      this.pass.running = true;
      const path = `${this.document.location.pathname}${this.document.location.search}`;
      applyHeadingAnchors(this.document, path);
      this.bindControls();
      this.scroll();
      this.pass.running = false;
    }
  }

  private bindControls(): void {
    this.document.querySelectorAll<HTMLElement>(".heading-permalink, .heading-copy").forEach(control => {
      if (control.dataset.headingBound !== "1") {
        control.dataset.headingBound = "1";
        control.addEventListener("pointerenter", () => this.queueTip(control));
        control.addEventListener("pointerleave", () => this.cancelTip());
      }
    });
  }

  private queueTip(control: HTMLElement): void {
    this.document.defaultView?.clearTimeout(this.tip.timer);
    this.tip.timer = this.document.defaultView?.setTimeout(() => this.showTip(control), TOOLTIP_SHOW_DELAY_MS) || 0;
  }

  private cancelTip(): void {
    this.document.defaultView?.clearTimeout(this.tip.timer);
    this.hideTip();
  }

  private scroll(): void {
    const fragment = this.router.parseUrl(this.router.url).fragment || "";
    const target = fragment ? this.document.getElementById(fragment) : null;
    const already = this.settled.fragment === fragment && this.settled.found;
    if (fragment && target && !already) {
      target.scrollIntoView({block: "start"});
      this.settled.fragment = fragment;
      this.settled.found = true;
    } else if (!fragment || !target) {
      this.settled.fragment = fragment;
      this.settled.found = false;
    }
  }

  private showTip(control: HTMLElement): void {
    const view = this.document.defaultView;
    if (view && control.isConnected) {
      const tip = this.tipElement();
      tip.textContent = control.classList.contains("heading-permalink") ? "Link to this heading" : "Copy link";
      const box = control.getBoundingClientRect();
      tip.style.left = `${box.left + box.width / 2}px`;
      tip.style.top = `${box.top - 8}px`;
      tip.hidden = false;
      this.tip.element = tip;
    }
  }

  private hideTip(): void {
    if (this.tip.element) {
      this.tip.element.hidden = true;
    }
  }

  private tipElement(): HTMLElement {
    const existing = this.document.querySelector<HTMLElement>(".heading-anchor-tooltip");
    if (existing) {
      return existing;
    } else {
      const tip = this.document.createElement("div");
      tip.className = "heading-anchor-tooltip";
      tip.setAttribute("role", "tooltip");
      tip.hidden = true;
      tip.style.pointerEvents = "none";
      this.document.body.appendChild(tip);
      return tip;
    }
  }

  private onCopyClick(event: Event): void {
    const target = event.target as Element | null;
    const copy = target?.closest?.("button.heading-copy") as HTMLButtonElement | null;
    if (copy) {
      event.preventDefault();
      event.stopPropagation();
      const url = headingAnchorUrl(copy, this.document.location.origin);
      this.document.defaultView?.navigator.clipboard?.writeText(url).then(() => {
        showHeadingCopyIcon(copy, true);
        copy.setAttribute("aria-label", "Link copied");
        this.document.defaultView?.clearTimeout(this.copyTimer.id);
        this.copyTimer.id = this.document.defaultView?.setTimeout(() => {
          showHeadingCopyIcon(copy, false);
          copy.setAttribute("aria-label", "Copy link to this heading");
        }, 1500) || 0;
      }).catch(error => {
        this.logger.error("Could not copy heading link", error);
      });
    }
  }
}
