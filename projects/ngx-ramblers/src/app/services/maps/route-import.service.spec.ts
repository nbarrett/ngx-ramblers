import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { Subject } from "rxjs";
import { RouteImportService } from "./route-import.service";
import { MapRouteImportResponse } from "../../models/map-route-import.model";
import { RootFolder } from "../../models/system.model";
import { WebSocketClientService } from "../websockets/websocket-client.service";
import { MessageType } from "../../models/websocket.model";

class MockWebSocketClientService {
  progressSubject = new Subject<any>();
  errorSubject = new Subject<any>();
  completeSubject = new Subject<any>();
  connect = jasmine.createSpy("connect").and.resolveTo(undefined);
  sendMessage = jasmine.createSpy("sendMessage");

  receiveMessages<T>(type: MessageType) {
    if (type === MessageType.PROGRESS) {
      return this.progressSubject.asObservable();
    }
    if (type === MessageType.ERROR) {
      return this.errorSubject.asObservable();
    }
    return this.completeSubject.asObservable();
  }

  emitComplete(data: MapRouteImportResponse) {
    setTimeout(() => this.completeSubject.next(data));
  }
}

describe("RouteImportService", () => {
  let service: RouteImportService;
  let httpMock: HttpTestingController;
  let mockWebSocket: MockWebSocketClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, LoggerTestingModule],
      providers: [{provide: WebSocketClientService, useClass: MockWebSocketClientService}]
    });
    service = TestBed.inject(RouteImportService);
    httpMock = TestBed.inject(HttpTestingController);
    mockWebSocket = TestBed.inject(WebSocketClientService) as unknown as MockWebSocketClientService;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("uploads ESRI files and returns conversion details", async () => {
    const file = new File(["data"], "route.zip");
    const mockResponse: MapRouteImportResponse = {
      routeName: "Converted Route",
      gpxFile: {
        rootFolder: RootFolder.gpxRoutes,
        originalFileName: "converted.gpx",
        awsFileName: "abc123.gpx"
      },
      esriFile: {
        rootFolder: RootFolder.esriRoutes,
        originalFileName: "route.zip",
        awsFileName: "def456.zip"
      },
      metadata: {
        featureCount: 1,
        geometryTypes: ["LineString"]
      }
    };

    const promise = service.importEsri(file);
    const req = httpMock.expectOne("api/routes/upload-esri");
    expect(req.request.method).toBe("POST");
    const formData = req.request.body as FormData;
    expect(formData.has("file")).toBeTrue();
    req.flush(mockResponse);

    mockWebSocket.emitComplete(mockResponse);
    await expectAsync(promise).toBeResolvedTo(mockResponse);
  });
});
