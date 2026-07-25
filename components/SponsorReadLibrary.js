import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import AdminLayout from './AdminLayout';
import FriendlyDateField from './FriendlyDateField';
import StudioLayout from './StudioLayout';
import styles from '../styles/SponsorReads.module.css';

const EMPTY_READ = {
  sponsor_read_id: '',
  sponsor_id: '',
  sponsor_name: '',
  script_title: '',
  approved_text: '',
  pronunciation_guidance: '',
  host_instructions: '',
  effective_date: '',
  expiration_date: '',
  state: 'draft',
  version_number: 1,
  version_history: [],
  updated_at: '',
};

function operationalState(read) {
  const today = new Date().toISOString().slice(0, 10);
  if (
    read.state === 'approved' &&
    read.expiration_date &&
    read.expiration_date < today
  ) {
    return 'expired';
  }
  return read.state;
}

function formatDateTime(value) {
  if (!value) return 'Not yet saved';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function SponsorReadLibrary({ admin = false }) {
  const [reads, setReads] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(EMPTY_READ);
  const [canUpdate, setCanUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const Layout = admin ? AdminLayout : StudioLayout;

  useEffect(() => {
    let alive = true;

    async function loadSponsorReads() {
      try {
        const response = await fetch('/api/studio/sponsor-reads', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load sponsor reads.');
        }
        if (!alive) return;
        setReads(data.sponsor_reads || []);
        setSponsors(data.sponsors || []);
        setCanUpdate(data.canUpdate === true);
      } catch (loadError) {
        if (alive) {
          setError(loadError.message || 'Could not load sponsor reads.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadSponsorReads();
    return () => {
      alive = false;
    };
  }, []);

  const selected = useMemo(
    () => reads.find((read) => read.sponsor_read_id === selectedId),
    [reads, selectedId]
  );

  function selectRead(read) {
    setSelectedId(read.sponsor_read_id);
    setDraft(read);
    setShowHistory(false);
    setError('');
    setMessage('');
  }

  function startNew() {
    setSelectedId('');
    setDraft(EMPTY_READ);
    setShowHistory(false);
    setError('');
    setMessage('');
  }

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError('');
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    if (!canUpdate || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const creating = !draft.sponsor_read_id;
      const response = await fetch('/api/studio/sponsor-reads', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          create: creating,
          expected_updated_at: draft.updated_at,
          sponsor_read: draft,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not save the sponsor read.');
      }
      const saved = data.sponsor_read;
      setReads((current) => [
        ...current.filter(
          (read) => read.sponsor_read_id !== saved.sponsor_read_id
        ),
        saved,
      ]);
      setSelectedId(saved.sponsor_read_id);
      setDraft(saved);
      setMessage(
        creating
          ? 'Sponsor read created.'
          : `Version ${saved.version_number} saved with attribution.`
      );
    } catch (saveError) {
      setError(saveError.message || 'Could not save the sponsor read.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout
      requiredPermission="sponsor_reads:read"
      hasUnsavedChanges={Boolean(
        selected ? JSON.stringify(selected) !== JSON.stringify(draft) : false
      )}
    >
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <span>Sponsor read library</span>
            <h1>Approved language, versioned for production</h1>
            <p>
              Maintain current sponsor scripts here. Episode assignments keep
              their own frozen copy so later edits never rewrite past work.
            </p>
          </div>
          {canUpdate ? (
            <button type="button" onClick={startNew}>
              <AddRoundedIcon aria-hidden="true" />
              New sponsor read
            </button>
          ) : null}
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p className={styles.success}>{message}</p> : null}

        <div className={styles.layout}>
          <aside className={styles.library}>
            <div className={styles.libraryHeading}>
              <strong>{reads.length} scripts</strong>
              <span>Multiple reads per sponsor are supported</span>
            </div>
            {loading ? (
              <p>Loading approved language…</p>
            ) : reads.length ? (
              reads.map((read) => {
                const state = operationalState(read);
                return (
                  <button
                    type="button"
                    key={read.sponsor_read_id}
                    className={
                      read.sponsor_read_id === selectedId
                        ? styles.readSelected
                        : ''
                    }
                    onClick={() => selectRead(read)}
                  >
                    <span className={styles.state} data-state={state}>
                      {state}
                    </span>
                    <strong>{read.sponsor_name}</strong>
                    <span>{read.script_title}</span>
                    <small>Version {read.version_number}</small>
                  </button>
                );
              })
            ) : (
              <p>No sponsor reads have been created yet.</p>
            )}
          </aside>

          <form className={styles.editor} onSubmit={save}>
            <div className={styles.editorHeading}>
              <div>
                <span>{draft.sponsor_read_id ? 'Edit script' : 'New script'}</span>
                <h2>{draft.script_title || 'Sponsor read details'}</h2>
              </div>
              {draft.sponsor_read_id ? (
                <span>Version {draft.version_number}</span>
              ) : null}
            </div>

            <div className={styles.grid}>
              <label>
                Sponsor
                <select
                  value={draft.sponsor_id}
                  onChange={(event) => update('sponsor_id', event.target.value)}
                  disabled={!canUpdate || saving}
                  required
                >
                  <option value="">Choose a sponsor</option>
                  {sponsors.map((sponsor) => (
                    <option
                      key={sponsor.sponsor_id}
                      value={sponsor.sponsor_id}
                    >
                      {sponsor.name}{sponsor.active ? '' : ' (inactive)'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Script title
                <input
                  value={draft.script_title}
                  onChange={(event) =>
                    update('script_title', event.target.value)
                  }
                  disabled={!canUpdate || saving}
                  required
                  maxLength={220}
                />
              </label>
              <label>
                State
                <select
                  value={draft.state}
                  onChange={(event) => update('state', event.target.value)}
                  disabled={!canUpdate || saving}
                >
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="expired">Expired</option>
                  <option value="retired">Retired</option>
                </select>
              </label>
              <label>
                Effective date
                <FriendlyDateField
                  value={draft.effective_date}
                  onChange={(event) =>
                    update('effective_date', event.target.value)
                  }
                  disabled={!canUpdate || saving}
                  ariaLabel="sponsor read effective date"
                />
              </label>
              <label>
                Expiration date
                <FriendlyDateField
                  value={draft.expiration_date}
                  onChange={(event) =>
                    update('expiration_date', event.target.value)
                  }
                  disabled={!canUpdate || saving}
                  ariaLabel="sponsor read expiration date"
                />
              </label>
            </div>

            <label className={styles.fullField}>
              Full approved read text
              <textarea
                value={draft.approved_text}
                onChange={(event) =>
                  update('approved_text', event.target.value)
                }
                disabled={!canUpdate || saving}
                required
                maxLength={12000}
              />
            </label>
            <label className={styles.fullField}>
              Pronunciation guidance
              <textarea
                value={draft.pronunciation_guidance}
                onChange={(event) =>
                  update('pronunciation_guidance', event.target.value)
                }
                disabled={!canUpdate || saving}
                maxLength={3000}
              />
            </label>
            <label className={styles.fullField}>
              Additional host instructions
              <textarea
                value={draft.host_instructions}
                onChange={(event) =>
                  update('host_instructions', event.target.value)
                }
                disabled={!canUpdate || saving}
                maxLength={3000}
              />
            </label>

            {draft.updated_at ? (
              <div className={styles.attribution}>
                <CheckCircleRoundedIcon aria-hidden="true" />
                <span>
                  Last saved by {draft.updated_by_name || 'Studio team'} on{' '}
                  {formatDateTime(draft.updated_at)}
                </span>
              </div>
            ) : null}

            <div className={styles.actions}>
              {draft.version_history?.length ? (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setShowHistory((current) => !current)}
                >
                  <HistoryRoundedIcon aria-hidden="true" />
                  {showHistory ? 'Hide history' : 'Version history'}
                </button>
              ) : null}
              {canUpdate ? (
                <button type="submit" disabled={saving}>
                  <SaveRoundedIcon aria-hidden="true" />
                  {saving ? 'Saving…' : 'Save new version'}
                </button>
              ) : null}
            </div>

            {showHistory ? (
              <div className={styles.history}>
                {draft.version_history
                  .slice()
                  .reverse()
                  .map((version) => (
                    <article key={`${version.version_number}-${version.recorded_at}`}>
                      <strong>Version {version.version_number}</strong>
                      <span>
                        {version.state} · {version.attributed_to_name || 'Studio team'} ·{' '}
                        {formatDateTime(version.recorded_at)}
                      </span>
                      <p>{version.approved_text}</p>
                    </article>
                  ))}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </Layout>
  );
}
