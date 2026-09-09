function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Convert plain text into Confluence storage-format XHTML paragraphs. */
export function textToStorageValue(text: string): string {
  const paragraphs = String(text ?? "").split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => {
      if (!paragraph) return "<p></p>";
      const withLineBreaks = paragraph.split("\n").map(escapeHtml).join("<br />");
      return `<p>${withLineBreaks}</p>`;
    })
    .join("");
}

/** Accept plain text or storage body object and normalize to Confluence storage body. */
export function toStorageBody(value: unknown): { representation: "storage"; value: string } | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return { representation: "storage", value: textToStorageValue(value) };

  if (typeof value === "object") {
    const body = value as { representation?: unknown; value?: unknown };
    if (body.representation === "storage" && typeof body.value === "string") {
      return { representation: "storage", value: body.value };
    }
  }

  throw new Error("Expected a plain text string or a storage body object with representation=storage.");
}
