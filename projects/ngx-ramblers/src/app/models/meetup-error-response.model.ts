export interface MeetupErrorResponse {
  status: number;
  response: {
    req: {
      method: string;
      url: string;
      headers: {
        "user-agent": string;
        accept: string
      };
    };
    header: object;
    status: number;
    text?: {
      details: string;
      code: string;
      problem: string;
    };
  };
}
