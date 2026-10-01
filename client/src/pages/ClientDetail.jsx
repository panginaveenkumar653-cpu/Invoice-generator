import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';

export default function ClientDetail() {
  const showToast = useToast();
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/api/clients/${id}`),
      api.get(`/api/clients/${id}/invoices`, { params: { page: 1, limit: 10 } }),
    ])
      .then(([clientResponse, invoiceResponse]) => {
        if (!active) return;
        setClient(clientResponse.data.data);
        setInvoices(invoiceResponse.data.data);
        setInvoiceTotal(invoiceResponse.data.total);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || 'Unable to load this client. Please try again.');
        showToast(requestError.response?.data?.message || 'Unable to load this client. Please try again.', 'error');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id, showToast]);

  if (loading) return <LoadingSpinner label="Loading client…" />;
  if (error) return <section className="clients-page"><div className="client-alert" role="alert">{error}</div><Link to="/clients">Back to clients</Link></section>;
  if (!client) return null;

  return (
    <section className="clients-page client-detail-page">
      <Link className="back-link" to="/clients">← All clients</Link>
      <header className="section-header detail-header">
        <div>
          <p className="eyebrow">CLIENT</p>
          <h1>{client.name}</h1>
          <p className="section-subtitle">{client.email}</p>
        </div>
        <Link className="button button-primary" to={`/invoices/new?client=${encodeURIComponent(client._id)}`}>
          New invoice for this client
        </Link>
      </header>

      <section className="detail-card" aria-labelledby="client-info-heading">
        <h2 id="client-info-heading">Contact information</h2>
        <dl className="client-info-grid">
          <div><dt>Email</dt><dd>{client.email}</dd></div>
          <div><dt>Phone</dt><dd>{client.phone || '—'}</dd></div>
          <div className="address-info"><dt>Address</dt><dd>{client.address || '—'}</dd></div>
        </dl>
      </section>

      <section className="detail-invoices" aria-labelledby="client-invoices-heading">
        <div className="subsection-heading">
          <div><p className="eyebrow">HISTORY</p><h2 id="client-invoices-heading">Invoices</h2></div>
          <span>{invoiceTotal} {invoiceTotal === 1 ? 'invoice' : 'invoices'}</span>
        </div>
        {invoices.length === 0 ? (
          <EmptyState compact title="No invoices for this client yet" description="New invoices for this client will appear here." />
        ) : (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead><tr><th>Invoice</th><th>Issue date</th><th>Status</th><th className="align-right">Total</th></tr></thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td><Link className="client-name-link" to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link></td>
                    <td>{formatDate(invoice.issueDate)}</td>
                    <td><span className={`status-pill status-${invoice.status}`}>{invoice.status}</span></td>
                    <td className="align-right">{formatCurrency(invoice.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invoiceTotal > invoices.length && <p className="detail-list-note">Showing the 10 most recent invoices.</p>}
          </div>
        )}
      </section>
    </section>
  );
}
