// pages/admin/login.js
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import styles from '../../styles/AdminLogin.module.css';

const ERROR_MESSAGES = {
  invalid_callback:
    'The login callback was missing information or did not match the expected login session.',
  invalid_request:
    'Cognito rejected the login request. Check callback URLs, OAuth scopes, and identity provider settings.',
  invalid_client_secret:
    'Cognito expected an app client secret. Add COGNITO_APP_CLIENT_SECRET to the app environment, or use an app client without a secret.',
};

export default function AdminLogin({
  configured,
  errorMessage,
  recoveryConfigured,
  signedOut,
}) {
  const [recoveryStep, setRecoveryStep] = useState('login');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function openRecovery() {
    setRecoveryError('');
    setRecoveryMessage('');
    setRecoveryStep('request');
  }

  function returnToLogin() {
    setRecoveryError('');
    setRecoveryMessage('');
    setCode('');
    setPassword('');
    setPasswordConfirmation('');
    setRecoveryStep('login');
  }

  async function requestRecoveryCode(event) {
    event.preventDefault();
    setSubmitting(true);
    setRecoveryError('');
    setRecoveryMessage('');

    try {
      const response = await fetch(
        '/api/store/admin/auth/password-recovery/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        }
      );
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body.error || 'We could not start password recovery.'
        );
      }

      setRecoveryMessage(body.message || 'Check your account for a code.');
      setRecoveryStep('confirm');
    } catch (error) {
      setRecoveryError(
        error.message || 'We could not start password recovery.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setRecoveryError('');
    setRecoveryMessage('');

    if (password !== passwordConfirmation) {
      setRecoveryError('The new passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        '/api/store/admin/auth/password-recovery/confirm',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, code, password }),
        }
      );
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || 'We could not reset your password.');
      }

      setPassword('');
      setPasswordConfirmation('');
      setRecoveryMessage(
        body.message || 'Your password has been reset. You can sign in now.'
      );
      setRecoveryStep('complete');
    } catch (error) {
      setRecoveryError(error.message || 'We could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Team Sign In - The Avalanche Hour</title>
      </Head>

      <main className={styles.page}>
        <div className={styles.mountainLine} aria-hidden="true" />
        <section className={styles.card}>
          <header className={styles.brand}>
            <span className={styles.brandMark}>
              <Image
                src="/images/logo.png"
                alt=""
                width={44}
                height={44}
                priority
              />
            </span>
            <span>
              <strong>The Avalanche Hour</strong>
              <small>Team Studio</small>
            </span>
          </header>

          <div className={styles.intro}>
            <span>Private team workspace</span>
            <h1>Welcome back.</h1>
            <p>
              Sign in to open episode production, team resources, mic-kit
              logistics, and the work assigned to you.
            </p>
          </div>

          {signedOut ? (
            <p className={styles.success} role="status">
              You’re signed out of the Team Studio.
            </p>
          ) : null}

          {errorMessage ? (
            <p className={styles.warning} role="alert">
              {errorMessage}
            </p>
          ) : null}

          {recoveryError ? (
            <p className={styles.warning} role="alert">
              {recoveryError}
            </p>
          ) : null}

          {recoveryMessage ? (
            <p className={styles.success} role="status">
              {recoveryMessage}
            </p>
          ) : null}

          {configured && recoveryStep === 'login' ? (
            <>
              <form
                action="/api/store/admin/auth/login"
                method="get"
                className={styles.signInForm}
              >
                <button type="submit">
                  Continue to Team Studio
                  <span aria-hidden="true">→</span>
                </button>
              </form>
              {recoveryConfigured ? (
                <button
                  type="button"
                  className={styles.recoveryLink}
                  onClick={openRecovery}
                >
                  Forgot your password?
                </button>
              ) : null}
            </>
          ) : null}

          {configured && recoveryStep === 'request' ? (
            <form
              className={styles.recoveryForm}
              onSubmit={requestRecoveryCode}
            >
              <div className={styles.recoveryHeading}>
                <h2>Reset your password</h2>
                <span>
                  Enter the email address or username attached to your Team
                  Studio account.
                </span>
              </div>
              <label htmlFor="recovery-username">Email or username</label>
              <input
                id="recovery-username"
                name="username"
                type="text"
                autoComplete="username"
                maxLength={128}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoFocus
              />
              <button type="submit" disabled={submitting}>
                {submitting ? 'Sending code…' : 'Send recovery code'}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={returnToLogin}
                disabled={submitting}
              >
                Back to sign in
              </button>
            </form>
          ) : null}

          {configured && recoveryStep === 'confirm' ? (
            <form className={styles.recoveryForm} onSubmit={resetPassword}>
              <div className={styles.recoveryHeading}>
                <h2>Enter your recovery code</h2>
                <span>
                  Use the code sent to the verified recovery method on your
                  account, then choose a new password.
                </span>
              </div>
              <label htmlFor="recovery-code">Recovery code</label>
              <input
                id="recovery-code"
                name="code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={2048}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                autoFocus
              />
              <label htmlFor="recovery-password">New password</label>
              <input
                id="recovery-password"
                name="password"
                type="password"
                autoComplete="new-password"
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <label htmlFor="recovery-password-confirmation">
                Confirm new password
              </label>
              <input
                id="recovery-password-confirmation"
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                maxLength={256}
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                required
              />
              <button type="submit" disabled={submitting}>
                {submitting ? 'Resetting password…' : 'Reset password'}
              </button>
              <div className={styles.recoveryActions}>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => {
                    setRecoveryError('');
                    setRecoveryMessage('');
                    setCode('');
                    setPassword('');
                    setPasswordConfirmation('');
                    setRecoveryStep('request');
                  }}
                  disabled={submitting}
                >
                  Request a new code
                </button>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={returnToLogin}
                  disabled={submitting}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          ) : null}

          {configured && recoveryStep === 'complete' ? (
            <div className={styles.recoveryComplete}>
              <form
                action="/api/store/admin/auth/login"
                method="get"
                className={styles.signInForm}
              >
                <button type="submit">
                  Continue to sign in
                  <span aria-hidden="true">→</span>
                </button>
              </form>
              <button
                type="button"
                className={styles.recoveryLink}
                onClick={returnToLogin}
              >
                Return to the login screen
              </button>
            </div>
          ) : null}

          {!configured ? (
            <p className={styles.warning}>
              Cognito login is not configured yet. Add COGNITO_DOMAIN,
              COGNITO_APP_CLIENT_ID, and the callback URL settings.
            </p>
          ) : null}

          <div className={styles.note}>
            <strong>One account, the right workspace.</strong>
            <span>
              Your team role controls which production and operations tools
              appear after sign-in.
            </span>
          </div>

          <Link className={styles.publicLink} href="/">
            Return to the public website
          </Link>
        </section>
      </main>
    </>
  );
}

export function getServerSideProps({ query }) {
  const configured = Boolean(
    process.env.COGNITO_DOMAIN && process.env.COGNITO_APP_CLIENT_ID
  );
  const recoveryConfigured = Boolean(
    (process.env.COGNITO_REGION || process.env.AWS_REGION) &&
      process.env.COGNITO_APP_CLIENT_ID
  );
  const error = typeof query.error === 'string' ? query.error : '';
  const errorDescription =
    typeof query.error_description === 'string' ? query.error_description : '';
  const errorMessage =
    errorDescription ||
    ERROR_MESSAGES[error] ||
    (error ? `Login failed: ${error}` : '');

  return {
    props: {
      configured,
      errorMessage,
      recoveryConfigured,
      signedOut: query.signed_out === '1',
    },
  };
}
