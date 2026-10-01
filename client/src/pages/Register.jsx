import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getServerMessage(error) {
  const message = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg;
  if (message) return message;
  if (!error.response) {
    const apiUrl = error.config?.baseURL || 'the configured API';
    if (apiUrl.includes('your-invoice-api.onrender.com')) {
      return 'The API URL is still the sample placeholder. Set VITE_API_URL to your real backend URL and rebuild the frontend.';
    }
    return `Cannot reach ${apiUrl}. Check that the backend is running and allows this website in ALLOWED_ORIGIN.`;
  }
  return `The server could not create your account (HTTP ${error.response.status}). Check the API server logs and try again.`;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', businessName: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setServerError('');
  }

  function validate() {
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = 'Name is required.';
    if (!values.email.trim()) nextErrors.email = 'Email is required.';
    else if (!emailPattern.test(values.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!values.password) nextErrors.password = 'Password is required.';
    else if (values.password.length < 6) nextErrors.password = 'Password must be at least 6 characters.';
    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await register(
        values.name.trim(),
        values.email.trim(),
        values.password,
        values.businessName.trim()
      );
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setServerError(getServerMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <aside className="auth-promo">
          <Link className="auth-promo-brand" to="/">Invoice <span>Generator</span></Link>
          <div className="auth-promo-copy">
            <p className="auth-promo-kicker">LESS ADMIN. MORE MOMENTUM.</p>
            <h2>Make getting paid feel easy.</h2>
            <p>Bring your clients, invoices, and payment status together in one calm workspace.</p>
          </div>
          <div className="auth-promo-foot"><span className="promo-dot" /> Set up your workspace in minutes</div>
        </aside>
        <section className="auth-card" aria-labelledby="register-title">
        <p className="auth-form-kicker">START FOR FREE</p>
        <h1 id="register-title">Create your account</h1>
        <p className="auth-intro">Get started managing your freelance invoices.</p>
        {serverError && <div className="form-alert" role="alert">{serverError}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="register-name">Name</label>
            <input id="register-name" name="name" type="text" autoComplete="name" value={values.name} onChange={updateField} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'register-name-error' : undefined} />
            {errors.name && <p className="field-error" id="register-name-error">{errors.name}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="register-email">Email</label>
            <input id="register-email" name="email" type="email" autoComplete="email" value={values.email} onChange={updateField} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} />
            {errors.email && <p className="field-error" id="register-email-error">{errors.email}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="register-password">Password</label>
            <input id="register-password" name="password" type="password" autoComplete="new-password" value={values.password} onChange={updateField} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'register-password-error' : undefined} />
            {errors.password && <p className="field-error" id="register-password-error">{errors.password}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="register-business-name">Business name <span>(optional)</span></label>
            <input id="register-business-name" name="businessName" type="text" autoComplete="organization" value={values.businessName} onChange={updateField} />
          </div>
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
        </section>
      </div>
    </main>
  );
}
