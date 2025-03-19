export class UploadError {
  constructor(public rows: string, public message: string) {
  }

  toString = () => `row ${this.rows}: ${this.message}`;

}

