export const FILES_CHANGED_EVENT = "beam:files-changed";

export function notifyFilesChanged() {
  window.dispatchEvent(new Event(FILES_CHANGED_EVENT));
}
