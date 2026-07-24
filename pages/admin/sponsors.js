import { useEffect, useMemo, useRef, useState } from 'react';
import Drawer from '@mui/material/Drawer';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import AdminLayout from '../../components/AdminLayout';
import {
  SPONSOR_TIER_IDS,
  addEpisodeAssignment,
  extractSpotifyEpisodeId,
  groupSponsorsForDisplay,
  normalizeEpisodeAssignments,
  slugifySponsorId,
  updateSponsorDraft,
} from '../../lib/sponsorPresentation.mjs';
import ui from '../../styles/AdminPeople.module.css';
import styles from '../../styles/AdminSponsors.module.css';

const MAX_LOGO_UPLOAD_BYTES = 220 * 1024;
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const TIER_META = {
  legacy: {
    label: 'Legacy',
    title: 'Legacy Sponsors',
    description: 'Premier supporters shown on the homepage and current season page.',
  },
  partner: {
    label: 'Partner',
    title: 'Partner Sponsors',
    description: 'Season partners shown on the homepage and current season page.',
  },
  friend: {
    label: 'Episode Supporter',
    title: 'Episode Supporters',
    description: 'Supporting organizations shown on the current season page.',
  },
  episode: {
    label: 'Episode Sponsor',
    title: 'Episode Sponsors',
    description: 'Sponsors shown only on the episode cards assigned below.',
  },
};

const TIER_CLASS_NAMES = {
  legacy: styles.tierLegacy,
  partner: styles.tierPartner,
  friend: styles.tierFriend,
  episode: styles.tierEpisode,
};

function createBlankSponsor() {
  return {
    sponsor_id: '',
    id: '',
    name: '',
    tier: 'partner',
    url: '',
    logo: '',
    promo_code: '',
    promo_details: '',
    id_manually_edited: false,
    active: true,
    episode_ids: [],
    episode_id_entry: '',
    sort_order: 0,
  };
}

function getInitials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function getWebsiteLabel(value = '') {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value || 'No website added';
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that logo file.'));
    reader.readAsDataURL(file);
  });
}

function normalizeEditableSponsor(value = {}) {
  const sponsorId = value.sponsor_id || value.id || '';

  return {
    ...createBlankSponsor(),
    ...value,
    sponsor_id: sponsorId,
    id: sponsorId,
    active: value.active !== false,
    episode_ids: normalizeEpisodeAssignments(value.episode_ids),
    episode_id_entry: '',
  };
}

function sponsorPayload(sponsor) {
  const {
    episode_id_entry,
    id_manually_edited,
    updated_at,
    episode_ids: _episodeIds,
    ...cleanSponsor
  } = sponsor;
  const sortOrder = Number(cleanSponsor.sort_order);
  const episodeIds = normalizeEpisodeAssignments(sponsor.episode_ids);

  return {
    ...cleanSponsor,
    id: cleanSponsor.sponsor_id,
    sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
    episode_ids: episodeIds,
  };
}

function sponsorFingerprint(sponsor) {
  return JSON.stringify(sponsorPayload(sponsor || createBlankSponsor()));
}

function TierBadge({ tier }) {
  const safeTier = TIER_META[tier] ? tier : 'partner';
  return (
    <span
      className={`${styles.tierBadge} ${TIER_CLASS_NAMES[safeTier]}`}
    >
      {TIER_META[safeTier].label}
    </span>
  );
}

function Field({ label, htmlFor, hint, required = false, children }) {
  return (
    <div className={ui.field}>
      <label htmlFor={htmlFor} className={ui.fieldLabel}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <span className={ui.fieldHint}>{hint}</span> : null}
    </div>
  );
}

function ToggleField({ id, label, hint, checked, onChange, disabled }) {
  return (
    <label htmlFor={id} className={ui.toggleField}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={ui.toggleControl} aria-hidden="true">
        <span />
      </span>
      <span className={ui.toggleCopy}>
        <strong>{label}</strong>
        {hint ? <span>{hint}</span> : null}
      </span>
    </label>
  );
}

