import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onShowSignUp }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <div className="center-icon">🔒</div>
        <h1 className="card-title">Welcome to SecureShare</h1>
        <p className="card-sub">Sign in to access your secure transfers.</p>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn-primary auth-submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">No account? <button className="auth-link inline" onClick={onShowSignUp}>Create one</button></p>
      </section>
    </main>
  );
}
