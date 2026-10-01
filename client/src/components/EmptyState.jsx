export default function EmptyState({ title, description, action, compact = false }) {
  return (
    <section className={`shared-empty-state${compact ? ' shared-empty-compact' : ''}`}>
      <span className="shared-empty-icon" aria-hidden="true">＋</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="shared-empty-action">{action}</div>}
    </section>
  );
}
