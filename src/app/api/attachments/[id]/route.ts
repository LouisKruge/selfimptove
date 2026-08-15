import { attachmentContent } from "@/lib/services/attachments";

/**
 * Serves an uploaded document.
 *
 * Sits behind the same lock as every other route — the proxy matcher covers
 * /api, so a document cannot be fetched by anyone who has not signed in, even
 * with the identifier in hand.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await attachmentContent(id);

  if (!file) return new Response("Not found", { status: 404 });

  // Filenames can contain anything; quote-escape and provide an ASCII fallback
  // so the header stays well-formed whatever the document is called.
  const ascii = file.filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(file.filename);

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`,
      // Private data behind a password — never let a shared cache hold it.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
