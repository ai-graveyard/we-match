const eventName = "wm:need-draft-change";
const unavailable = new Set<string>();
export const DRAFT_UNAVAILABLE = "unavailable";
export function subscribeDraft(listener: () => void) {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
export function readDraft(key: string): string | null {
  if (unavailable.has(key)) return DRAFT_UNAVAILABLE;
  try { return sessionStorage.getItem(key); } catch { return DRAFT_UNAVAILABLE; }
}
export function writeDraft(key: string, value: string | null) {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
    unavailable.delete(key);
  } catch { unavailable.add(key); }
  window.dispatchEvent(new Event(eventName));
}
