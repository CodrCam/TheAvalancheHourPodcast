import { useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import { Box, Typography } from '@mui/material';

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Cloudflare documents this key for automated development and test flows. It
// always passes and must never be used by a production build.
export const TURNSTILE_ALWAYS_PASS_SITE_KEY = '1x00000000000000000000AA';

const STATUS_COPY = {
  loading: 'Loading the security check…',
  checking: 'Complete the security check to enable submission.',
  verified: 'Security check complete. You can submit the form.',
  expired: 'The security check expired. Please complete it again.',
  error: 'The security check could not be completed. Please try again.',
  unavailable:
    'The security check is temporarily unavailable. Please refresh and try again.',
};

function getTurnstileSiteKey() {
  if (process.env.NODE_ENV !== 'production') {
    return TURNSTILE_ALWAYS_PASS_SITE_KEY;
  }

  return String(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim();
}

export default function PublicFormHumanCheck({
  action,
  onToken,
  resetKey = 0,
}) {
  const statusId = useId();
  const containerRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [outcome, setOutcome] = useState({ cycle: '', status: '' });
  const siteKey = getTurnstileSiteKey();
  const cycle = `${action}:${resetKey}`;

  useEffect(() => {
    let active = true;
    let widgetId = null;
    const container = containerRef.current;

    onToken('');

    if (!siteKey) {
      return () => {
        active = false;
      };
    }

    if (
      !scriptReady ||
      !container ||
      typeof window === 'undefined' ||
      !window.turnstile
    ) {
      return () => {
        active = false;
      };
    }

    try {
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        action,
        theme: 'auto',
        retry: 'auto',
        'refresh-expired': 'auto',
        callback: (token) => {
          if (!active) return;
          onToken(token);
          setOutcome({ cycle, status: 'verified' });
        },
        'expired-callback': () => {
          if (!active) return;
          onToken('');
          setOutcome({ cycle, status: 'expired' });
        },
        'error-callback': () => {
          if (!active) return;
          onToken('');
          setOutcome({ cycle, status: 'error' });
        },
      });
    } catch (error) {
      console.error('Unable to render Turnstile:', error);
      onToken('');
      Promise.resolve().then(() => {
        if (active) setOutcome({ cycle, status: 'error' });
      });
    }

    return () => {
      active = false;
      if (widgetId !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (error) {
          console.warn('Unable to remove Turnstile widget:', error);
        }
      }
    };
  }, [action, cycle, onToken, resetKey, scriptReady, siteKey]);

  const handleScriptError = () => {
    onToken('');
    setScriptReady(false);
    setOutcome({ cycle, status: 'error' });
  };

  const status = !siteKey
    ? 'unavailable'
    : outcome.cycle === cycle
      ? outcome.status
      : scriptReady
        ? 'checking'
        : 'loading';
  const statusIsError = status === 'error' || status === 'unavailable';

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.25,
        justifyItems: 'start',
        p: 2,
        border: '1px solid',
        borderColor: statusIsError ? 'error.light' : 'grey.300',
        borderRadius: 1,
        backgroundColor: 'grey.50',
      }}
      data-turnstile-action={action}
    >
      {siteKey ? (
        <Script
          id="cloudflare-turnstile-explicit"
          src={TURNSTILE_SCRIPT_SRC}
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onReady={() => setScriptReady(true)}
          onError={handleScriptError}
        />
      ) : null}

      <Typography variant="subtitle2" component="p" sx={{ fontWeight: 700 }}>
        Quick security check
      </Typography>

      <Box
        ref={containerRef}
        aria-label="Human verification"
        aria-describedby={statusId}
      />

      <Typography
        id={statusId}
        variant="body2"
        color={statusIsError ? 'error.main' : 'text.secondary'}
        role={statusIsError ? 'alert' : 'status'}
        aria-live={statusIsError ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        {STATUS_COPY[status]}
      </Typography>
    </Box>
  );
}