function SponsorLogoField({
  value,
  idPrefix,
  sponsorName,
  onChange,
  onError,
  onBusyChange,
  disabled,
}) {
  const [uploading, setUploading] = useState(false);
  const uploadLockRef = useRef(false);
  const mountedRef = useRef(true);
  const actionsDisabled = disabled || uploading;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      onBusyChange(false);
    };
  }, [onBusyChange]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || actionsDisabled || uploadLockRef.current) return;

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      onError('Please use a PNG, JPG, or WebP sponsor logo.');
      return;
    }

    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      onError('Please keep sponsor logo files under 220 KB.');
      return;
    }

    uploadLockRef.current = true;
    setUploading(true);
    onBusyChange(true);
    onError('');

    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (mountedRef.current) onChange(dataUrl);
    } catch (err) {
      if (mountedRef.current) {
        onError(err.message || 'Could not read that logo file.');
      }
    } finally {
      uploadLockRef.current = false;
      if (mountedRef.current) {
        setUploading(false);
        onBusyChange(false);
      }
    }
  }

  return (
    <fieldset className={styles.logoFieldset} disabled={actionsDisabled}>
      <legend>Brand logo</legend>
      <div className={styles.logoPreview}>
        {value ? (
          <img src={value} alt={`${sponsorName || 'Sponsor'} logo preview`} />
        ) : (
          <div className={styles.logoEmpty}>
            <ImageRoundedIcon aria-hidden="true" />
            <strong>No logo added</strong>
            <span>Use a path, URL, or upload below.</span>
          </div>
        )}
      </div>

      <Field
        label="Logo path or URL"
        htmlFor={`${idPrefix}-logo`}
        hint="Use an existing /images/sponsors/... path or a complete https:// URL."
      >
        <input
          id={`${idPrefix}-logo`}
          className={ui.input}
          value={value}
          placeholder="/images/sponsors/logo.png"
          onChange={(event) => onChange(event.target.value)}
          disabled={actionsDisabled}
        />
      </Field>

      <div className={styles.logoActions}>
        <label
          className={`${ui.uploadButton} ${
            actionsDisabled ? ui.buttonDisabled : ''
          }`}
        >
          <UploadFileRoundedIcon aria-hidden="true" />
          {uploading ? 'Preparing logo…' : 'Upload logo'}
          <input
            type="file"
            accept={ACCEPTED_LOGO_TYPES.join(',')}
            onChange={handleFileChange}
            disabled={actionsDisabled}
          />
        </label>
        {value ? (
          <button
            type="button"
            className={ui.dangerOutlineButton}
            onClick={() => onChange('')}
            disabled={actionsDisabled}
          >
            <DeleteOutlineRoundedIcon aria-hidden="true" />
            Remove logo
          </button>
        ) : null}
      </div>
      <span className={ui.fieldHint}>
        Transparent PNG is best. Uploads must be 220 KB or smaller.
      </span>
    </fieldset>
  );
}

