// Self-hosted build stand-in: errors are only logged to the browser console.
export function reportLovableError(error: unknown, _context: Record<string, unknown> = {}) {
  console.error(error);
}
