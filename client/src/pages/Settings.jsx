import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const showToast = useToast();
  const [values, setValues] = useState({
    name: user?.name || '',
    email: user?.email || '',
    businessName: user?.businessName || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const initials = (user?.name || user?.email || 'I')
    .split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = 'Your name is required.';
    if (!values.email.trim()) nextErrors.email = 'Your email is required.';
    else if (!emailPattern.test(values.email.trim())) nextErrors.email = 'Enter a valid email address.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setError('');
    try {
      const updated = await updateProfile({
        name: values.name.trim(),
        email: values.email.trim(),
        businessName: values.businessName.trim(),
      });
      setValues({ name: updated.name, email: updated.email, businessName: updated.businessName || '' });
      showToast('Your profile has been updated.');
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Unable to update your profile. Please try again.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-page">
      <header className="section-header">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Profile settings</h1>
          <p className="section-subtitle">Keep your account and invoice details up to date.</p>
        </div>
      </header>

      <div className="settings-layout">
        <aside className="settings-profile-card">
          <span className="settings-avatar">{initials}</span>
          <h2>{user?.name}</h2>
          <p>{user?.email}</p>
          <span className="profile-badge"><i /> Account active</span>
          <div className="settings-profile-note">
            <strong>Business details</strong>
            <span>Your business name appears at the top of downloaded invoices.</span>
          </div>
        </aside>

        <form className="settings-form-card" onSubmit={submit} noValidate>
          <div className="settings-form-heading">
            <div><p className="eyebrow">PERSONAL INFORMATION</p><h2>Account details</h2></div>
            <Link className="back-link settings-back" to="/dashboard">Back to overview</Link>
          </div>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <div className="settings-fields">
            <div className="client-field">
              <label htmlFor="profile-name">Full name <span aria-hidden="true">*</span></label>
              <input id="profile-name" name="name" autoComplete="name" value={values.name} onChange={updateField} aria-invalid={Boolean(errors.name)} />
              {errors.name && <p className="client-field-error">{errors.name}</p>}
            </div>
            <div className="client-field">
              <label htmlFor="profile-email">Email address <span aria-hidden="true">*</span></label>
              <input id="profile-email" name="email" type="email" autoComplete="email" value={values.email} onChange={updateField} aria-invalid={Boolean(errors.email)} />
              {errors.email && <p className="client-field-error">{errors.email}</p>}
            </div>
            <div className="client-field">
              <label htmlFor="profile-business">Business name <span>(optional)</span></label>
              <input id="profile-business" name="businessName" autoComplete="organization" value={values.businessName} onChange={updateField} placeholder="Your business or studio" />
              <p className="invoice-help">This name is used on your invoice PDFs.</p>
            </div>
          </div>
          <footer className="settings-actions">
            <span>Your changes are saved to your account.</span>
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>
    </section>
  );
}
