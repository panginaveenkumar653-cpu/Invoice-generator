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
  return `The server could not log you in (HTTP ${error.response.status}). Check the API server logs and try again.`;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: '', password: '' });
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
      await login(values.email.trim(), values.password);
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
            <p className="auth-promo-kicker">YOUR BUSINESS, IN GOOD ORDER</p>
            <h2>More time for the work you love.</h2>
            <p>Create polished invoices, keep your clients close, and see what’s getting paid.</p>
          </div>
          <div className="auth-promo-foot"><span className="promo-dot" /> Simple invoicing for independent work</div>
        </aside>
        <section className="auth-card" aria-labelledby="login-title">
        <p className="auth-form-kicker">YOUR WORKSPACE</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="auth-intro">Log in to manage your clients and invoices.</p>
        {serverError && <div className="form-alert" role="alert">{serverError}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" name="email" type="email" autoComplete="email" value={values.email} onChange={updateField} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined} />
            {errors.email && <p className="field-error" id="login-email-error">{errors.email}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" autoComplete="current-password" value={values.password} onChange={updateField} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined} />
            {errors.password && <p className="field-error" id="login-password-error">{errors.password}</p>}
          </div>
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="auth-switch">New here? <Link to="/register">Create an account</Link></p>
        </section>
      </div>
    </main>
  );
}
