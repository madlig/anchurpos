/**
 * Utility for isolated document printing via hidden iframe.
 * Prevents parent layout nesting, navigation bars, and background colors from bleeding into printouts.
 */
export function printElement(elementId: string, title?: string) {
  if (typeof window === "undefined") return;

  const el = document.getElementById(elementId);
  if (!el) {
    window.print();
    return;
  }

  const cleanTitle = title || document.title || "Dokumen_Cetak";

  // Create isolated hidden iframe
  const iframe = document.createElement("iframe");
  iframe.setAttribute("style", "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  // Extract all stylesheets and style rules from current page
  const styleTags = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
    .map((s) => s.outerHTML)
    .join("\n");

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${cleanTitle}</title>
        ${styleTags}
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .salary-slip-doc {
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div id="print-root" style="padding: 0; margin: 0 auto;">
          ${el.innerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Allow styles and fonts to render, then trigger print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Iframe print failed, falling back to window.print():", e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 300);
}
