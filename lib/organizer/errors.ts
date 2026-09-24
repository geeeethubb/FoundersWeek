/**
 * Expected failures of organizer actions (not found, conflicts). Thrown inside transactions so
 * the transaction rolls back; route handlers turn them into JSON responses with this status.
 */
export class OrganizerActionError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "OrganizerActionError";
  }
}
