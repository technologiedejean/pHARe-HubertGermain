// >>> NOUVEAU FICHIER : types/html2pdf.d.ts <<<
// Déclaration minimale pour html2pdf.js (le paquet n'embarque pas de types).
declare module "html2pdf.js" {
  type Html2PdfOptions = {
    filename?: string;
    margin?: number | number[];
    image?: { type?: "jpeg" | "png" | "webp"; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: { unit?: string; format?: string | number[]; orientation?: "portrait" | "landscape" };
    pagebreak?: { mode?: string | string[]; before?: string | string[]; after?: string | string[]; avoid?: string | string[] };
  };
  interface Html2PdfInstance {
    set(opts: Html2PdfOptions): Html2PdfInstance;
    from(src: HTMLElement | string): Html2PdfInstance;
    save(filename?: string): Promise<void>;
    outputPdf(type?: string): Promise<unknown>;
  }
  function html2pdf(): Html2PdfInstance;
  export default html2pdf;
}