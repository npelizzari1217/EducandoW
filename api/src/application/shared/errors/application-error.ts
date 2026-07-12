export abstract class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 422,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
