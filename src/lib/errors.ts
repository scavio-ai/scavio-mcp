export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /** Where to top up, when the API sent one (402 responses do). */
    public readonly billingUrl?: string,
    /** The parsed JSON error body, when there was one. */
    public readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
