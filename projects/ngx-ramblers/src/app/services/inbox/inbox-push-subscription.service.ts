import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject } from "rxjs";
import { isUndefined } from "es-toolkit/compat";
import { ApiResponse } from "../../models/api-response.model";
import { InboxPushSubscribeRequest, InboxPushSubscriptionStatus, InboxPushVapidPublicKeyResponse } from "../../models/inbox.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { CommonDataService } from "../common-data-service";

const SERVICE_WORKER_URL = "/inbox-push-sw.js";

@Injectable({providedIn: "root"})
export class InboxPushSubscriptionService {

  private logger: Logger = inject(LoggerFactory).createLogger("InboxPushSubscriptionService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/inbox/push";

  private readonly statusSubject = new BehaviorSubject<InboxPushSubscriptionStatus>(this.computeInitialStatus());
  public readonly status$ = this.statusSubject.asObservable();

  supported(): boolean {
    return !isUndefined(window)
      && "serviceWorker" in navigator
      && "PushManager" in window
      && !isUndefined(Notification);
  }

  permission(): NotificationPermission | "unsupported" {
    if (!this.supported()) {
      return "unsupported";
    }
    return Notification.permission;
  }

  private computeInitialStatus(): InboxPushSubscriptionStatus {
    if (isUndefined(window)) {
      return {supported: false, permission: "unsupported", subscribed: false};
    }
    return {supported: this.supported(), permission: this.permission(), subscribed: false};
  }

  async refresh(): Promise<void> {
    if (!this.supported()) {
      this.statusSubject.next({supported: false, permission: "unsupported", subscribed: false});
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
      const existing = await registration?.pushManager.getSubscription();
      this.statusSubject.next({supported: true, permission: this.permission(), subscribed: Boolean(existing)});
    } catch {
      this.statusSubject.next({supported: true, permission: this.permission(), subscribed: false});
    }
  }

  async enable(): Promise<void> {
    if (!this.supported()) {
      throw new Error("Browser notifications are not supported in this browser");
    }
    const granted = await Notification.requestPermission();
    if (granted !== "granted") {
      this.statusSubject.next({supported: true, permission: granted, subscribed: false});
      throw new Error("Browser notification permission was not granted");
    }
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    await navigator.serviceWorker.ready;
    const vapidPublicKey = await this.fetchVapidPublicKey();
    if (!vapidPublicKey || vapidPublicKey.length < 80) {
      throw new Error(`VAPID public key from server looked invalid (length ${vapidPublicKey?.length ?? 0}); ask an admin to check the inbox push config`);
    }
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    if (applicationServerKey.length !== 65) {
      throw new Error(`VAPID public key decoded to ${applicationServerKey.length} bytes; expected 65 - the stored key is malformed`);
    }
    let subscription: PushSubscription;
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource
      });
    } catch (error) {
      const message = (error as Error).message || String(error);
      this.logger.error("pushManager.subscribe failed", error);
      throw new Error(`${message}. The browser's push service rejected the subscription - this usually means the browser cannot reach Google/Mozilla's push servers (check network), or push notifications are disabled at the browser or OS level. The VAPID key from the server was valid (65 bytes)`);
    }
    const serialised = subscription.toJSON();
    const payload: InboxPushSubscribeRequest = {
      endpoint: subscription.endpoint,
      keys: {p256dh: serialised.keys?.p256dh ?? "", auth: serialised.keys?.auth ?? ""},
      userAgent: navigator.userAgent
    };
    await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/subscriptions`, payload));
    this.statusSubject.next({supported: true, permission: "granted", subscribed: true});
  }

  async disable(): Promise<void> {
    if (!this.supported()) {
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    const existing = await registration?.pushManager.getSubscription();
    if (existing) {
      await this.commonDataService.responseFrom(this.logger, this.http.request<ApiResponse>("DELETE", `${this.BASE_URL}/subscriptions`, {body: {endpoint: existing.endpoint}}));
      await existing.unsubscribe();
    }
    this.statusSubject.next({supported: true, permission: this.permission(), subscribed: false});
  }

  private async fetchVapidPublicKey(): Promise<string> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/vapid-public-key`));
    return (response.response as InboxPushVapidPublicKeyResponse).vapidPublicKey;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  const safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(safe);
  const output = new Uint8Array(raw.length);
  raw.split("").forEach((character, index) => {
    output[index] = character.charCodeAt(0);
  });
  return output;
}
