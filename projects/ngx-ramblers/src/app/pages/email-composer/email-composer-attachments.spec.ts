import {FileUploadService} from "../../services/file-upload.service";
import {EmailAttachment, emailAttachmentSupported} from "../../models/mail.model";

describe("unionEmailAttachments", () => {
  it("keeps every distinct attachment when several uploads finish", () => {
    const service = Object.create(FileUploadService.prototype) as FileUploadService;
    const first: EmailAttachment = {name: "Agenda.pdf", url: "https://group.example.org.uk/a.pdf", sizeBytes: 11};
    const second: EmailAttachment = {name: "Minutes.pdf", url: "https://group.example.org.uk/b.pdf", sizeBytes: 22};
    expect(service.unionEmailAttachments([first], [second, first])).toEqual([first, second]);
  });
});

describe("emailAttachmentSupported", () => {
  it("allows zip and pdf and rejects markdown", () => {
    expect(emailAttachmentSupported("notes.pdf")).toBe(true);
    expect(emailAttachmentSupported("notes.zip")).toBe(true);
    expect(emailAttachmentSupported("brevo-bounce-reply.md")).toBe(false);
  });
});
