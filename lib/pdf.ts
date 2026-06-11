export async function extractPdfText(file: File) {
  if (file.type !== "application/pdf") {
    return "";
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true
  }).promise;

  const pages: string[] = [];
  const pageLimit = Math.min(document.numPages, 12);

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      pages.push(text);
    }
  }

  return pages.join("\n\n").slice(0, 18000);
}
