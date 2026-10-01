import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency } from '../utils/formatters.js';

const blankItem = () => ({ description: '', quantity: '1', rate: '0' });
const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

function dateInputValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export default function InvoiceForm() {
  const showToast = useToast();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [clients, setClients] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientId, setClientId] = useState(searchParams.get('client') || '');
  const [items, setItems] = useState([blankItem()]);
  const [taxRate, setTaxRate] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const totals = useMemo(() => {
    const subtotal = roundMoney(items.reduce((sum, item) => {
      const quantity = Number(item.quantity);
      const rate = Number(item.rate);
      if (!Number.isFinite(quantity) || !Number.isFinite(rate)) return sum;
      return sum + quantity * rate;
    }, 0));
    const numericTaxRate = Number(taxRate);
    const taxAmount = roundMoney(subtotal * ((Number.isFinite(numericTaxRate) ? numericTaxRate : 0) / 100));
    return { subtotal, taxAmount, total: roundMoney(subtotal + taxAmount) };
  }, [items, taxRate]);

  const fetchClients = useCallback(async () => {
    const firstPage = await api.get('/api/clients', { params: { page: 1, limit: 100 } });
    const allClients = [...firstPage.data.data];
    for (let page = 2; page <= firstPage.data.pages; page += 1) {
      const { data } = await api.get('/api/clients', { params: { page, limit: 100 } });
      allClients.push(...data.data);
    }
    return allClients;
  }, []);

  useEffect(() => {
    let active = true;
    async function loadForm() {
      setLoading(true);
      setFormError('');
      try {
        const [allClients, invoiceResponse] = await Promise.all([
          fetchClients(),
          editing ? api.get(`/api/invoices/${id}`) : Promise.resolve(null),
        ]);
        if (!active) return;
        setClients(allClients);
        if (invoiceResponse) {
          const invoice = invoiceResponse.data.data;
          setInvoiceNumber(invoice.invoiceNumber || '');
          setClientId(invoice.client?._id || invoice.client || '');
          setItems(invoice.items?.length ? invoice.items.map((item) => ({
            description: item.description || '',
            quantity: String(item.quantity ?? 1),
            rate: String(item.rate ?? 0),
          })) : [blankItem()]);
          setTaxRate(String(invoice.taxRate ?? 0));
          setDueDate(dateInputValue(invoice.dueDate));
          setNotes(invoice.notes || '');
        }
      } catch (requestError) {
        if (!active) return;
        if (requestError.response?.status === 404) {
          navigate('/invoices', { replace: true, state: { message: 'Invoice not found.' } });
          return;
        }
        setFormError(requestError.response?.data?.message || 'Unable to load invoice form. Please try again.');
        showToast(requestError.response?.data?.message || 'Unable to load invoice form. Please try again.', 'error');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadForm();
    return () => { active = false; };
  }, [editing, fetchClients, id, navigate, showToast]);

  function updateItem(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
    setErrors((current) => ({ ...current, items: '' }));
  }

  function validate() {
    const nextErrors = {};
    if (!clientId) nextErrors.client = 'Select a client.';
    if (!dueDate) nextErrors.dueDate = 'Due date is required.';
    if (taxRate === '' || !Number.isFinite(Number(taxRate)) || Number(taxRate) < 0) {
      nextErrors.taxRate = 'Tax rate must be zero or greater.';
    }
    if (!items.length || items.some((item) => (
      !item.description.trim() || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0
      || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0
    ))) {
      nextErrors.items = 'Each line needs a description, a quantity greater than 0, and a rate of 0 or more.';
    }
    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    const payload = {
      client: clientId,
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
      taxRate: Number(taxRate),
      dueDate,
      notes: notes.trim(),
    };

    setSubmitting(true);
    try {
      const response = editing
        ? await api.put(`/api/invoices/${id}`, payload)
        : await api.post('/api/invoices', payload);
      showToast(editing ? 'Invoice updated.' : 'Invoice created.');
      navigate(`/invoices/${response.data.data._id}`, { replace: true });
    } catch (requestError) {
      if (requestError.response?.status === 404 && editing) {
        navigate('/invoices', { replace: true, state: { message: 'Invoice not found.' } });
        return;
      }
      const backendErrors = requestError.response?.data?.errors;
      const message = requestError.response?.data?.message || backendErrors?.[0]?.msg || 'Unable to save invoice. Please try again.';
      setFormError(message);
      showToast(message, 'error');
      if (backendErrors?.length) {
        setErrors((current) => ({ ...current, backend: backendErrors.map((item) => item.msg).join(' ') }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function addItem() { setItems((current) => [...current, blankItem()]); }
  function removeItem(index) { setItems((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current); }

  if (loading) return <LoadingSpinner label="Loading invoice form…" />;

  return (
    <section className="invoice-form-page">
      <Link className="back-link" to="/invoices">← All invoices</Link>
      <header className="section-header">
        <div>
          <p className="eyebrow">INVOICE</p>
          <h1>{editing ? 'Edit invoice' : 'New invoice'}</h1>
          {invoiceNumber && <p className="section-subtitle">{invoiceNumber}</p>}
        </div>
      </header>
      {formError && <div className="client-alert page-alert" role="alert">{formError}</div>}
      {errors.backend && <div className="client-alert page-alert" role="alert">{errors.backend}</div>}

      <form className="invoice-form" onSubmit={handleSubmit} noValidate>
        <section className="invoice-form-section">
          <h2>Invoice details</h2>
          <div className="invoice-form-grid">
            <div className="client-field">
              <label htmlFor="invoice-client">Client <span aria-hidden="true">*</span></label>
              <select id="invoice-client" value={clientId} onChange={(event) => { setClientId(event.target.value); setErrors((current) => ({ ...current, client: '' })); }} aria-invalid={Boolean(errors.client)}>
                <option value="">Select a client</option>
                {clients.map((client) => <option key={client._id} value={client._id}>{client.name} · {client.email}</option>)}
              </select>
              {errors.client && <p className="client-field-error">{errors.client}</p>}
              {!clients.length && <p className="invoice-help">Add a client before creating an invoice.</p>}
            </div>
            <div className="client-field">
              <label htmlFor="invoice-due-date">Due date <span aria-hidden="true">*</span></label>
              <input id="invoice-due-date" type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); setErrors((current) => ({ ...current, dueDate: '' })); }} aria-invalid={Boolean(errors.dueDate)} />
              {errors.dueDate && <p className="client-field-error">{errors.dueDate}</p>}
            </div>
          </div>
        </section>

        <section className="invoice-form-section">
          <div className="invoice-section-heading"><div><h2>Line items</h2><p>Add the products or services included in this invoice.</p></div></div>
          {errors.items && <p className="client-field-error items-error" role="alert">{errors.items}</p>}
          <div className="line-items-heading"><span>Description</span><span>Quantity</span><span>Rate</span><span>Amount</span><span /></div>
          <div className="line-items-list">
            {items.map((item, index) => {
              const quantity = Number(item.quantity);
              const rate = Number(item.rate);
              const amount = Number.isFinite(quantity * rate) ? roundMoney(quantity * rate) : 0;
              return (
                <div className="line-item-row" key={index}>
                  <input aria-label={`Item ${index + 1} description`} placeholder="e.g. Design services" value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} />
                  <input aria-label={`Item ${index + 1} quantity`} type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                  <input aria-label={`Item ${index + 1} rate`} type="number" min="0" step="any" value={item.rate} onChange={(event) => updateItem(index, 'rate', event.target.value)} />
                  <output className="line-item-amount">{formatCurrency(amount)}</output>
                  <button className="remove-item" type="button" onClick={() => removeItem(index)} disabled={items.length === 1} aria-label={`Remove item ${index + 1}`}>×</button>
                </div>
              );
            })}
          </div>
          <button className="add-line-item" type="button" onClick={addItem}>＋ Add line item</button>
        </section>

        <section className="invoice-form-section invoice-bottom-grid">
          <div className="client-field notes-field">
            <label htmlFor="invoice-notes">Notes</label>
            <textarea id="invoice-notes" rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Payment details or a thank-you message" />
          </div>
          <div className="totals-card">
            <div className="client-field tax-field">
              <label htmlFor="invoice-tax">Tax rate (%)</label>
              <input id="invoice-tax" type="number" min="0" step="any" value={taxRate} onChange={(event) => { setTaxRate(event.target.value); setErrors((current) => ({ ...current, taxRate: '' })); }} aria-invalid={Boolean(errors.taxRate)} />
              {errors.taxRate && <p className="client-field-error">{errors.taxRate}</p>}
            </div>
            <div className="total-line"><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
            <div className="total-line"><span>Tax ({Number(taxRate || 0)}%)</span><strong>{formatCurrency(totals.taxAmount)}</strong></div>
            <div className="total-line grand-total"><span>Total</span><strong>{formatCurrency(totals.total)}</strong></div>
            <p className="invoice-help">Totals are recalculated securely when you save.</p>
          </div>
        </section>

        <footer className="invoice-form-footer">
          <Link className="button button-secondary" to={editing ? `/invoices/${id}` : '/invoices'}>Cancel</Link>
          <button className="button button-primary" type="submit" disabled={submitting || !clients.length}>
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create invoice'}
          </button>
        </footer>
      </form>
    </section>
  );
}
