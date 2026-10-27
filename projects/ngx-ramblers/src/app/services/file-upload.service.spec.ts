import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FileUploadService } from "./file-upload.service";
import { UrlService } from "./url.service";
import { AuthService } from "../auth/auth.service";
import { CommonDataService } from "./common-data-service";
import { DateUtilsService } from "./date-utils.service";
import { StringUtilsService } from "./string-utils.service";
import { FileUtilsService } from "../file-utils.service";
import { AwsFileUploadResponse } from "../models/aws-object.model";

describe("FileUploadService email attachments", () => {
  const publicOrigin = "https://group.example.org.uk/";
  const upload = {responses: [{fileNameData: {rootFolder: "email-attachments", awsFileName: "example.pdf"}}]} as AwsFileUploadResponse;

  it.each([
    "/api/aws/s3/email-attachments/example.pdf",
    "https://group.example.org.uk/api/aws/s3/email-attachments/example.pdf"
  ])("builds a usable public attachment URL from %s", resourcePath => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: UrlService, useValue: {
          publicBaseUrl: () => publicOrigin,
          resourceRelativePathForAWSFileName: () => resourcePath,
          absoluteUrlFor: UrlService.prototype.absoluteUrlFor,
          isRemoteUrl: (url: string) => /^https?:/.test(url)
        }},
        ...[AuthService, CommonDataService, DateUtilsService, StringUtilsService, FileUtilsService].map(provide => ({provide, useValue: {}}))
      ]
    });
    const attachment = TestBed.inject(FileUploadService).emailAttachmentFromUpload(upload, "Example.pdf", 1234);
    expect(attachment).toEqual({name: "Example.pdf", sizeBytes: 1234, url: "https://group.example.org.uk/api/aws/s3/email-attachments/example.pdf"});
  });

  it("maps every uploaded file in a multi-file response", () => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: UrlService, useValue: {
          publicBaseUrl: () => publicOrigin,
          resourceRelativePathForAWSFileName: (path: string) => `/api/aws/s3/${path}`,
          absoluteUrlFor: UrlService.prototype.absoluteUrlFor,
          isRemoteUrl: (url: string) => /^https?:/.test(url)
        }},
        ...[AuthService, CommonDataService, DateUtilsService, StringUtilsService, FileUtilsService].map(provide => ({provide, useValue: {}}))
      ]
    });
    const response = {
      responses: [
        {fileNameData: {rootFolder: "email-attachments", awsFileName: "agenda.pdf"}, uploadedFile: {originalname: "Agenda.pdf", size: 11}},
        {fileNameData: {rootFolder: "email-attachments", awsFileName: "minutes.pdf"}, uploadedFile: {originalname: "Minutes.pdf", size: 22}}
      ]
    } as AwsFileUploadResponse;
    expect(TestBed.inject(FileUploadService).emailAttachmentsFromUpload(response, "fallback.pdf", 1)).toEqual([
      {name: "Agenda.pdf", sizeBytes: 11, url: "https://group.example.org.uk/api/aws/s3/email-attachments/agenda.pdf"},
      {name: "Minutes.pdf", sizeBytes: 22, url: "https://group.example.org.uk/api/aws/s3/email-attachments/minutes.pdf"}
    ]);
  });
});
