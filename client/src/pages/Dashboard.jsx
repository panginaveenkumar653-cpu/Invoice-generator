import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';

const initialStats = {
  totalInvoices: 0,
  totalRevenue: 0,
  totalOutstanding: 0,
  paidCount: 0,
  unpaidCount: 0,
  overdueCount: 0,
  thisMonthRevenue: 0,
};

export default function Dashboard() {
  const showToast = useToast();
  const [stats, setStats] = useState(initialStats);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/api/invoices/stats'),
      api.get('/api/invoices', { params: { page: 1, limit: 5 } }),
    ])
      .then(([statsResponse, invoicesResponse]) => {
        if (!active) return;
        setStats({ ...initialStats, ...statsResponse.data });
        setRecentInvoices(invoicesResponse.data.data || []);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || 'Unable to load your dashboard. Please try again.');
        showToast(requestError.response?.data?.message || 'Unable to load your dashboard. Please try again.', 'error');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [showToast]);

  const cards = [
    { label: 'Total revenue', value: formatCurrency(stats.totalRevenue), detail: 'From paid invoices', tone: 'blue' },
    { label: 'Outstanding amount', value: formatCurrency(stats.totalOutstanding), detail: 'Sent and overdue', tone: 'amber' },
    { label: 'Paid count', value: stats.paidCount, detail: 'Paid invoices', tone: 'green' },
    { label: 'Overdue count', value: stats.overdueCount, detail: 'Needs attention', tone: 'red' },
    { label: "This month's revenue", value: formatCurrency(stats.thisMonthRevenue), detail: 'Paid this month', tone: 'violet' },
  ];

  return (
    <section className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="section-subtitle">A quick look at your invoice activity.</p>
        </div>
        <Link className="button button-primary" to="/invoices/new">New Invoice</Link>
      </header>

      {stats.overdueCount > 0 && (
        <div className="overdue-banner" role="status">
          <span className="overdue-banner-icon" aria-hidden="true">!</span>
          <span><strong>{stats.overdueCount} overdue {stats.overdueCount === 1 ? 'invoice' : 'invoices'}</strong> need your attention.</span>
          <Link to="/invoices?status=overdue">View overdue</Link>
        </div>
      )}

      {error && <div className="client-alert page-alert" role="alert">{error}</div>}

      {loading ? (
        <LoadingSpinner label="Loading your dashboard…" />
      ) : (
        <>
          <div className="dashboard-cards">
            {cards.map((card) => (
              <article className={`summary-card summary-${card.tone}`} key={card.label}>
                <p>{card.label}</p>
                <strong>{card.value}</strong>
                <span>{card.detail}</span>
              </article>
            ))}
          </div>

          <section className="recent-invoices-section">
            <div className="recent-heading">
              <div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent invoices</h2></div>
              <Link to="/invoices">View all invoices <span aria-hidden="true">→</span></Link>
            </div>

            {recentInvoices.length === 0 ? (
              <EmptyState
                compact
                title="No invoices yet"
                description="Create your first invoice to see your activity here."
                action={<Link className="button button-primary" to="/invoices/new">Create an invoice</Link>}
              />
            ) : (
              <div className="client-table-wrap">
                <table className="client-table dashboard-invoice-table">
                  <thead><tr><th>Invoice</th><th>Client</th><th>Due date</th><th>Status</th><th className="align-right">Total</th></tr></thead>
                  <tbody>
                    {recentInvoices.map((invoice) => (
                      <tr key={invoice._id}>
                        <td><Link className="client-name-link" to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</Link></td>
                        <td>{invoice.client?.name || '—'}</td>
                        <td>{formatDate(invoice.dueDate)}</td>
                        <td><span className={`status-pill status-${invoice.status}`}>{invoice.status}</span></td>
                        <td className="align-right">{formatCurrency(invoice.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
