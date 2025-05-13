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
      this.socket.onclose = (closeEvent: CloseEvent) => {
        const code = closeEvent.code;
        const mappedCloseMessage: MappedCloseMessage = mapStatusCode(code);
        if (mappedCloseMessage.success) {
          this.logger.info(`onclose event occurred with allowable status code:`, mappedCloseMessage);
        } else {
          this.logger.error(`onclose event occurred with error:`, closeEvent);
          this.subjects[MessageType.ERROR].next(mappedCloseMessage);
        }
      };
      this.socket.onerror = (error) => {
        this.logger.error(`onerror event occurred:`, error);
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
    this.logger.info("receiveMessages:type", type);
    if (!this.subjects[type]) {
      this.subjects[type] = new Subject<T>();
    }
    return this.subjects[type].asObservable();
  }


}
