/**
 * Uploaded documents — the parts both sides of the wire need.
 *
 * The browser checks the size before it spends a minute uploading something
 * that will be rejected, and the server checks it again because the browser is
 * not to be trusted. Both read the limit from here so they can never disagree.
 */

/** Anything a document can be attached to. */
export type AttachmentEntity = "task" | "project" | "decision" | "review" | "idea" | "note";

export const ATTACHMENT_ENTITIES: readonly AttachmentEntity[] = [
  "task",
  "project",
  "decision",
  "review",
  "idea",
  "note",
];

export function isAttachmentEntity(value: string): value is AttachmentEntity {
  return (ATTACHMENT_ENTITIES as readonly string[]).includes(value);
}

/** Per-file ceiling. Comfortably inside the hosted database's request limits. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/** Human-readable size. Files are shown in the units people actually think in. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
