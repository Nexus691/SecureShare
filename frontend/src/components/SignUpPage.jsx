import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SignUpPage({ onShowLogin }) {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmation: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmation) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await signUp(form.email, form.password, form.displayName);
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <div className="center-icon">🔐</div>
        <h1 className="card-title">Create your account</h1>
        <p className="card-sub">Your files still transfer directly between browsers.</p>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="signup-name">Display name</label>
          <input id="signup-name" type="text" autoComplete="name" required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label htmlFor="signup-confirmation">Confirm password</label>
          <input id="signup-confirmation" type="password" autoComplete="new-password" required minLength={6} value={form.confirmation} onChange={(e) => setForm({ ...form, confirmation: e.target.value })} />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn-primary auth-submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already registered? <button className="auth-link inline" onClick={onShowLogin}>Sign in</button></p>
      </section>
    </main>
  );
}
