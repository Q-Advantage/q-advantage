// web/lib/csv.ts
//
// Minimal client-side CSV export. No server round-trip, no new
// infrastructure — matches the repo's existing zero-infrastructure pattern
// (contact form, Q-Day feedback form: mailto/client-only, no new secrets).

/** Escape a single CSV field per RFC 4180: wrap in quotes if it contains a
 * comma, quote, or newline; double any embedded quotes. */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\r\n");
}

/** Triggers a browser download of `content` as `filename`. Client-only —
 * call from inside a "use client" component's event handler. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
