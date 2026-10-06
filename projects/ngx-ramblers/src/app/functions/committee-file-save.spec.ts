import { describe, expect, it } from "vitest";
import { CommitteeFile, CommitteeFileKind } from "../models/committee.model";
import { committeeFileForSave } from "./committee-file-save";

describe("committeeFileForSave", () => {
  it("keeps an attachment title when no file has been uploaded", () => {
    const file = {fileType: "Committee Meeting Minutes"} as CommitteeFile;
    expect(committeeFileForSave(CommitteeFileKind.ATTACHMENT, file, "ssssssss")).toEqual({
      fileType: "Committee Meeting Minutes",
      fileNameData: {title: "ssssssss"},
      document: null
    });
  });

  it("writes the title onto an existing uploaded file", () => {
    const file = {
      fileType: "Committee Meeting Minutes",
      fileNameData: {originalFileName: "notes.pdf", awsFileName: "abc.pdf", title: "old"}
    } as CommitteeFile;
    expect(committeeFileForSave(CommitteeFileKind.ATTACHMENT, file, "New title").fileNameData).toEqual({
      originalFileName: "notes.pdf",
      awsFileName: "abc.pdf",
      title: "New title"
    });
  });

  it("keeps composed document title and drops attachment data", () => {
    const file = {
      fileType: "Committee Meeting Minutes",
      fileNameData: {title: "file title"},
      document: {title: "Composed minutes", markdown: "Hello"}
    } as CommitteeFile;
    expect(committeeFileForSave(CommitteeFileKind.COMPOSED, file, "file title")).toEqual({
      fileType: "Committee Meeting Minutes",
      fileNameData: null,
      document: {title: "Composed minutes", markdown: "Hello"}
    });
  });
});
