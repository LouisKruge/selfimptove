"use server";

import { db } from "@/lib/db";
import { remove } from "@/lib/db/repo";
import { newId } from "@/lib/core/ids";
import { nowIso } from "@/lib/core/date";
import { MAX_ATTACHMENT_BYTES, formatBytes, isAttachmentEntity } from "@/lib/core/files";
import { refreshPaths } from "./revalidate";
import { fail, ok, type ActionResult } from "./shared";

/**
 * Uploading a document.
 *
 * The file is read into memory and written to the database as a blob. That is
 * the right trade at this size: no second service to configure, no credentials
 * to keep in sync, and the document is backed up with everything else.
 */

export async function uploadAttachment(form: FormData): Promise<ActionResult> {
  const entityType = String(form.get("entity_type") ?? "");
  const entityId = String(form.get("entity_id") ?? "");
  const note = String(form.get("note") ?? "").trim();
  const file = form.get("file");

  if (!isAttachmentEntity(entityType) || !entityId) return fail("Missing what to attach this to.");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file to upload.");

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return fail(
      `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_ATTACHMENT_BYTES)} per document.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ts = nowIso();

  const client = await db();
  await client.execute({
    sql: `INSERT INTO attachments
            (id, entity_type, entity_id, filename, mime_type, size_bytes, content, note,
             created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      newId(),
      entityType,
      entityId,
      file.name || "document",
      file.type || "application/octet-stream",
      bytes.byteLength,
      bytes,
      note === "" ? null : note,
      ts,
      ts,
    ],
  });

  refreshPaths([`/${entityType}s/${entityId}`, `/tasks/${entityId}`]);
  return ok();
}

export async function deleteAttachment(id: string, entityType: string, entityId: string): Promise<ActionResult> {
  await remove("attachments", id);
  refreshPaths([`/${entityType}s/${entityId}`, `/tasks/${entityId}`]);
  return ok();
}
