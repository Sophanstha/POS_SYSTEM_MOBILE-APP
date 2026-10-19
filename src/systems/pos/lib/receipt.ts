import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { OutletDetails } from "../types/pos";

export interface ReceiptLine {
  name: string;
  quantity: number;
  amount: number;
}

export interface ReceiptSection {
  /** e.g. "PAID EARLIER (BY ITEM)"; no title = plain item list. */
  title?: string;
  lines: ReceiptLine[];
}

/** Everything printed on a receipt (same content as the web's receipt PDF). */
export interface ReceiptData {
  businessName: string;
  address?: string | null;
  phone?: string | null;
  date: Date;
  orderType: "Dine-in" | "Takeaway";
  orderNumbers: number[];
  table?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  sections: ReceiptSection[];
  /** Rows above the grand total: subtotal, tax, paid earlier… */
  totals: { label: string; amount: number }[];
  grandTotal: number;
  payment?: { method: string; tendered?: number; change?: number };
}

/** Header of every receipt: the outlet's name, address and phone. */
export function receiptHeader(outlet: OutletDetails | undefined, fallbackName: string | undefined) {
  return {
    businessName: outlet?.name ?? fallbackName ?? "POS",
    address: outlet?.address,
    phone: outlet?.phone,
  };
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
const money = (n: number) => `Rs. ${n.toFixed(2)}`;
const row = (label: string, value: string) => `<div class="row"><span>${label}</span><span>${value}</span></div>`;

/** 80 mm thermal-style receipt, black on white, like the web PDF. */
export function receiptHtml(r: ReceiptData): string {
  const info = [
    row("Date:", esc(r.date.toLocaleString())),
    r.orderNumbers.length
      ? row(r.orderNumbers.length > 1 ? "Orders:" : "Order:", r.orderNumbers.map((n) => `#${n}`).join(", "))
      : "",
    row("Type:", r.orderType),
    r.table ? row("Table:", `<b>${esc(r.table)}</b>`) : "",
    r.customerName ? row("Customer:", esc(r.customerName)) : "",
    r.customerPhone ? row("Phone:", esc(r.customerPhone)) : "",
  ].join("");

  const items = r.sections
    .map(
      (section) =>
        (section.title ? `<tr><td colspan="3" class="section">${esc(section.title)}</td></tr>` : "") +
        section.lines
          .map(
            (line) =>
              `<tr><td><b>${esc(line.name)}</b></td><td class="qty">${line.quantity}</td><td class="amt">${money(line.amount)}</td></tr>`,
          )
          .join(""),
    )
    .join("");

  const totals = r.totals.map((t) => row(esc(t.label), money(t.amount))).join("");

  const payment = r.payment
    ? `<div class="block">
        ${row("Payment Method:", `<b>${esc(r.payment.method.toUpperCase())}</b>`)}
        ${r.payment.tendered !== undefined ? row("Cash Tendered:", money(r.payment.tendered)) : ""}
        ${r.payment.change !== undefined ? row("Change:", money(r.payment.change)) : ""}
      </div>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 4mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #000; background: #fff; font-family: "Courier New", Courier, monospace; font-size: 10.5px; line-height: 1.4; }
  .receipt { max-width: 300px; margin: 0 auto; padding: 12px 6px; }
  .center { text-align: center; }
  h1 { margin: 0 0 2px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
  .muted { color: #555; font-size: 9px; }
  .label { margin: 6px 0 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #555; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
  .block { border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; }
  .info { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 4px; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 4px 0 8px; }
  th { font-weight: bold; padding: 6px 0; border-bottom: 1px dashed #000; }
  td { padding: 5px 0; vertical-align: top; word-break: break-word; border-bottom: 1px dotted #ccc; }
  .qty { text-align: center; width: 14%; }
  .amt { text-align: right; width: 32%; font-weight: bold; }
  .section { padding-top: 10px; font-size: 8px; font-weight: bold; color: #555; letter-spacing: 0.5px; border-bottom: none; }
  .grand { display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #000; font-weight: bold; }
  .grand span:last-child { font-size: 14px; }
  .thanks { margin-top: 14px; font-size: 9px; text-align: center; letter-spacing: 1px; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <h1>${esc(r.businessName)}</h1>
      ${r.address ? `<div class="muted">${esc(r.address)}</div>` : ""}
      ${r.phone ? `<div class="muted">Tel: ${esc(r.phone)}</div>` : ""}
      <div class="label">Receipt</div>
    </div>
    <div class="info">${info}</div>
    <table>
      <thead><tr><th style="text-align:left">ITEM</th><th class="qty">QTY</th><th class="amt">TOTAL</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    <div class="block">
      ${totals}
      <div class="grand"><span>GRAND TOTAL</span><span>${money(r.grandTotal)}</span></div>
    </div>
    ${payment}
    <div class="thanks">THANK YOU · PLEASE VISIT AGAIN</div>
  </div>
</body>
</html>`;
}

/** 80 mm receipt paper, in PDF points. */
const PDF_WIDTH = 227;

/** Tall enough for every line, so the PDF is one long receipt instead of pages. */
function pdfHeight(r: ReceiptData): number {
  const lines = r.sections.reduce((n, s) => n + s.lines.length + (s.title ? 1 : 0), 0);
  return 380 + lines * 30 + r.totals.length * 16 + (r.payment ? 60 : 0);
}

/** Opens the phone's print screen (Wi-Fi / Bluetooth printers, or "Save as PDF"). */
export async function printReceipt(r: ReceiptData): Promise<void> {
  await Print.printAsync({ html: receiptHtml(r) });
}

/** Makes a PDF and opens the share sheet (WhatsApp, Viber, email, Files…). */
export async function shareReceipt(r: ReceiptData): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: receiptHtml(r), width: PDF_WIDTH, height: pdfHeight(r) });
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share receipt" });
}