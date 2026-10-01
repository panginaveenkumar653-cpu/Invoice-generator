import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const features = [
  { number: '01', title: 'Know what is due', description: 'See paid, outstanding, and overdue invoices at a glance.' },
  { number: '02', title: 'Keep clients close', description: 'Save contact details once and use them on every invoice.' },
  { number: '03', title: 'Send a polished invoice', description: 'Add services, set tax, and download a clean PDF in moments.' },
];

export default function Home() {
  const { user } = useAuth();
  const startPath = user ? '/dashboard' : '/register';

  return (
    <main className="home-page">
      <header className="home-nav-wrap">
        <nav className="home-nav" aria-label="Main navigation">
          <Link className="home-brand" to="/" aria-label="Invoice Generator home">
            <span className="home-brand-mark">IG</span> Invoice Generator
          </Link>
          <div className="home-nav-links">
            <a href="#features">Features</a>
            {user ? <Link to="/dashboard">Workspace</Link> : <Link to="/login">Log in</Link>}
            <Link className="button button-primary home-nav-cta" to={startPath}>{user ? 'Open workspace' : 'Get started'}</Link>
          </div>
        </nav>
      </header>

      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><span /> SIMPLE INVOICING FOR INDEPENDENT WORK</p>
          <h1>Spend less time on invoices. <em>Get back to your work.</em></h1>
          <p className="home-hero-description">Create clear invoices, keep client details organized, and know what is getting paid — all in one calm workspace.</p>
          <div className="home-actions">
            <Link className="button button-primary home-primary-cta" to={startPath}>{user ? 'Go to your workspace' : 'Create your free account'} <span aria-hidden="true">→</span></Link>
            <a className="home-secondary-cta" href="#features">Explore features <span aria-hidden="true">↓</span></a>
          </div>
          <div className="home-proof"><span className="proof-check">✓</span> Clients, invoices, and payment status together</div>
        </div>

        <div className="home-visual" aria-label="Example invoice preview">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <article className="preview-card">
            <header className="preview-header">
              <div><span className="preview-logo">IG</span><span className="preview-business">Your Studio<small>INVOICE</small></span></div>
              <span className="preview-status">SENT</span>
            </header>
            <div className="preview-number"><span>INVOICE NUMBER</span><strong>INV-2025-014</strong></div>
            <div className="preview-rule" />
            <div className="preview-client"><span>BILL TO</span><strong>Northstar Creative</strong><small>hello@northstar.co</small></div>
            <div className="preview-lines">
              <div className="preview-line preview-line-head"><span>DESCRIPTION</span><span>AMOUNT</span></div>
              <div className="preview-line"><span>Brand identity design</span><strong>₹24,000</strong></div>
              <div className="preview-line"><span>Website consultation</span><strong>₹8,000</strong></div>
            </div>
            <div className="preview-total"><span>Total due</span><strong>₹32,000</strong></div>
            <div className="preview-due"><span className="due-check">✓</span><span>Payment due in 14 days</span></div>
          </article>
          <div className="preview-float"><span className="float-dot" /><div><strong>Payment tracked</strong><small>Your invoice is on its way</small></div></div>
        </div>
      </section>

      <section className="home-features" id="features">
        <div className="features-heading">
          <div><p className="home-eyebrow">A CLEARER WAY TO GET PAID</p><h2>The details, taken care of.</h2></div>
          <p>From the first client to the final payment, your invoicing stays easy to follow.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <span>{feature.number}</span><h3>{feature.title}</h3><p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-bottom-cta">
        <div><p className="home-eyebrow">READY WHEN YOU ARE</p><h2>Make the next invoice your easiest one.</h2></div>
        <Link className="button home-bottom-button" to={startPath}>{user ? 'Open your workspace' : 'Get started for free'} <span aria-hidden="true">→</span></Link>
      </section>

      <footer className="home-footer"><Link className="home-brand" to="/">Invoice Generator</Link><span>Clear invoices. Calmer workdays.</span></footer>
    </main>
  );
}
