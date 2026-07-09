import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';

const blankSponsor = {
  sponsor_id: '',
  id: '',
  name: '',
  tier: 'partner',
  url: '',
  logo: '',
  active: true,
  episode_ids: [],
  episode_id_entry: '',
};

const MAX_LOGO_UPLOAD_BYTES = 220 * 1024;
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const tierMeta = {
  legacy: {
    title: 'Legacy Sponsors',
    description: 'Shown on the homepage and current season page.',
  },
  partner: {
    title: 'Partner Sponsors',
    description: 'Shown on the homepage and current season page.',
  },
  friend: {
    title: 'Episode Supporters',
    description: 'Shown on the current season page for single-episode support.',
  },
  episode: {
    title: 'Episode Sponsors',
    description: 'Shown only on assigned episode cards.',
  },
};

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '8px 9px',
  font: 'inherit',
};

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 14,
  background: '#fff',
  display: 'grid',
  gap: 12,
  minWidth: 0,
  overflow: 'hidden',
};

const helpStepStyle = {
  border: '1px solid #dbeafe',
  borderRadius: 8,
  padding: 12,
  background: '#f8fbff',
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read logo file'));
    reader.readAsDataURL(file);
  });
}

function extractSpotifyEpisodeId(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';

  const spotifyMatch = text.match(/open\.spotify\.com\/episode\/([^?/#]+)/i);
  if (spotifyMatch?.[1]) return spotifyMatch[1].trim();

  return text;
}

function normalizeEditableSponsor(value = {}) {
  const sponsorId = value.sponsor_id || value.id || '';
  return {
    ...blankSponsor,
    ...value,
    sponsor_id: sponsorId,
    id: sponsorId,
    active: value.active !== false,
    episode_ids: Array.isArray(value.episode_ids) ? value.episode_ids : [],
    episode_id_entry: '',
  };
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ fontWeight: 700, color: '#334155', fontSize: 13 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function SponsorLogoField({ value, onChange, onError }) {
  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      onError('Please use a PNG, JPG, or WebP sponsor logo.');
      return;
    }

    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      onError('Logo file is too large. Please keep sponsor logos under 220 KB.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      onError(err.message || 'Could not read logo file.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          minHeight: 56,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          padding: 8,
        }}
      >
        {value ? (
          <img
            src={value}
            alt="Sponsor logo preview"
            style={{
              maxHeight: 46,
              maxWidth: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 13 }}>No logo yet</span>
        )}
      </div>
      <input
        style={fieldStyle}
        value={value}
        placeholder="/images/sponsors/logo.png or https://..."
        onChange={(event) => onChange(event.target.value)}
      />
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #cbd5e1',
          borderRadius: 6,
          padding: '7px 9px',
          cursor: 'pointer',
          fontWeight: 700,
          color: '#334155',
          background: '#fff',
        }}
      >
        Upload logo
        <input
          type="file"
          accept={ACCEPTED_LOGO_TYPES.join(',')}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </label>
      <span style={{ color: '#64748b', fontSize: 12 }}>
        Best: transparent PNG, roughly 600px wide or smaller, under 220 KB.
      </span>
    </div>
  );
}

