// pages/admin/login.js
import Head from 'next/head';

const ERROR_MESSAGES = {
  invalid_callback:
    'The login callback was missing information or did not match the expected login session.',
  invalid_request:
    'Cognito rejected the login request. Check callback URLs, OAuth scopes, and identity provider settings.',
  invalid_client_secret:
    'Cognito expected an app client secret. Add COGNITO_APP_CLIENT_SECRET to the app environment, or use an app client without a secret.',
};

export default function AdminLogin({ configured, errorMessage }) {
  return (
    <>
      <Head>
        <title>Admin Login - The Avalanche Hour</title>
      </Head>

      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          background: '#f6f7f9',
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 24,
            border: '1px solid #d0d5dd',
            borderRadius: 8,
            background: '#fff',
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Admin Login</h1>
          <p style={{ color: '#475467', lineHeight: 1.5 }}>
            Sign in with your Avalanche Hour admin account.
          </p>

          {errorMessage && (
            <p
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 6,
                background: '#fff4e5',
                color: '#7a4a00',
                lineHeight: 1.45,
              }}
            >
              {errorMessage}
            </p>
          )}

          {configured ? (
            <form action="/api/store/admin/auth/login" method="get">
              <button
                type="submit"
                style={{
                  display: 'inline-block',
                  marginTop: 16,
                  padding: '10px 14px',
                  border: 0,
                  borderRadius: 6,
                  background: '#1976d2',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Continue with Cognito
              </button>
            </form>
          ) : (
            <p
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 6,
                background: '#fff4e5',
                color: '#7a4a00',
              }}
            >
              Cognito login is not configured yet. Add COGNITO_DOMAIN,
              COGNITO_APP_CLIENT_ID, and the callback URL settings.
            </p>
          )}
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
    errorDescription || ERROR_MESSAGES[error] || (error ? `Login failed: ${error}` : '');

  return {
    props: {
      configured,
      errorMessage,
    },
  };
}
