import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { DEFAULT_HOME_CONTENT } from '../../lib/siteContentDefaults';

const fieldWrap = {
  display: 'grid',
  gap: 6,
};

const labelStyle = {
  fontWeight: 700,
  color: '#334155',
  fontSize: 13,
};

const inputStyle = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '9px 10px',
  font: 'inherit',
};

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 16,
  background: '#fff',
  display: 'grid',
  gap: 14,
};

function TextField({ label, name, value, onChange, multiline = false }) {
  const Component = multiline ? 'textarea' : 'input';
  return (
    <label style={fieldWrap}>
      <span style={labelStyle}>{label}</span>
      <Component
        name={name}
        value={value}
        onChange={onChange}
        rows={multiline ? 4 : undefined}
        style={{
          ...inputStyle,
          resize: multiline ? 'vertical' : undefined,
        }}
      />
    </label>
  );
}

function ToggleField({ label, name, checked, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontWeight: 700,
        color: '#334155',
      }}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

export default function AdminSiteContentPage() {
  const [content, setContent] = useState(DEFAULT_HOME_CONTENT);
  const [meta, setMeta] = useState({ source: 'default', configured: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadContent() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/site-content', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to load homepage content');
      }
      setContent({ ...DEFAULT_HOME_CONTENT, ...(data.content || {}) });
      setMeta({
        source: data.source || 'default',
        configured: data.configured === true,
        updated_at: data.updated_at || '',
      });
    } catch (err) {
      setError(err.message || 'Failed to load homepage content.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContent();
  }, []);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setContent((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function saveContent(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/site-content', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to save homepage content');
      }
      setContent({ ...DEFAULT_HOME_CONTENT, ...(data.content || {}) });
      setMeta({
        source: data.source || 'dynamo',
        configured: data.configured === true,
        updated_at: data.updated_at || '',
      });
      setMessage('Homepage content saved.');
    } catch (err) {
      setError(err.message || 'Failed to save homepage content.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 920 }}>
        <h1>Homepage Content</h1>
        <p style={{ color: '#64748b', maxWidth: 720 }}>
          Edit the homepage support section, community spotlight, and social
          call to action. The Instagram button appears with the support block,
          while the spotlight is its own standalone homepage callout.
        </p>

        {loading ? <p>Loading...</p> : null}
        {error ? <p style={{ color: '#991b1b' }}>{error}</p> : null}
        {message ? <p style={{ color: '#166534' }}>{message}</p> : null}

        <div style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
          Source: {meta.source}
          {meta.updated_at ? ` · Updated ${new Date(meta.updated_at).toLocaleString()}` : ''}
          {!meta.configured ? ' · DynamoDB table not configured yet' : ''}
        </div>

        <form onSubmit={saveContent} style={{ display: 'grid', gap: 16 }}>
          <section style={sectionStyle}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Support Block</h2>
            <TextField
              label="Heading"
              name="supportHeading"
              value={content.supportHeading}
              onChange={updateField}
            />
            <TextField
              label="Body"
              name="supportBody"
              value={content.supportBody}
              onChange={updateField}
              multiline
            />
            <TextField
              label="Button label"
              name="supportButtonLabel"
              value={content.supportButtonLabel}
              onChange={updateField}
            />
            <TextField
              label="Button URL"
              name="supportButtonUrl"
              value={content.supportButtonUrl}
              onChange={updateField}
            />
          </section>

          <section style={sectionStyle}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Community Spotlight</h2>
            <ToggleField
              label="Show community spotlight"
              name="spotlightEnabled"
              checked={content.spotlightEnabled}
              onChange={updateField}
            />
            <TextField
              label="Eyebrow"
              name="spotlightEyebrow"
              value={content.spotlightEyebrow}
              onChange={updateField}
            />
            <TextField
              label="Heading"
              name="spotlightHeading"
              value={content.spotlightHeading}
              onChange={updateField}
            />
            <TextField
              label="Body"
              name="spotlightBody"
              value={content.spotlightBody}
              onChange={updateField}
              multiline
            />
            <TextField
              label="Button label"
              name="spotlightButtonLabel"
              value={content.spotlightButtonLabel}
              onChange={updateField}
            />
            <TextField
              label="Button URL"
              name="spotlightButtonUrl"
              value={content.spotlightButtonUrl}
              onChange={updateField}
            />
          </section>

          <section style={sectionStyle}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Social CTA</h2>
            <ToggleField
              label="Show Instagram button with support block"
              name="socialEnabled"
              checked={content.socialEnabled}
              onChange={updateField}
            />
            <TextField
              label="Button label"
              name="socialButtonLabel"
              value={content.socialButtonLabel}
              onChange={updateField}
            />
            <TextField
              label="Instagram URL"
              name="instagramUrl"
              value={content.instagramUrl}
              onChange={updateField}
            />
          </section>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                border: 0,
                borderRadius: 6,
                padding: '10px 14px',
                background: saving ? '#94a3b8' : '#1976d2',
                color: '#fff',
                cursor: saving ? 'default' : 'pointer',
                fontWeight: 700,
              }}
            >
              {saving ? 'Saving...' : 'Save homepage content'}
            </button>
            <button
              type="button"
              onClick={() => setContent(DEFAULT_HOME_CONTENT)}
              disabled={saving}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '10px 14px',
                background: '#fff',
                cursor: saving ? 'default' : 'pointer',
                fontWeight: 700,
              }}
            >
              Reset to defaults
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
