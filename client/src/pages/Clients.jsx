import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import ClientForm from '../components/ClientForm.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';

const PAGE_SIZE = 10;

export default function Clients() {
  const showToast = useToast();
  const [clients, setClients] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingClient, setEditingClient] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const loadClients = useCallback(async (isActive = () => true) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/clients', { params: { page, limit: PAGE_SIZE } });
      if (!isActive()) return;
      setClients(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (requestError) {
      if (!isActive()) return;
      const message = requestError.response?.data?.message || 'Unable to load clients. Please try again.';
      setError(message);
      showToast(message, 'error');
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    let active = true;
    loadClients(() => active);
    return () => { active = false; };
  }, [loadClients]);

  function openCreateForm() {
    setEditingClient(null);
    setFormOpen(true);
  }

  function openEditForm(client) {
    setEditingClient(client);
    setFormOpen(true);
  }

  async function saveClient(values) {
    try {
      if (editingClient) await api.put(`/api/clients/${editingClient._id}`, values);
      else await api.post('/api/clients', values);
    } catch (requestError) {
      showToast(requestError.response?.data?.message || 'Unable to save client.', 'error');
      throw requestError;
    }
    showToast(editingClient ? 'Client updated.' : 'Client created.');
    setFormOpen(false);
    setEditingClient(null);
    await loadClients();
  }

  async function deleteClient(client) {
    const confirmed = window.confirm(`Delete ${client.name}? This action cannot be undone.`);
    if (!confirmed) return;
    setError('');
    try {
      await api.delete(`/api/clients/${client._id}`);
      showToast('Client deleted.');
      if (clients.length === 1 && page > 1) setPage((current) => current - 1);
      else await loadClients();
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to delete client. Please try again.';
      setError(message);
      showToast(message, 'error');
    }
  }

  return (
    <section className="clients-page">
      <header className="section-header">
        <div>
          <p className="eyebrow">CONTACTS</p>
          <h1>Clients</h1>
          <p className="section-subtitle">Keep your client details in one place.</p>
        </div>
        <button className="button button-primary" type="button" onClick={openCreateForm}>Add Client</button>
      </header>

      {error && <div className="client-alert page-alert" role="alert">{error}</div>}

      {loading ? (
        <LoadingSpinner label="Loading clients…" />
      ) : clients.length === 0 ? (
        <EmptyState
          title={total === 0 ? 'No clients yet' : 'No clients on this page'}
          description={total === 0 ? 'Add a client to start creating invoices.' : 'Try another page.'}
          action={total === 0 ? <button className="button button-primary" type="button" onClick={openCreateForm}>Add your first client</button> : null}
        />
      ) : (
        <>
          <div className="client-table-wrap">
            <table className="client-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client._id}>
                    <td><Link className="client-name-link" to={`/clients/${client._id}`}>{client.name}</Link></td>
                    <td>{client.email}</td>
                    <td>{client.phone || '—'}</td>
                    <td className="row-actions">
                      <Link to={`/clients/${client._id}`}>View</Link>
                      <button type="button" onClick={() => openEditForm(client)}>Edit</button>
                      <button className="delete-action" type="button" onClick={() => deleteClient(client)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="pagination-bar">
            <span>{total} {total === 1 ? 'client' : 'clients'}</span>
            <div className="pagination-controls">
              <button className="button button-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</button>
              <span>Page {page} of {Math.max(1, pages)}</span>
              <button className="button button-secondary" type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= pages || loading}>Next</button>
            </div>
          </footer>
        </>
      )}

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">CLIENT DETAILS</p>
                <h2 id="client-form-title">{editingClient ? 'Edit client' : 'Add a client'}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setFormOpen(false)}>×</button>
            </header>
            <ClientForm
              key={editingClient?._id || 'new-client'}
              initialValues={editingClient}
              onSubmit={saveClient}
              onCancel={() => setFormOpen(false)}
              submitLabel={editingClient ? 'Save changes' : 'Create client'}
            />
          </section>
        </div>
      )}
    </section>
  );
}
