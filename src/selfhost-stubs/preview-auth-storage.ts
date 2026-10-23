// Self-hosted build stand-in for the Lovable editor preview session broker. Normal browser storage is used.
export interface PreviewAuthStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}
export function brokeredPreviewStorage(): PreviewAuthStorage | undefined {
  return undefined;
}
