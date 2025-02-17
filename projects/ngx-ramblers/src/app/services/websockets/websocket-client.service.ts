import { inject, Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";

@Injectable({
  providedIn: "root"
})
export class WebSocketClientService {
  private socket: WebSocket;
  private subjects: { [key: string]: Subject<any> } = {};
  private logger: Logger = inject(LoggerFactory).createLogger("WebSocketClientService", NgxLoggerLevel.ERROR);
  private urlService = inject(UrlService);

  connect(): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = `${this.urlService.websocketProtocol()}://${this.urlService.websocketHost()}/ws`;
      this.socket = new WebSocket(url);
      this.logger.info(`created at: ${url}`);
      this.socket.onopen = () => {
        const openMessage = `onopen event to ${url}`;
        this.logger.info(openMessage);
        resolve(openMessage);
      };
      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.logger.info(`onmessage received:`, event, "message:", message);
        if (this.subjects[message.type]) {
          this.subjects[message.type].next(message.data);
        }
      };
      this.socket.onclose = () => {
        this.logger.info(`onclose event occurred`);
      };
      this.socket.onerror = (error) => {
        this.logger.error(`onerror event occurred:`, error);
        reject(error);
      };
    });
  }

  sendMessage(type: string, data: any): void {
    this.socket.send(JSON.stringify({type, data}));
  }

  receiveMessages(type: string): Observable<any> {
    if (!this.subjects[type]) {
      this.subjects[type] = new Subject<any>();
    }
    return this.subjects[type].asObservable();
  }
}
