"use client";

import { useRef, useState } from "react";
import { ActionButton } from "@/components/forms";
import { deleteAttachment, uploadAttachment } from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_BYTES, formatBytes, type AttachmentEntity } from "@/lib/core/files";
import type { Attachment } from "@/lib/types";

/**
 * Documents attached to a record.
 *
 * A plain file input rather than a drag-and-drop surface: on a phone the input
 * opens the camera, the files app and cloud storage, which is more than a drop
 * zone can do.
 */

export function UploadDocument({
  entityType,
  entityId,
}: {
  entityType: AttachmentEntity;
  entityId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ name: string; size: number } | null>(null);

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const data = new FormData(event.currentTarget);
        const file = data.get("file");
        if (!(file instanceof File) || file.size === 0) {
          setError("Choose a file first.");
          return;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setError(
            `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_ATTACHMENT_BYTES)} per document.`,
          );
          return;
        }
        setPending(true);
        const result = await uploadAttachment(data);
        setPending(false);
        if (result.ok) {
          formRef.current?.reset();
          setChosen(null);
        } else {
          setError(result.error);
        }
      }}
    >
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />

      <label className="block">
        <span className="label mb-2 block">Document</span>
        <input
          type="file"
          name="file"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            setChosen(f ? { name: f.name, size: f.size } : null);
            setError(null);
          }}
        />
        <span className="mt-1.5 block text-[0.6875rem] text-ink-ghost">
          {chosen
            ? `${chosen.name} · ${formatBytes(chosen.size)}`
            : "Anything up to 4 MB — a PDF, a spreadsheet, a photo of a whiteboard."}
        </span>
      </label>

      <label className="block">
        <span className="label mb-2 block">What is it?</span>
        <input type="text" name="note" placeholder="Optional — e.g. “Signed proposal”" />
      </label>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </button>

      {error ? (
        <p role="alert" className="border-l border-critical pl-3 text-xs leading-relaxed text-critical">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function DocumentList({
  documents,
  entityType,
  entityId,
}: {
  documents: Attachment[];
  entityType: AttachmentEntity;
  entityId: string;
}) {
  if (documents.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        No documents yet. Anything uploaded here stays attached to this record.
      </p>
    );
  }

  return (
    <div className="space-y-px">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between gap-4 border-b border-line-soft py-3 last:border-b-0"
        >
          <div className="min-w-0">
            <a
              href={`/api/attachments/${doc.id}`}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm text-ink transition-colors hover:text-ink-dim"
            >
              {doc.filename}
            </a>
            <p className="numeral mt-1 text-[0.6875rem] text-ink-ghost">
              {formatBytes(doc.size_bytes)}
              {doc.note ? ` · ${doc.note}` : ""}
            </p>
          </div>
          <ActionButton
            action={() => deleteAttachment(doc.id, entityType, entityId)}
            variant="ghost"
            confirm={`Delete ${doc.filename}?`}
          >
            Delete
          </ActionButton>
        </div>
      ))}
    </div>
  );
}
