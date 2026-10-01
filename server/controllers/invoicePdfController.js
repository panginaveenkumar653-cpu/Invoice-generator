const PDFDocument = require('pdfkit');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

const PAGE_MARGIN = 48;
const COLORS = {
  ink: '#1f2937',
  muted: '#667085',
  accent: '#245d62',
  light: '#f3f6fa',
  rule: '#d8dee8',
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

function safeInvoiceFilename(invoiceNumber) {
  return String(invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function drawTableHeader(doc, x, y, widths) {
  const headers = ['Description', 'Qty', 'Rate', 'Amount'];
  doc.save();
  doc.rect(x, y, widths.reduce((sum, width) => sum + width, 0), 26).fill(COLORS.light);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink);
  let columnX = x;
  headers.forEach((label, index) => {
    doc.text(label, columnX + 7, y + 8, {
      width: widths[index] - 14,
      align: index === 0 ? 'left' : 'right',
    });
    columnX += widths[index];
  });
  doc.restore();
  return y + 26;
}

function createInvoicePdf(invoice, businessName, res) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: false });
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const right = pageWidth - PAGE_MARGIN;
  const bottom = doc.page.height - PAGE_MARGIN;

  doc.on('error', (error) => res.destroy(error));
  doc.pipe(res);

  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(20)
    .text(businessName || 'Invoice', PAGE_MARGIN, 48, { width: 300 });
  doc.fillColor(COLORS.ink).fontSize(25)
    .text('INVOICE', right - 160, 47, { width: 160, align: 'right' });
  doc.moveTo(PAGE_MARGIN, 91).lineTo(right, 91).strokeColor(COLORS.rule).stroke();

  let y = 108;
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('INVOICE NUMBER', PAGE_MARGIN, y);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11)
    .text(String(invoice.invoiceNumber), PAGE_MARGIN, y + 14, { width: 220 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('ISSUE DATE', PAGE_MARGIN + 250, y);
  doc.fillColor(COLORS.ink).fontSize(10).text(formatDate(invoice.issueDate), PAGE_MARGIN + 250, y + 14);
  doc.fillColor(COLORS.muted).fontSize(9).text('DUE DATE', PAGE_MARGIN + 365, y);
  doc.fillColor(COLORS.ink).fontSize(10).text(formatDate(invoice.dueDate), PAGE_MARGIN + 365, y + 14);

  y += 55;
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('STATUS', PAGE_MARGIN, y);
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(10)
    .text(String(invoice.status || 'draft').toUpperCase(), PAGE_MARGIN, y + 13);

  y += 45;
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(11).text('BILL TO', PAGE_MARGIN, y);
  y += 18;
  const client = invoice.client || {};
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11)
    .text(client.name || 'Client', PAGE_MARGIN, y, { width: contentWidth });
  y += 16;
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10);
  if (client.email) {
    doc.text(client.email, PAGE_MARGIN, y, { width: contentWidth });
    y += 14;
  }
  if (client.address) {
    doc.text(client.address, PAGE_MARGIN, y, { width: contentWidth });
    y = doc.y + 8;
  } else {
    y += 10;
  }

  const tableX = PAGE_MARGIN;
  const widths = [contentWidth * 0.48, contentWidth * 0.12, contentWidth * 0.20, contentWidth * 0.20];
  y += 8;
  y = drawTableHeader(doc, tableX, y, widths);

  for (const item of invoice.items || []) {
    const description = String(item.description || '');
    const descriptionHeight = doc.font('Helvetica').fontSize(9)
      .heightOfString(description, { width: widths[0] - 14 });
    const rowHeight = Math.max(27, descriptionHeight + 12);
    if (y + rowHeight > bottom - 10) {
      doc.addPage();
      y = PAGE_MARGIN;
      y = drawTableHeader(doc, tableX, y, widths);
    }

    let x = tableX;
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink)
      .text(description, x + 7, y + 7, { width: widths[0] - 14 });
    x += widths[0];
    doc.text(String(item.quantity ?? ''), x + 5, y + 7, { width: widths[1] - 10, align: 'right' });
    x += widths[1];
    doc.text(formatAmount(item.rate), x + 5, y + 7, { width: widths[2] - 10, align: 'right' });
    x += widths[2];
    doc.text(formatAmount(item.amount), x + 5, y + 7, { width: widths[3] - 10, align: 'right' });
    y += rowHeight;
    doc.moveTo(tableX, y).lineTo(right, y).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
  }

  if (y + 105 > bottom) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  y += 18;
  const totalsLabelX = right - 190;
  const totalsValueX = right - 90;
  const drawTotal = (label, value, isFinal = false) => {
    doc.font(isFinal ? 'Helvetica-Bold' : 'Helvetica').fontSize(isFinal ? 12 : 10)
      .fillColor(isFinal ? COLORS.ink : COLORS.muted).text(label, totalsLabelX, y, { width: 100 });
    doc.font(isFinal ? 'Helvetica-Bold' : 'Helvetica').fontSize(isFinal ? 12 : 10)
      .fillColor(isFinal ? COLORS.ink : COLORS.muted)
      .text(value, totalsValueX, y, { width: 90, align: 'right' });
    y += isFinal ? 23 : 18;
  };
  drawTotal('Subtotal', formatAmount(invoice.subtotal));
  drawTotal(`Tax (${formatAmount(invoice.taxRate)}%)`, formatAmount(invoice.taxAmount));
  doc.moveTo(totalsLabelX, y - 3).lineTo(right, y - 3).strokeColor(COLORS.rule).stroke();
  y += 5;
  drawTotal('TOTAL', formatAmount(invoice.total), true);

  if (invoice.notes) {
    if (y + 65 > bottom) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    y += 16;
    doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(10).text('NOTES', PAGE_MARGIN, y);
    y += 16;
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9)
      .text(String(invoice.notes), PAGE_MARGIN, y, { width: contentWidth });
  }

  doc.end();
}

async function downloadInvoicePdf(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
    return res.status(404).json({ message: 'Invoice not found' });
  }

  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.id })
      .populate('client', 'name email address');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const user = await User.findById(req.user.id).select('businessName');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const filename = `invoice-${safeInvoiceFilename(invoice.invoiceNumber)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return createInvoicePdf(invoice, user.businessName, res);
  } catch (_error) {
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Unable to generate invoice PDF' });
    }
    return res.destroy();
  }
}

module.exports = { downloadInvoicePdf };
