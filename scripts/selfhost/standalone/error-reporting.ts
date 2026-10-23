// Standalone build: render errors are logged to the browser console only.
export function reportError(error: unknown, _context: Record<string, unknown> = {}) {
  console.error(error);
}
