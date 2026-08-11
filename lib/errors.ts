export class BusinessError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "BusinessError";
    this.statusCode = statusCode;
  }
}
