import { useState } from 'react';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ClientForm({ initialValues, onSubmit, onCancel, submitLabel }) {
  const [values, setValues] = useState({
    name: initialValues?.name || '',
    email: initialValues?.email || '',
    phone: initialValues?.phone || '',
    address: initialValues?.address || '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = 'Name is required.';
    if (!values.email.trim()) nextErrors.email = 'Email is required.';
    else if (!emailPattern.test(values.email.trim())) nextErrors.email = 'Enter a valid email address.';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
      });
    } catch (error) {
      setFormError(error.response?.data?.message || 'Unable to save this client. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="client-form" onSubmit={handleSubmit} noValidate>
      {formError && <div className="client-alert" role="alert">{formError}</div>}
      <div className="client-field">
        <label htmlFor="client-name">Name <span aria-hidden="true">*</span></label>
        <input id="client-name" name="name" value={values.name} onChange={handleChange} autoFocus aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'client-name-error' : undefined} />
        {errors.name && <p className="client-field-error" id="client-name-error">{errors.name}</p>}
      </div>
      <div className="client-field">
        <label htmlFor="client-email">Email <span aria-hidden="true">*</span></label>
        <input id="client-email" name="email" type="email" value={values.email} onChange={handleChange} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'client-email-error' : undefined} />
        {errors.email && <p className="client-field-error" id="client-email-error">{errors.email}</p>}
      </div>
      <div className="client-field">
        <label htmlFor="client-phone">Phone</label>
        <input id="client-phone" name="phone" type="tel" value={values.phone} onChange={handleChange} />
      </div>
      <div className="client-field">
        <label htmlFor="client-address">Address</label>
        <textarea id="client-address" name="address" rows="3" value={values.address} onChange={handleChange} />
      </div>
      <div className="client-form-actions">
        <button className="button button-secondary" type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
