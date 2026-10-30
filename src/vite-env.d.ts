/// <reference types="vite/client" />

type ReaderResponse<T> = { kind: 'json'; data: T } | { kind: 'image'; contentType: string; data: string };
type ReaderRequestOptions = { method?: 'GET' | 'PUT' | 'POST' | 'DELETE'; body?: unknown };
type UpdateStatus = { status: 'unsupported' | 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'; currentVersion: string; availableVersion?: string; message?: string; percent?: number };
interface Window {
  desktop: {
    request<T = unknown>(path: string, options?: ReaderRequestOptions): Promise<ReaderResponse<T>>;
    login(credentials: { email: string; password: string }): Promise<{ id: string; email: string; name: string }>;
    session(): Promise<{ id: string; email: string; name: string } | null>;
    logout(): Promise<void>;
    openSite(): void;
    version(): Promise<string>;
    update: {
      getStatus(): Promise<UpdateStatus>;
      check(): Promise<UpdateStatus>;
      download(): Promise<UpdateStatus>;
      install(): Promise<void>;
      onStatus(callback: (status: UpdateStatus) => void): () => void;
    };
    windowAction(action: 'minimize' | 'toggle-maximize' | 'close'): void;
  };
}