function EpisodeAssignments({ sponsor, onChange, onError }) {
  const episodeIds = sponsor.episode_ids || [];

  function addEpisodeId() {
    const episodeId = extractSpotifyEpisodeId(sponsor.episode_id_entry);
    if (!episodeId) return;

    if (episodeIds.includes(episodeId)) {
      onError('That episode is already assigned to this sponsor.');
      return;
    }

    onChange({
      episode_ids: [...episodeIds, episodeId],
      episode_id_entry: '',
    });
  }

  function removeEpisodeId(episodeId) {
    onChange({
      episode_ids: episodeIds.filter((id) => id !== episodeId),
    });
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Field label="Episode sponsor placement">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 8,
            alignItems: 'stretch',
          }}
        >
          <input
            style={fieldStyle}
            value={sponsor.episode_id_entry || ''}
            placeholder="Paste Spotify episode link or ID"
            onChange={(event) =>
              onChange({ episode_id_entry: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addEpisodeId();
              }
            }}
          />
          <button type="button" onClick={addEpisodeId}>
            Add
          </button>
        </div>
      </Field>
      <span
        style={{
          color: '#64748b',
          fontSize: 12,
          lineHeight: 1.45,
          overflowWrap: 'anywhere',
        }}
      >
        The episode ID is in the Spotify episode link after /episode/. Example:
        open.spotify.com/episode/1HUTXoWJtCH7ojnp0CVgJE uses episode ID
        1HUTXoWJtCH7ojnp0CVgJE.
      </span>
      {episodeIds.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {episodeIds.map((episodeId) => (
            <span
              key={episodeId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid #cbd5e1',
                borderRadius: 999,
                padding: '4px 8px',
                background: '#f8fafc',
                color: '#334155',
                fontSize: 12,
              }}
            >
              {episodeId}
              <button
                type="button"
                onClick={() => removeEpisodeId(episodeId)}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#991b1b',
                  fontWeight: 800,
                }}
                aria-label={`Remove ${episodeId}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span style={{ color: '#64748b', fontSize: 12 }}>
          Optional. Add one or more Spotify episode links when this sponsor
          should appear on specific episode cards.
        </span>
      )}
    </div>
  );
}

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState([]);
  const [draft, setDraft] = useState(blankSponsor);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    const groups = { legacy: [], partner: [], friend: [], episode: [] };
    for (const sponsor of sponsors) {
      groups[sponsor.tier]?.push(sponsor);
    }
    return groups;
  }, [sponsors]);

  async function loadSponsors() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/sponsors', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to load sponsors');
      }
      setSponsors((data.sponsors || []).map(normalizeEditableSponsor));
      setConfigured(data.configured === true);
    } catch (err) {
      setError(err.message || 'Failed to load sponsors.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSponsors();
  }, []);

  function updateSponsor(sponsorId, patch) {
    setSponsors((current) =>
      current.map((sponsor) =>
        sponsor.sponsor_id === sponsorId
          ? { ...sponsor, ...patch }
          : sponsor
      )
    );
  }

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function sponsorPayload(sponsor) {
    const {
      episode_id_entry,
      ...cleanSponsor
    } = sponsor;
    return {
      ...cleanSponsor,
      episode_ids: Array.isArray(sponsor.episode_ids)
        ? sponsor.episode_ids
        : [],
    };
  }

  async function saveSponsor(sponsor) {
    setSavingId(sponsor.sponsor_id || 'new');
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/sponsors', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsor: sponsorPayload(sponsor) }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to save sponsor');
      }
      setMessage(`${data.sponsor.name} saved.`);
      setDraft(blankSponsor);
      await loadSponsors();
    } catch (err) {
      setError(err.message || 'Failed to save sponsor.');
    } finally {
      setSavingId('');
    }
  }

  async function deleteSponsor(sponsor) {
    if (deleteConfirmId !== sponsor.sponsor_id) {
      setDeleteConfirmId(sponsor.sponsor_id);
      return;
    }

    setSavingId(sponsor.sponsor_id);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/sponsors', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsor_id: sponsor.sponsor_id }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to delete sponsor');
      }
      setMessage(`${sponsor.name} deleted.`);
      setDeleteConfirmId('');
      await loadSponsors();
    } catch (err) {
      setError(err.message || 'Failed to delete sponsor.');
    } finally {
      setSavingId('');
    }
  }

  function renderSponsorCard(sponsor) {
    const disabled = savingId === sponsor.sponsor_id;

    return (
      <article key={sponsor.sponsor_id} style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <input
              type="checkbox"
              checked={sponsor.active}
              onChange={(event) =>
                updateSponsor(sponsor.sponsor_id, {
                  active: event.target.checked,
                })
              }
            />
            Active
          </label>
          <span
            title={sponsor.sponsor_id}
            style={{
              color: '#64748b',
              fontSize: 12,
              minWidth: 0,
              maxWidth: '48%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {sponsor.sponsor_id}
          </span>
        </div>

        <Field label="Name">
          <input
            style={fieldStyle}
            value={sponsor.name}
            onChange={(event) =>
              updateSponsor(sponsor.sponsor_id, { name: event.target.value })
            }
          />
        </Field>

        <Field label="Tier">
          <select
            style={fieldStyle}
            value={sponsor.tier}
            onChange={(event) =>
              updateSponsor(sponsor.sponsor_id, { tier: event.target.value })
            }
          >
            <option value="legacy">Legacy</option>
            <option value="partner">Partner</option>
            <option value="friend">Episode Supporter</option>
            <option value="episode">Episode</option>
          </select>
        </Field>

        <Field label="Logo">
          <SponsorLogoField
            value={sponsor.logo}
            onChange={(logo) => updateSponsor(sponsor.sponsor_id, { logo })}
            onError={setError}
          />
        </Field>

        <Field label="Website URL">
          <input
            style={fieldStyle}
            value={sponsor.url}
            onChange={(event) =>
              updateSponsor(sponsor.sponsor_id, { url: event.target.value })
            }
          />
        </Field>

        <EpisodeAssignments
          sponsor={sponsor}
          onChange={(patch) => updateSponsor(sponsor.sponsor_id, patch)}
          onError={setError}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => saveSponsor(sponsor)}
          >
            {disabled ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => deleteSponsor(sponsor)}
            style={{
              color: deleteConfirmId === sponsor.sponsor_id ? '#991b1b' : undefined,
            }}
          >
            {deleteConfirmId === sponsor.sponsor_id ? 'Confirm delete' : 'Delete'}
          </button>
        </div>
      </article>
    );
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1220 }}>
        <h1>Sponsors</h1>
        <p style={{ color: '#64748b', maxWidth: 780 }}>
          Manage sponsor records by tier. Sponsors appear automatically in
          their tier; use episode assignments only when a sponsor should also
          appear on specific episode cards.
        </p>

        <section
          aria-label="Sponsor entry guide"
          style={{
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: 14,
            background: '#eff6ff',
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>
            How to enter sponsors
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            <div style={helpStepStyle}>
              <strong>1. Pick the sponsor tier</strong>
              <p style={{ margin: '6px 0 0', color: '#475569' }}>
                Legacy and Partner sponsors show on the homepage and current
                season page. Episode Supporters show on the current season
                page for single-episode support. Episode Sponsors show on
                assigned episode cards.
              </p>
            </div>
            <div style={helpStepStyle}>
              <strong>2. Add the logo</strong>
              <p style={{ margin: '6px 0 0', color: '#475569' }}>
                Use a transparent PNG when possible. Keep uploads under 220 KB,
                or paste a site path or public image URL.
              </p>
            </div>
            <div style={helpStepStyle}>
              <strong>3. Assign episode placements</strong>
              <p style={{ margin: '6px 0 0', color: '#475569' }}>
                Open the episode in Spotify and copy the share link. The ID is
                the part after /episode/, like 1HUTXoWJtCH7ojnp0CVgJE. Paste the
                full link or just that ID, then click Add.
              </p>
            </div>
          </div>
        </section>

        <div style={{ color: configured ? '#166534' : '#92400e', fontSize: 13, marginBottom: 14 }}>
          {configured
            ? 'Sponsor database connected.'
            : 'Sponsor database is not connected yet; showing the built-in sponsor list.'}
        </div>

        {loading ? <p>Loading...</p> : null}
        {error ? <p style={{ color: '#991b1b' }}>{error}</p> : null}
        {message ? <p style={{ color: '#166534' }}>{message}</p> : null}

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            background: '#fff',
            marginBottom: 18,
            display: 'grid',
            gap: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Add Sponsor</h2>
            <p style={{ color: '#64748b', marginBottom: 0 }}>
              New sponsors are added after the existing sponsors in their tier.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Name">
              <input
                style={fieldStyle}
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
              />
            </Field>
            <Field label="Tier">
              <select
                style={fieldStyle}
                value={draft.tier}
                onChange={(event) => updateDraft({ tier: event.target.value })}
              >
                <option value="legacy">Legacy</option>
                <option value="partner">Partner</option>
                <option value="friend">Episode Supporter</option>
                <option value="episode">Episode</option>
              </select>
            </Field>
            <Field label="Website URL">
              <input
                style={fieldStyle}
                value={draft.url}
                onChange={(event) => updateDraft({ url: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Logo">
            <SponsorLogoField
              value={draft.logo}
              onChange={(logo) => updateDraft({ logo })}
              onError={setError}
            />
          </Field>
          <EpisodeAssignments
            sponsor={draft}
            onChange={updateDraft}
            onError={setError}
          />
          <div>
            <button
              type="button"
              disabled={savingId === 'new'}
              onClick={() => saveSponsor(draft)}
            >
              {savingId === 'new' ? 'Adding...' : 'Add sponsor'}
            </button>
          </div>
        </section>

        {['legacy', 'partner', 'friend', 'episode'].map((tier) => (
          <section
            key={tier}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 16,
              background: '#fff',
              marginBottom: 18,
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {tierMeta[tier].title}
              </h2>
              <p style={{ color: '#64748b', margin: '4px 0 0' }}>
                {tierMeta[tier].description}
              </p>
            </div>
            {grouped[tier].length ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 12,
                }}
              >
                {grouped[tier].map(renderSponsorCard)}
              </div>
            ) : (
              <p style={{ color: '#64748b' }}>No sponsors in this tier.</p>
            )}
          </section>
        ))}
      </div>
    </AdminLayout>
  );
}
