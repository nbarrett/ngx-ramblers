import { ContentType, Header } from "./models";
import querystring from "querystring";

export class HeaderBuilder {
  header: Header = {};

  withContentType(contentType: ContentType) {
    this.header["Content-Type"] = contentType;
    return this;
  }

  withAuthorisation(accessToken: string, body?: any) {
    this.header["Authorization"] = "bearer " + accessToken;
    if (body) {
      const formData = querystring.stringify(body);
      this.header["Content-Length"] = formData.length;
    }
    return this;
  }

  build() {
    return this.header;
  }
}
