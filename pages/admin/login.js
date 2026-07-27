// pages/admin/login.js
import Head from 'next/head';
import Image from 'next/image';
import styles from '../../styles/AdminLogin.module.css';

const ERROR_MESSAGES = {
  invalid_callback:
    'The login callback was missing information or did not match the expected login session.',
  invalid_request:
    'Cognito rejected the login request. Check callback URLs, OAuth scopes, and identity provider settings.',
  invalid_client_secret:
    'Cognito expected an app client secret. Add COGNITO_APP_CLIENT_SECRET to the app environment, or use an app client without a secret.',
};

export default function AdminLogin({ configured, errorMessage, signedOut }) {
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

          {configured ? (
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
          ) : (
            <p className={styles.warning}>
              Cognito login is not configured yet. Add COGNITO_DOMAIN,
              COGNITO_APP_CLIENT_ID, and the callback URL settings.
            </p>
          )}

          <div className={styles.note}>
            <strong>One account, the right workspace.</strong>
            <span>
              Your team role controls which production and operations tools
              appear after sign-in.
            </span>
          </div>

          <a className={styles.publicLink} href="/">
            Return to the public website
          </a>
        </section>
      </main>
    </>
  );
}

export function getServerSideProps({ query }) {
  const configured = Boolean(
    process.env.COGNITO_DOMAIN && process.env.COGNITO_APP_CLIENT_ID
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
      signedOut: query.signed_out === '1',
    },
  };
}
