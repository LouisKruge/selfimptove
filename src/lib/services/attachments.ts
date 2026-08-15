import "server-only";

import { all, get } from "@/lib/db";
import type { AttachmentEntity } from "@/lib/core/files";
import type { Attachment } from "@/lib/types";

/**
 * Uploaded documents.
 *
 * Bytes are stored in the database, so a document travels with the record it
 * belongs to and needs no second service to be configured, paid for or kept in
 * sync. Listing never selects `content` — a task page that reads five documents
 * into memory to render their filenames would be slow for no reason.
 *
 * The size limit and byte formatting live in `core/files` because the browser
 * needs them too, and this module may never be imported from a client
 * component.
 */

export async function listAttachments(
  entityType: AttachmentEntity,
  entityId: string,
): Promise<Attachment[]> {
  return all<Attachment>(
    `SELECT id, entity_type, entity_id, filename, mime_type, size_bytes, note,
            created_at, updated_at
       FROM attachments
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC`,
    [entityType, entityId],
  );
}

export interface AttachmentContent {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** The file itself. Only the download route needs this. */
export async function attachmentContent(id: string): Promise<AttachmentContent | undefined> {
  const row = await get<{ filename: string; mime_type: string; content: unknown }>(
    "SELECT filename, mime_type, content FROM attachments WHERE id = ?",
    [id],
  );
  if (!row) return undefined;

  return { filename: row.filename, mimeType: row.mime_type, bytes: toBytes(row.content) };
}

/** libSQL hands blobs back as ArrayBuffer locally and as a Buffer over HTTP. */
function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array();
}
