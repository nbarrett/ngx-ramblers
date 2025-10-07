import { inject, Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";
import { EventType, MappedCloseMessage, MessageType } from "../../models/websocket.model";
import { NumberUtilsService } from "../number-utils.service";
import { mapStatusCode } from "../../functions/websockets";


@Injectable({
  providedIn: "root"
})
export class WebSocketClientService {
  private socket: WebSocket;
  private subjects: { [key: string]: Subject<any> } = {};
  private logger: Logger = inject(LoggerFactory).createLogger("WebSocketClientService", NgxLoggerLevel.ERROR);
  private urlService = inject(UrlService);
  private numberUtilsService = inject(NumberUtilsService);
  private pingInterval: any;
  private reconnectTimer: any;
  private reconnectDelayMs = 2000;
  private maxReconnectDelayMs = 30000;

  connect(): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = `${this.urlService.websocketProtocol()}://${this.urlService.websocketHost()}/ws`;
      if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
        this.logger.info("reusing existing websocket connection state:", this.socket.readyState);
        resolve("existing connection active or in progress");
        return;
      }
      this.socket = new WebSocket(url);
      this.logger.info(`created at: ${url}`);
      this.socket.onopen = () => {
        const openMessage = `onopen event to ${url}`;
        this.logger.info(openMessage);
        this.startPingInterval();
        this.clearReconnect();
        this.reconnectDelayMs = 2000;
        resolve(openMessage);
      };
      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.logger.info(`onmessage received:`, event, "message:", message);
        if (this.subjects[message.type]) {
          this.subjects[message.type].next(message.data);
        }
      };
      this.socket.onclose = (closeEvent: CloseEvent) => {
        const code = closeEvent.code;
        const mappedCloseMessage: MappedCloseMessage = mapStatusCode(code);
        this.stopPingInterval();
        if (mappedCloseMessage.success) {
          this.logger.info(`onclose event occurred with allowable status code:`, mappedCloseMessage);
        } else {
          this.logger.error(`onclose event occurred with error:`, closeEvent);
          this.subjects[MessageType.ERROR].next(mappedCloseMessage);
        }
        this.scheduleReconnect();
      };
      this.socket.onerror = (error) => {
        this.logger.error(`onerror event occurred:`, error);
        this.scheduleReconnect();
        reject(error);
      };
    });
  }

  sendMessage(type: EventType, data: any): void {
    this.logger.info("sendMessage:type", type, "data:", data, "with size:", this.numberUtilsService.humanFileSize(this.numberUtilsService.estimateObjectSize(data)));
    const payload = JSON.stringify({type, data});
    this.logger.info("sendMessage:type", type, "data:", data, "with size:", this.numberUtilsService.humanFileSize(payload.length));
    this.socket.send(payload);
  }

  receiveMessages<T>(type: string): Observable<T> {
    if (!this.subjects[type]) {
      this.logger.info("Message receive initialised for:", type);
      this.subjects[type] = new Subject<T>();
    }
    return this.subjects[type].asObservable();
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: EventType.PING, data: {} }));
        this.logger.debug("Sent ping to keep connection alive");
      }
    }, 10000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    const delay = this.reconnectDelayMs;
    this.logger.info(`scheduling websocket reconnect in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.maxReconnectDelayMs);
      this.connect().catch(() => {
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
