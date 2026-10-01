import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';

export default function InvoiceDetail() {
  const showToast = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/invoices/${id}`)
      .then(({ data }) => { if (active) setInvoice(data.data); })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.response?.status === 404) {
          navigate('/invoices', { replace: true, state: { message: 'Invoice not found.' } });
          return;
        }
        const message = requestError.response?.data?.message || 'Unable to load this invoice. Please try again.';
        setError(message);
        showToast(message, 'error');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, navigate, showToast]);

  async function markPaid() {
    setWorking(true);
    setError('');
    try {
      const { data } = await api.patch(`/api/invoices/${id}/status`, { status: 'paid' });
      setInvoice(data.data);
      showToast('Invoice marked as paid.');
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        navigate('/invoices', { replace: true, state: { message: 'Invoice not found.' } });
        return;
      }
      const message = requestError.response?.data?.message || 'Unable to update invoice status.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setWorking(false);
    }
  }

  async function downloadPdf() {
    setWorking(true);
    setError('');
    try {
      const response = await api.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `invoice-${invoice.invoiceNumber}.pdf`;
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      showToast('Invoice PDF downloaded.');
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        navigate('/invoices', { replace: true, state: { message: 'Invoice not found.' } });
        return;
      }
      const message = 'Unable to download this invoice PDF. Please try again.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setWorking(false);
    }
  }

  async function deleteInvoice() {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`)) return;
    setWorking(true);
    setError('');
    try {
      await api.delete(`/api/invoices/${id}`);
      showToast('Invoice deleted.');
      navigate('/invoices', { replace: true, state: { message: 'Invoice deleted successfully.' } });
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        navigate('/invoices', { replace: true, state: { message: 'Invoice not found.' } });
        return;
      }
      const message = requestError.response?.data?.message || 'Unable to delete this invoice.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading invoice…" />;
  if (error && !invoice) return <section className="clients-page"><div className="client-alert" role="alert">{error}</div><Link to="/invoices">Back to invoices</Link></section>;
  if (!invoice) return null;

  const client = invoice.client || {};
  return (
    <section className="invoice-detail-page">
      <Link className="back-link" to="/invoices">← All invoices</Link>
      <header className="section-header invoice-detail-header">
        <div>
          <p className="eyebrow">INVOICE</p>
          <h1>{invoice.invoiceNumber}</h1>
          <span className={`status-pill status-${invoice.status}`}>{invoice.status}</span>
        </div>
        <div className="invoice-detail-actions">
          <button className="button button-secondary" type="button" onClick={downloadPdf} disabled={working}>Download PDF</button>
          <Link className="button button-secondary" to={`/invoices/${id}/edit`}>Edit</Link>
          {invoice.status !== 'paid' && <button className="button button-primary" type="button" onClick={markPaid} disabled={working}>Mark as paid</button>}
          <button className="button button-danger" type="button" onClick={deleteInvoice} disabled={working}>Delete</button>
        </div>
      </header>
      {error && <div className="client-alert page-alert" role="alert">{error}</div>}

      <div className="invoice-detail-grid">
        <section className="detail-card invoice-bill-card">
          <div><p className="eyebrow">BILL TO</p><h2>{client.name || 'Client'}</h2></div>
          <p>{client.email || '—'}</p>
          {client.address && <p className="invoice-address">{client.address}</p>}
        </section>
        <section className="detail-card invoice-meta-card">
          <div><span>Issue date</span><strong>{formatDate(invoice.issueDate)}</strong></div>
          <div><span>Due date</span><strong>{formatDate(invoice.dueDate)}</strong></div>
          <div><span>Status</span><strong className={`status-text status-${invoice.status}`}>{invoice.status}</strong></div>
        </section>
      </div>

      <section className="invoice-lines-section">
        <h2>Line items</h2>
        <div className="client-table-wrap">
          <table className="client-table invoice-table">
            <thead><tr><th>Description</th><th className="align-right">Quantity</th><th className="align-right">Rate</th><th className="align-right">Amount</th></tr></thead>
            <tbody>
              {(invoice.items || []).map((item, index) => (
                <tr key={`${item.description}-${index}`}>
                  <td>{item.description}</td><td className="align-right">{item.quantity}</td>
                  <td className="align-right">{formatCurrency(item.rate)}</td><td className="align-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="invoice-detail-totals" aria-label="Invoice totals">
        <div><span>Subtotal</span><strong>{formatCurrency(invoice.subtotal)}</strong></div>
        <div><span>Tax ({invoice.taxRate}%)</span><strong>{formatCurrency(invoice.taxAmount)}</strong></div>
        <div className="invoice-grand-total"><span>Total</span><strong>{formatCurrency(invoice.total)}</strong></div>
      </section>
      {invoice.notes && <section className="detail-card invoice-notes"><h2>Notes</h2><p>{invoice.notes}</p></section>}
    </section>
  );
}
