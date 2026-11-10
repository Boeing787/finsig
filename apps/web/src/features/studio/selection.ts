/**
 * The evidence the investigation is showing: a bridge factor, or the records an AI claim cites.
 *
 * AG Studio reads `context` once, so the page and the bridge widget share this small store rather
 * than a prop. The page turns the selection into Studio's drill-through filter on `record_id`.
 */
export interface EvidenceSelection {
  /** Bridge factor ID (for example `client_delta:lumen`), or `claim:<n>` for an AI claim. */
  id: string;
  label: string;
  recordIds: string[];
}

export interface EvidenceStore {
  get(): EvidenceSelection | null;
  set(selection: EvidenceSelection | null): void;
  subscribe(listener: () => void): () => void;
}

export function createEvidenceStore(): EvidenceStore {
  let current: EvidenceSelection | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(selection) {
      current = selection;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
