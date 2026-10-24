import { describe, expect, it } from "vitest";
import { awsImageResourcePath, resourceAwsImageUrls, storedAwsImagePath, storedAwsImageUrls } from "./aws-image-paths";

describe("managed image storage and rendering paths", () => {
  it("stores only the object key from legacy relative and absolute proxy URLs", () => {
    ["api/aws/s3/site-content/preview.png", "/api/aws/s3/site-content/preview.png", "https://group.example.org.uk/api/aws/s3/site-content/preview.png"]
      .forEach(path => expect(storedAwsImagePath(path)).toBe("site-content/preview.png"));
  });

  it("round-trips Markdown and sized HTML images without saving the API prefix", () => {
    const input = `![App](api/aws/s3/site-content/app.png)\n<img src = '/api/aws/s3/logos/group.png' width="240">`;
    const stored = storedAwsImageUrls(input);
    expect(stored).toBe(`![App](site-content/app.png)\n<img src = 'logos/group.png' width="240">`);
    expect(stored).not.toContain("api/aws/s3/");
    const rendered = resourceAwsImageUrls(stored);
    expect(rendered).toContain("![App](/api/aws/s3/site-content/app.png)");
    expect(rendered).toContain("src = '/api/aws/s3/logos/group.png'");
    expect(storedAwsImageUrls(rendered)).toBe(stored);
  });

  it("does not reinterpret external, embedded or unrelated image addresses", () => {
    ["https://images.example.com/photo.png", "https://other.example.com/api/aws/s3/site-content/photo.png", "data:image/png;base64,aGVsbG8=", "cid:photo", "assets/photo.png"]
      .forEach(path => expect(awsImageResourcePath(path)).toBe(path));
    expect(storedAwsImagePath("https://images.example.com/photo.png")).toBe("https://images.example.com/photo.png");
  });
});
