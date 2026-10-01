import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';

const PAGE_SIZE = 10;
const STATUSES = ['draft', 'sent', 'paid', 'overdue'];

export default function Invoices() {
  const showToast = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(location.state?.message || '');
  const [updatingId, setUpdatingId] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadInvoices = useCallback(async (active = () => true) => {
    setLoading(true);
    setError((current) => location.state?.message || '');
    const endpoint = debouncedSearch ? '/api/invoices/search' : '/api/invoices';
    const params = { page, limit: PAGE_SIZE };
    if (debouncedSearch) params.q = debouncedSearch;
    if (status) params.status = status;

    try {
      const { data } = await api.get(endpoint, { params });
      if (!active()) return;
      setInvoices(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (requestError) {
      if (!active()) return;
      const message = requestError.response?.data?.message || 'Unable to load invoices. Please try again.';
      setError(message);
      showToast(message, 'error');
    } finally {
      if (active()) setLoading(false);
    }
  }, [debouncedSearch, location.state?.message, page, showToast, status]);

  useEffect(() => {
    let active = true;
    loadInvoices(() => active);
    return () => { active = false; };
  }, [loadInvoices]);

  async function changeStatus(invoiceId, nextStatus) {
    setUpdatingId(invoiceId);
    setError('');
    try {
      const { data } = await api.patch(`/api/invoices/${invoiceId}/status`, { status: nextStatus });
      setInvoices((current) => current.map((invoice) => invoice._id === invoiceId ? data.data : invoice));
      showToast(nextStatus === 'paid' ? 'Invoice marked as paid.' : `Invoice status changed to ${nextStatus}.`);
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to update invoice status.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <section className="invoices-page">
      <header className="section-header">
        <div>
          <p className="eyebrow">BILLING</p>
          <h1>Invoices</h1>
          <p className="section-subtitle">Create, track, and manage your invoices.</p>
        </div>
        <Link className="button button-primary" to="/invoices/new">New Invoice</Link>
      </header>

      {error && <div className="client-alert page-alert" role="alert">{error}</div>}

      <div className="invoice-filters">
        <label className="invoice-search">
          <span className="sr-only">Search invoices</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice number or client" />
        </label>
        <label className="status-filter">
          <span>Status</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading invoices…" />
      ) : invoices.length === 0 ? (
        <EmptyState
          title={total ? 'No invoices on this page' : 'No invoices found'}
          description={search || status ? 'Try changing your search or filter.' : 'Create your first invoice to get started.'}
          action={!search && !status ? <Link className="button button-primary" to="/invoices/new">Create an invoice</Link> : null}
        />
      ) : (
        <>
          <div className="client-table-wrap">
            <table className="client-table invoice-table">
              <thead><tr><th>Invoice</th><th>Client</th><th>Total</th><th>Status</th><th>Due date</th></tr></thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td><Link className="client-name-link" to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link></td>
                    <td>{invoice.client?.name || '—'}</td>
                    <td>{formatCurrency(invoice.total)}</td>
                    <td>
                      <select
                        className={`status-select status-${invoice.status}`}
                        value={invoice.status}
                        disabled={updatingId === invoice._id}
                        aria-label={`Status for invoice ${invoice.invoiceNumber}`}
                        onChange={(event) => changeStatus(invoice._id, event.target.value)}
                      >
                        {STATUSES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
                      </select>
                    </td>
                    <td>{formatDate(invoice.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="pagination-bar">
            <span>{total} {total === 1 ? 'invoice' : 'invoices'}</span>
            <div className="pagination-controls">
              <button className="button button-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
              <span>Page {page} of {Math.max(1, pages)}</span>
              <button className="button button-secondary" type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= pages}>Next</button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
