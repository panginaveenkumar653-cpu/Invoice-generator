export default function LoadingSpinner({ label = 'Loading…', size = 'medium' }) {
  return (
    <div className={`loading-state loading-${size}`} role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