function EpisodeAssignments({
  sponsor,
  idPrefix,
  onChange,
  onError,
  disabled,
}) {
  const episodeIds = sponsor.episode_ids || [];

  function addEpisodeId() {
    if (disabled) return;
    const rawValue = sponsor.episode_id_entry || '';
    const episodeId = extractSpotifyEpisodeId(rawValue);
    if (!episodeId) {
      onError('Paste a valid Spotify episode link, URI, or episode ID.');
      return;
    }

    const nextIds = addEpisodeAssignment(episodeIds, rawValue);
    if (nextIds.length === episodeIds.length) {
      onError('That episode is already assigned to this sponsor.');
      return;
    }

    onError('');
    onChange({ episode_ids: nextIds, episode_id_entry: '' });
  }

  function removeEpisodeId(index) {
    onError('');
    onChange({
      episode_ids: episodeIds.filter(
        (_, episodeIndex) => episodeIndex !== index
      ),
    });
  }

  return (
    <div className={styles.episodeAssignments}>
      <div className={styles.episodeAddRow}>
        <Field
          label="Spotify episode link or ID"
          htmlFor={`${idPrefix}-episode`}
          hint="Paste a complete Spotify link; the episode ID will be extracted automatically."
        >
          <input
            id={`${idPrefix}-episode`}
            className={ui.input}
            value={sponsor.episode_id_entry || ''}
            placeholder="https://open.spotify.com/episode/..."
            onChange={(event) =>
              onChange({ episode_id_entry: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addEpisodeId();
              }
            }}
            disabled={disabled}
          />
        </Field>
        <button
          type="button"
          className={ui.secondaryButton}
          onClick={addEpisodeId}
          disabled={disabled || !String(sponsor.episode_id_entry || '').trim()}
        >
          Add episode
        </button>
      </div>

      {episodeIds.length ? (
        <div className={styles.episodeChips}>
          {episodeIds.map((episodeId, index) => (
            <span
              key={`${episodeId}-${index}`}
              className={styles.episodeChip}
            >
              <PodcastsRoundedIcon aria-hidden="true" />
              <span title={episodeId}>{episodeId}</span>
              <button
                type="button"
                onClick={() => removeEpisodeId(index)}
                disabled={disabled}
                aria-label={`Remove episode assignment ${episodeId}`}
              >
                <CloseRoundedIcon aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.episodeEmpty}>
          No episode-specific placements assigned.
        </div>
      )}
    </div>
  );
}

function SponsorForm({
  sponsor,
  onChange,
  onError,
  onAssetBusyChange,
  disabled,
  isNew,
  deleteConfirm,
  onRequestDelete,
  onCancelDelete,
}) {
  const idPrefix = `sponsor-${slugifySponsorId(
    sponsor.sponsor_id || sponsor.name || 'new'
  )}`;

  return (
    <div className={ui.formSections}>
      <section className={ui.formSection}>
        <div className={ui.formSectionHeading}>
          <span>01</span>
          <div>
            <h3>Sponsor details</h3>
            <p>Name, placement tier, destination, and display order.</p>
          </div>
        </div>

        <div className={ui.fieldGrid}>
          <Field label="Sponsor name" htmlFor={`${idPrefix}-name`} required>
            <input
              id={`${idPrefix}-name`}
              className={ui.input}
              value={sponsor.name}
              onChange={(event) => onChange({ name: event.target.value })}
              autoComplete="off"
              disabled={disabled}
              required
            />
          </Field>
          <Field
            label="Sponsor ID"
            htmlFor={`${idPrefix}-id`}
            hint={
              isNew
                ? 'Used internally and generated from the name.'
                : 'The existing ID stays fixed to protect this record.'
            }
            required
          >
            <input
              id={`${idPrefix}-id`}
              className={ui.input}
              value={sponsor.sponsor_id}
              onChange={(event) => {
                const sponsorId = slugifySponsorId(event.target.value);
                onChange({
                  sponsor_id: sponsorId,
                  id: sponsorId,
                  id_manually_edited: true,
                });
              }}
              autoComplete="off"
              disabled={disabled || !isNew}
              required
            />
          </Field>
          <Field
            label="Placement tier"
            htmlFor={`${idPrefix}-tier`}
            hint={TIER_META[sponsor.tier]?.description}
          >
            <select
              id={`${idPrefix}-tier`}
              className={ui.input}
              value={sponsor.tier}
              onChange={(event) => onChange({ tier: event.target.value })}
              disabled={disabled}
            >
              {SPONSOR_TIER_IDS.map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_META[tier].label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Display order"
            htmlFor={`${idPrefix}-order`}
            hint="Lower numbers appear first inside this tier."
          >
            <input
              id={`${idPrefix}-order`}
              type="number"
              className={ui.input}
              value={sponsor.sort_order}
              onChange={(event) =>
                onChange({ sort_order: event.target.value })
              }
              disabled={disabled}
            />
          </Field>
        </div>

        <Field
          label="Website URL"
          htmlFor={`${idPrefix}-url`}
          hint="Visitors are sent here when they select the sponsor."
        >
          <input
            id={`${idPrefix}-url`}
            type="url"
            className={ui.input}
            value={sponsor.url}
            placeholder="https://example.com"
            onChange={(event) => onChange({ url: event.target.value })}
            disabled={disabled}
          />
        </Field>
      </section>

      <section className={ui.formSection}>
        <div className={ui.formSectionHeading}>
          <span>02</span>
          <div>
            <h3>Brand logo</h3>
            <p>Preview the exact mark that will appear on public sponsor cards.</p>
          </div>
        </div>
        <SponsorLogoField
          value={sponsor.logo}
          idPrefix={idPrefix}
          sponsorName={sponsor.name}
          onChange={(logo) => onChange({ logo })}
          onError={onError}
          onBusyChange={onAssetBusyChange}
          disabled={disabled}
        />
      </section>

      <section className={ui.formSection}>
        <div className={ui.formSectionHeading}>
          <span>03</span>
          <div>
            <h3>Listener offer</h3>
            <p>Add an optional Avalanche Hour code or sponsor-specific offer.</p>
          </div>
        </div>
        <div className={ui.fieldGrid}>
          <Field
            label="Promo code"
            htmlFor={`${idPrefix}-promo-code`}
            hint="Shown exactly as entered on the Support page."
          >
            <input
              id={`${idPrefix}-promo-code`}
              className={ui.input}
              value={sponsor.promo_code}
              placeholder="AVALANCHEHOUR"
              maxLength={80}
              onChange={(event) =>
                onChange({ promo_code: event.target.value })
              }
              disabled={disabled}
            />
          </Field>
          <Field
            label="Offer details"
            htmlFor={`${idPrefix}-promo-details`}
            hint="For example: 15% off your first order."
          >
            <input
              id={`${idPrefix}-promo-details`}
              className={ui.input}
              value={sponsor.promo_details}
              placeholder="15% off your first order"
              maxLength={240}
              onChange={(event) =>
                onChange({ promo_details: event.target.value })
              }
              disabled={disabled}
            />
          </Field>
        </div>
        <div className={styles.offerPreview}>
          <strong>Support page preview</strong>
          {sponsor.promo_code || sponsor.promo_details ? (
            <div>
              {sponsor.promo_details ? <span>{sponsor.promo_details}</span> : null}
              {sponsor.promo_code ? (
                <code>Use code {sponsor.promo_code}</code>
              ) : null}
            </div>
          ) : (
            <span>No listener offer added. The sponsor will still be listed.</span>
          )}
        </div>
      </section>

      <section className={ui.formSection}>
        <div className={ui.formSectionHeading}>
          <span>04</span>
          <div>
            <h3>Episode placements</h3>
            <p>Optionally attach this sponsor to individual episode cards.</p>
          </div>
        </div>
        <EpisodeAssignments
          sponsor={sponsor}
          idPrefix={idPrefix}
          onChange={onChange}
          onError={onError}
          disabled={disabled}
        />
      </section>

      <section className={ui.formSection}>
        <div className={ui.formSectionHeading}>
          <span>05</span>
          <div>
            <h3>Publishing</h3>
            <p>Hide a sponsor without removing its saved setup.</p>
          </div>
        </div>
        <ToggleField
          id={`${idPrefix}-active`}
          label="Visible on the website"
          hint="Turn this off to keep the sponsor saved but remove it from public pages."
          checked={sponsor.active}
          onChange={(event) => onChange({ active: event.target.checked })}
          disabled={disabled}
        />
      </section>

      {!isNew ? (
        <section className={`${ui.formSection} ${ui.dangerSection}`}>
          <div>
            <h3>Remove sponsor</h3>
            <p>
              This permanently removes the sponsor record. Hiding it above is
              safer if the partnership may return.
            </p>
          </div>
          {deleteConfirm ? (
            <div className={ui.deleteConfirm} role="alert">
              <strong>Delete {sponsor.name} permanently?</strong>
              <span>This cannot be undone from this screen.</span>
              <div>
                <button
                  type="button"
                  className={ui.dangerButton}
                  onClick={onRequestDelete}
                  disabled={disabled}
                >
                  Yes, delete sponsor
                </button>
                <button
                  type="button"
                  className={ui.tertiaryButton}
                  onClick={onCancelDelete}
                  disabled={disabled}
                >
                  Keep sponsor
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={ui.dangerOutlineButton}
              onClick={onRequestDelete}
              disabled={disabled}
            >
              <DeleteOutlineRoundedIcon aria-hidden="true" />
              Delete sponsor
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function SponsorCard({ sponsor, readOnly, onEdit }) {
  return (
    <article className={styles.sponsorCard}>
      <div className={styles.sponsorLogo}>
        {sponsor.logo ? (
          <img src={sponsor.logo} alt="" />
        ) : (
          <span>{getInitials(sponsor.name) || '—'}</span>
        )}
      </div>

      <div className={styles.sponsorMain}>
        <div className={styles.sponsorTopline}>
          <TierBadge tier={sponsor.tier} />
          <span
            className={sponsor.active ? ui.activeStatus : ui.hiddenStatus}
          >
            {sponsor.active ? (
              <CheckCircleRoundedIcon aria-hidden="true" />
            ) : (
              <VisibilityOffRoundedIcon aria-hidden="true" />
            )}
            {sponsor.active ? 'Live' : 'Hidden'}
          </span>
        </div>
        <h3>{sponsor.name || 'Unnamed sponsor'}</h3>
        <p>{getWebsiteLabel(sponsor.url)}</p>
        <div className={styles.sponsorMeta}>
          {sponsor.promo_code ? (
            <>
              <span className={styles.codeMeta}>
                Code {sponsor.promo_code}
              </span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>
            <PodcastsRoundedIcon aria-hidden="true" />
            {sponsor.episode_ids?.length || 0}{' '}
            {(sponsor.episode_ids?.length || 0) === 1
              ? 'episode'
              : 'episodes'}
          </span>
          <span aria-hidden="true">·</span>
          <span>Order {sponsor.sort_order}</span>
        </div>
      </div>

      <button
        type="button"
        className={ui.editButton}
        onClick={onEdit}
        aria-label={`${readOnly ? 'View' : 'Edit'} ${sponsor.name}`}
      >
        <EditRoundedIcon aria-hidden="true" />
        {readOnly ? 'View' : 'Edit'}
      </button>
    </article>
  );
}

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState([]);
  const [baselines, setBaselines] = useState({});
  const [draft, setDraft] = useState(createBlankSponsor);
  const [editor, setEditor] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function loadSponsors() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/store/admin/sponsors', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your account can view this area but cannot manage sponsors.'
              : 'Failed to load sponsors.')
        );
      }

      const nextSponsors = (data.sponsors || []).map(
        normalizeEditableSponsor
      );
      setSponsors(nextSponsors);
      setBaselines(
        Object.fromEntries(
          nextSponsors.map((sponsor) => [sponsor.sponsor_id, sponsor])
        )
      );
      setConfigured(data.configured === true);
      setCanUpdate(data.canUpdate === true);
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
    setSponsors((current) => {
      let updated = false;
      return current.map((sponsor) => {
        if (updated || sponsor.sponsor_id !== sponsorId) return sponsor;
        updated = true;
        return { ...sponsor, ...patch };
      });
    });
    setCloseConfirm(false);
    setError('');
  }

  function updateDraft(patch) {
    setDraft((current) => updateSponsorDraft(current, patch));
    setCloseConfirm(false);
    setError('');
  }

  function openEditor(sponsorId) {
    setEditor({ mode: 'edit', sponsorId });
    setDeleteConfirm(false);
    setCloseConfirm(false);
    setAssetBusy(false);
    setError('');
    setMessage('');
  }

  function openAddEditor() {
    setDraft(createBlankSponsor());
    setEditor({ mode: 'add', sponsorId: '' });
    setDeleteConfirm(false);
    setCloseConfirm(false);
    setAssetBusy(false);
    setError('');
    setMessage('');
  }

  const editorSponsor =
    editor?.mode === 'add'
      ? draft
      : sponsors.find(
          (sponsor) => sponsor.sponsor_id === editor?.sponsorId
        ) || null;
  const editorBaseline =
    editor?.mode === 'add'
      ? createBlankSponsor()
      : baselines[editor?.sponsorId] || null;
  const editorDirty = Boolean(
    editorSponsor &&
      editorBaseline &&
      sponsorFingerprint(editorSponsor) !==
        sponsorFingerprint(editorBaseline)
  );

  function closeEditor() {
    setEditor(null);
    setDeleteConfirm(false);
    setCloseConfirm(false);
    setAssetBusy(false);
    setError('');
  }

  function requestCloseEditor() {
    if (saving || assetBusy) return;
    if (editorDirty) {
      setCloseConfirm(true);
      return;
    }
    closeEditor();
  }

  function discardAndCloseEditor() {
    if (editor?.mode === 'edit' && editorBaseline) {
      setSponsors((current) =>
        current.map((sponsor) =>
          sponsor.sponsor_id === editor.sponsorId
            ? editorBaseline
            : sponsor
        )
      );
    } else {
      setDraft(createBlankSponsor());
    }
    closeEditor();
  }

  async function saveSponsor(event) {
    event.preventDefault();
    if (
      !configured ||
      !canUpdate ||
      !editorSponsor ||
      saving ||
      assetBusy
    ) {
      return;
    }

    const isNew = editor?.mode === 'add';
    const payload = sponsorPayload(editorSponsor);

    if (!payload.name || !payload.sponsor_id) {
      setError('Sponsor name and ID are required.');
      return;
    }

    const conflictingSponsor = sponsors.find(
      (sponsor) =>
        sponsor.sponsor_id === payload.sponsor_id &&
        (isNew || sponsor.sponsor_id !== editorSponsor.sponsor_id)
    );
    if (conflictingSponsor) {
      setError(
        `That sponsor ID is already used by ${conflictingSponsor.name}. Choose a different one.`
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/sponsors', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsor: payload,
          create: isNew,
          ...(!isNew
            ? { expected_updated_at: editorBaseline?.updated_at || '' }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your account does not have permission to save sponsors.'
              : 'Failed to save this sponsor.')
        );
      }

      const savedSponsor = normalizeEditableSponsor(data.sponsor);
      setSponsors((current) => {
        if (isNew) {
          return [
            ...current.filter(
              (sponsor) =>
                sponsor.sponsor_id !== savedSponsor.sponsor_id
            ),
            savedSponsor,
          ];
        }

        return current.map((sponsor) =>
          sponsor.sponsor_id === editorSponsor.sponsor_id
            ? savedSponsor
            : sponsor
        );
      });
      setBaselines((current) => ({
        ...current,
        [savedSponsor.sponsor_id]: savedSponsor,
      }));
      setDraft(createBlankSponsor());
      setEditor(null);
      setDeleteConfirm(false);
      setCloseConfirm(false);
      setAssetBusy(false);
      setMessage(
        savedSponsor.active
          ? `${savedSponsor.name} is saved and live.`
          : `${savedSponsor.name} is saved and remains hidden.`
      );
    } catch (err) {
      setError(err.message || 'Failed to save this sponsor.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSponsor() {
    if (
      !configured ||
      !canUpdate ||
      !editorSponsor ||
      editor?.mode !== 'edit'
    ) {
      return;
    }

    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/sponsors', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsor_id: editorSponsor.sponsor_id,
          expected_updated_at: editorBaseline?.updated_at || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your account does not have permission to delete sponsors.'
              : 'Failed to delete this sponsor.')
        );
      }

      const deletedName = editorSponsor.name;
      setSponsors((current) =>
        current.filter(
          (sponsor) => sponsor.sponsor_id !== editorSponsor.sponsor_id
        )
      );
      setBaselines((current) => {
        const next = { ...current };
        delete next[editorSponsor.sponsor_id];
        return next;
      });
      setEditor(null);
      setDeleteConfirm(false);
      setCloseConfirm(false);
      setAssetBusy(false);
      setMessage(`${deletedName} was removed from sponsors.`);
    } catch (err) {
      setError(err.message || 'Failed to delete this sponsor.');
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(
    () => groupSponsorsForDisplay(sponsors),
    [sponsors]
  );
  const visibleGrouped = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const next = {
      legacy: [],
      partner: [],
      friend: [],
      episode: [],
    };

    for (const tier of SPONSOR_TIER_IDS) {
      next[tier] = grouped[tier].filter((sponsor) => {
        if (statusFilter === 'active' && !sponsor.active) return false;
        if (statusFilter === 'hidden' && sponsor.active) return false;
        if (!cleanQuery) return true;

        return [
          sponsor.name,
          sponsor.url,
          sponsor.promo_code,
          sponsor.promo_details,
          TIER_META[sponsor.tier]?.label,
          ...(sponsor.episode_ids || []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(cleanQuery);
      });
    }

    return next;
  }, [grouped, query, statusFilter]);

  const activeCount = sponsors.filter((sponsor) => sponsor.active).length;
  const offerCount = sponsors.filter(
    (sponsor) => sponsor.promo_code || sponsor.promo_details
  ).length;
  const canSave = Boolean(
    configured &&
      canUpdate &&
      editorDirty &&
      editorSponsor?.name.trim() &&
      editorSponsor?.sponsor_id.trim() &&
      !saving &&
      !assetBusy
  );

  return (
    <AdminLayout>
      <div className={`${ui.page} ${styles.page}`}>
        <header className={ui.pageHeader}>
          <div>
            <span className={ui.eyebrow}>Website partnerships</span>
            <h1>Sponsors</h1>
            <p>
              Manage sponsor branding, placement tiers, and episode-specific
              support from one clean workspace.
            </p>
          </div>
          <button
            type="button"
            className={ui.primaryButton}
            onClick={openAddEditor}
            disabled={loading || !configured || !canUpdate}
            title={
              !configured
                ? 'Connect the sponsor database before adding a sponsor.'
                : !canUpdate
                  ? 'Your account can view sponsors but cannot change them.'
                  : undefined
            }
          >
            <AddRoundedIcon aria-hidden="true" />
            Add sponsor
          </button>
        </header>

        {error && !editor ? (
          <div className={ui.errorNotice} role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className={ui.successNotice} role="status" aria-live="polite">
            <CheckCircleRoundedIcon aria-hidden="true" />
            {message}
          </div>
        ) : null}
        {!configured && !loading && !error ? (
          <div className={ui.readOnlyNotice} role="status">
            <CloudOffRoundedIcon aria-hidden="true" />
            <div>
              <strong>Preview mode</strong>
              <span>
                The sponsor database is not connected, so the built-in list is
                available to view but cannot be changed.
              </span>
            </div>
          </div>
        ) : null}
        {configured && !canUpdate && !loading && !error ? (
          <div className={ui.readOnlyNotice} role="status">
            <CloudOffRoundedIcon aria-hidden="true" />
            <div>
              <strong>Read-only access</strong>
              <span>
                Your account can review sponsor details but cannot publish
                changes.
              </span>
            </div>
          </div>
        ) : null}

        <section className={ui.statsGrid} aria-label="Sponsor overview">
          <div className={ui.statCard}>
            <span>Total sponsors</span>
            <strong>{loading ? '—' : sponsors.length}</strong>
            <small>Across all placement tiers</small>
          </div>
          <div className={ui.statCard}>
            <span>Visible</span>
            <strong>{loading ? '—' : activeCount}</strong>
            <small>Published on the website</small>
          </div>
          <div className={ui.statCard}>
            <span>Listener offers</span>
            <strong>{loading ? '—' : offerCount}</strong>
            <small>Codes or sponsor-specific offers</small>
          </div>
          <div className={`${ui.statCard} ${ui.connectionCard}`}>
            {configured ? (
              <CloudDoneRoundedIcon aria-hidden="true" />
            ) : (
              <CloudOffRoundedIcon aria-hidden="true" />
            )}
            <div>
              <span>Sponsor database</span>
              <strong>{configured ? 'Connected' : 'Preview only'}</strong>
              <small>
                {configured
                  ? canUpdate
                    ? 'Changes can be saved'
                    : 'Read only for your account'
                  : 'Editing is unavailable'}
              </small>
            </div>
          </div>
        </section>

        <details className={styles.placementGuide}>
          <summary>
            <HandshakeRoundedIcon aria-hidden="true" />
            How sponsor placements work
          </summary>
          <div className={styles.placementGuideGrid}>
            {SPONSOR_TIER_IDS.map((tier) => (
              <div key={tier}>
                <TierBadge tier={tier} />
                <strong>{TIER_META[tier].title}</strong>
                <span>{TIER_META[tier].description}</span>
              </div>
            ))}
          </div>
        </details>

        <section className={ui.rosterSurface}>
          <div className={ui.rosterToolbar}>
            <div className={ui.searchField}>
              <SearchRoundedIcon aria-hidden="true" />
              <label
                htmlFor="sponsor-search"
                className={ui.visuallyHidden}
              >
                Search sponsors
              </label>
              <input
                id="sponsor-search"
                type="search"
                value={query}
                placeholder="Search by sponsor, website, tier, or episode"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className={ui.filterField}>
              <label htmlFor="sponsor-status">Show</label>
              <select
                id="sponsor-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All sponsors</option>
                <option value="active">Visible only</option>
                <option value="hidden">Hidden only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className={ui.loadingState} role="status">
              <span />
              Loading sponsors…
            </div>
          ) : (
            SPONSOR_TIER_IDS.map((tier) => {
              const visibleSponsors = visibleGrouped[tier];
              const totalSponsors = grouped[tier].length;

              return (
                <section key={tier} className={ui.peopleSection}>
                  <div className={ui.sectionHeader}>
                    <div>
                      <div className={ui.sectionTitleRow}>
                        <h2>{TIER_META[tier].title}</h2>
                        <span>{totalSponsors}</span>
                      </div>
                      <p>{TIER_META[tier].description}</p>
                    </div>
                  </div>

                  {visibleSponsors.length ? (
                    <div className={styles.sponsorGrid}>
                      {visibleSponsors.map((sponsor) => (
                        <SponsorCard
                          key={sponsor.sponsor_id}
                          sponsor={sponsor}
                          readOnly={!configured || !canUpdate}
                          onEdit={() => openEditor(sponsor.sponsor_id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={ui.emptyRoster}>
                      {totalSponsors
                        ? 'No sponsors in this tier match the current filters.'
                        : `No ${TIER_META[tier].title.toLowerCase()} have been added yet.`}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </section>
      </div>

      <Drawer
        anchor="right"
        open={Boolean(editorSponsor)}
        onClose={requestCloseEditor}
        PaperProps={{ className: ui.drawerPaper }}
      >
        {editorSponsor ? (
          <form className={ui.editor} onSubmit={saveSponsor}>
            <header className={ui.editorHeader}>
              <div>
                <span className={ui.eyebrow}>
                  {editor?.mode === 'add' ? 'New sponsor' : 'Sponsor editor'}
                </span>
                <h2>
                  {editor?.mode === 'add'
                    ? 'Add a sponsor'
                    : editorSponsor.name}
                </h2>
                <div className={ui.editorStatusLine}>
                  <TierBadge tier={editorSponsor.tier} />
                  {editorDirty ? (
                    <span className={ui.unsavedBadge}>Unsaved changes</span>
                  ) : (
                    <span className={ui.savedBadge}>Up to date</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={ui.closeButton}
                onClick={requestCloseEditor}
                aria-label="Close sponsor editor"
                disabled={saving || assetBusy}
              >
                <CloseRoundedIcon aria-hidden="true" />
              </button>
            </header>

            {!configured || !canUpdate ? (
              <div className={ui.editorReadOnly}>
                {!configured
                  ? 'Preview only — connect the sponsor database to edit this record.'
                  : 'Read only — your account can review this record but cannot change it.'}
              </div>
            ) : null}
            {error ? (
              <div className={ui.errorNotice} role="alert">
                {error}
              </div>
            ) : null}

            <div className={ui.editorBody}>
              <SponsorForm
                sponsor={editorSponsor}
                onChange={
                  editor?.mode === 'add'
                    ? updateDraft
                    : (patch) => updateSponsor(editor.sponsorId, patch)
                }
                onError={setError}
                onAssetBusyChange={setAssetBusy}
                disabled={saving || !configured || !canUpdate}
                isNew={editor?.mode === 'add'}
                deleteConfirm={deleteConfirm}
                onRequestDelete={deleteSponsor}
                onCancelDelete={() => setDeleteConfirm(false)}
              />
            </div>

            <footer className={ui.editorFooter}>
              {closeConfirm ? (
                <div className={ui.discardPrompt} role="alert">
                  <div>
                    <strong>Discard unsaved changes?</strong>
                    <span>Nothing has changed on the live website yet.</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className={ui.dangerOutlineButton}
                      onClick={discardAndCloseEditor}
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      className={ui.tertiaryButton}
                      onClick={() => setCloseConfirm(false)}
                    >
                      Keep editing
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={ui.saveContext}>
                    <strong>
                      {assetBusy
                        ? 'Preparing logo'
                        : editorDirty
                          ? 'Draft changes'
                          : 'No unsaved changes'}
                    </strong>
                    <span>
                      {assetBusy
                        ? 'Please wait a moment before saving or closing.'
                        : editorDirty
                          ? 'Your edits are not live until you save.'
                          : 'This sponsor matches the live version.'}
                    </span>
                  </div>
                  <div className={ui.footerButtons}>
                    <button
                      type="button"
                      className={ui.tertiaryButton}
                      onClick={requestCloseEditor}
                      disabled={saving || assetBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={ui.primaryButton}
                      disabled={!canSave}
                    >
                      <SaveRoundedIcon aria-hidden="true" />
                      {saving
                        ? 'Saving…'
                        : editor?.mode === 'add'
                          ? 'Add sponsor'
                          : 'Save changes'}
                    </button>
                  </div>
                </>
              )}
            </footer>
          </form>
        ) : null}
      </Drawer>
    </AdminLayout>
  );
}
