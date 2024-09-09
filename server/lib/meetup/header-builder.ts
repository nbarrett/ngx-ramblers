import querystring from "querystring";
import { ContentType, Header } from "../shared/server-models";

export class HeaderBuilder {
  header: Header = {};

  static create(): HeaderBuilder {
    return new HeaderBuilder();
  }

  withContentType(contentType: ContentType): HeaderBuilder {
    this.header["Content-Type"] = contentType;
    return this;
  }

  withAuthorisation(accessToken: string, body?: any): HeaderBuilder {
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
