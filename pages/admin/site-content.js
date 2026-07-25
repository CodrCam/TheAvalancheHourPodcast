import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import AdminLayout from '../../components/AdminLayout';
import { DEFAULT_HOME_CONTENT } from '../../lib/siteContentDefaults';
import ui from '../../styles/AdminPeople.module.css';
import styles from '../../styles/AdminSiteContent.module.css';

function cloneDefaultContent() {
  return { ...DEFAULT_HOME_CONTENT };
}

function contentFingerprint(value = {}) {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(DEFAULT_HOME_CONTENT).map((key) => [key, value[key]])
    )
  );
}

function formatUpdatedAt(value) {
  if (!value) return 'Not published yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recently published'
    : date.toLocaleString();
}

function Field({
  label,
  htmlFor,
  hint,
  required = false,
  children,
}) {
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

function TextField({
  label,
  name,
  value,
  onChange,
  hint,
  multiline = false,
  type = 'text',
  required = false,
  disabled = false,
  maxLength,
}) {
  const Component = multiline ? 'textarea' : 'input';
  return (
    <Field
      label={label}
      htmlFor={`site-content-${name}`}
      hint={hint}
      required={required}
    >
      <Component
        id={`site-content-${name}`}
        name={name}
        type={multiline ? undefined : type}
        value={value}
        onChange={onChange}
        rows={multiline ? 5 : undefined}
        className={multiline ? ui.textarea : ui.input}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
      />
    </Field>
  );
}

function ToggleField({ id, label, hint, checked, onChange, disabled }) {
  return (
    <label htmlFor={id} className={ui.toggleField}>
      <input
        id={id}
        type="checkbox"
        name={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={ui.toggleControl} aria-hidden="true">
        <span />
      </span>
      <span className={ui.toggleCopy}>
        <strong>{label}</strong>
        <span>{hint}</span>
      </span>
    </label>
  );
}

function PreviewCard({ label, hidden = false, children }) {
  return (
    <aside
      className={`${styles.previewCard} ${
        hidden ? styles.previewHidden : ''
      }`}
      aria-label={`${label} preview`}
    >
      <div className={styles.previewHeader}>
        <span>Draft preview</span>
        {hidden ? (
          <span className={styles.previewStatusHidden}>
            <VisibilityOffRoundedIcon aria-hidden="true" />
            Hidden
          </span>
        ) : (
          <span className={styles.previewStatusLive}>
            <VisibilityRoundedIcon aria-hidden="true" />
            Shown
          </span>
        )}
      </div>
      <div className={styles.previewBody}>{children}</div>
    </aside>
  );
}

export default function AdminSiteContentPage() {
  const [content, setContent] = useState(cloneDefaultContent);
  const [baseline, setBaseline] = useState(cloneDefaultContent);
  const [meta, setMeta] = useState({
    source: 'default',
    configured: false,
    updated_at: '',
  });
  const [canUpdate, setCanUpdate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [discardArmed, setDiscardArmed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const errorNoticeRef = useRef(null);

  const dirty = useMemo(
    () => contentFingerprint(content) !== contentFingerprint(baseline),
    [baseline, content]
  );
  const canManage = loaded && meta.configured && canUpdate;
  const formDisabled = !canManage || saving;
  const visibleBlocks =
    Number(content.spotlightEnabled) +
    Number(content.featuredLinkEnabled) +
    Number(content.donateEnabled);

  async function loadContent() {
    setLoading(true);
    setLoaded(false);
    setError('');
    setMessage('');
    setResetArmed(false);
    setDiscardArmed(false);

    try {
      const res = await fetch('/api/store/admin/site-content', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to load site content.');
      }

      const nextContent = {
        ...DEFAULT_HOME_CONTENT,
        ...(data.content || {}),
      };
      setContent(nextContent);
      setBaseline(nextContent);
      setMeta({
        source: data.source || 'default',
        configured: data.configured === true,
        updated_at: data.updated_at || '',
      });
      setCanUpdate(data.canUpdate === true);
      setLoaded(true);
    } catch (err) {
      setError(err.message || 'Failed to load site content.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    if (!error) return;
    errorNoticeRef.current?.focus({ preventScroll: true });
    errorNoticeRef.current?.scrollIntoView({ block: 'center' });
  }, [error]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setContent((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setMessage('');
    setError('');
    setResetArmed(false);
    setDiscardArmed(false);
  }

  async function saveContent(event) {
    event.preventDefault();
    if (!canManage || !dirty || saving) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/site-content', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          expected_updated_at: meta.updated_at || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your account does not have permission to save site content.'
              : 'Failed to save site content.')
        );
      }

      const savedContent = {
        ...DEFAULT_HOME_CONTENT,
        ...(data.content || {}),
      };
      setContent(savedContent);
      setBaseline(savedContent);
      setMeta({
        source: data.source || 'dynamo',
        configured: data.configured === true,
        updated_at: data.updated_at || '',
      });
      setResetArmed(false);
      setDiscardArmed(false);
      setMessage('Site content is saved and live.');
    } catch (err) {
      setError(err.message || 'Failed to save site content.');
    } finally {
      setSaving(false);
    }
  }

  function loadDefaults() {
    setContent(cloneDefaultContent());
    setResetArmed(false);
    setDiscardArmed(false);
    setMessage('');
    setError('');
  }

  function discardDraft() {
    setContent({ ...baseline });
    setResetArmed(false);
    setDiscardArmed(false);
    setMessage('');
    setError('');
  }

  function reloadLatest() {
    if (
      dirty &&
      !window.confirm(
        'Reload the latest published content and discard this unsaved draft?'
      )
    ) {
      return;
    }
    loadContent();
  }

  return (
    <AdminLayout
      hasUnsavedChanges={dirty}
      unsavedChangesMessage="You have unsaved site-content changes. Leave this page and discard them?"
    >
      <div className={`${ui.page} ${styles.page}`}>
        <header className={ui.pageHeader}>
          <div>
            <span className={ui.eyebrow}>Website content</span>
            <h1>Site Content</h1>
            <p>
              Shape the About page and the homepage support, community,
              featured-link, and donation actions from one focused publishing
              workspace.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link
              href="/about"
              target="_blank"
              rel="noopener noreferrer"
              className={ui.tertiaryButton}
            >
              <OpenInNewRoundedIcon aria-hidden="true" />
              View About
            </Link>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={ui.primaryButton}
            >
              <OpenInNewRoundedIcon aria-hidden="true" />
              View homepage
            </Link>
          </div>
        </header>

        {error ? (
          <div
            ref={errorNoticeRef}
            className={ui.errorNotice}
            role="alert"
            tabIndex={-1}
          >
            <span>{error}</span>
            {!loading && (!loaded || /changed/i.test(error)) ? (
              <button
                type="button"
                className={styles.retryButton}
                onClick={loaded ? reloadLatest : loadContent}
              >
                {loaded ? 'Reload and discard draft' : 'Try again'}
              </button>
            ) : null}
          </div>
        ) : null}
        {message ? (
          <div className={ui.successNotice} role="status" aria-live="polite">
            <CheckCircleRoundedIcon aria-hidden="true" />
            {message}
          </div>
        ) : null}
        {!meta.configured && loaded && !error ? (
          <div className={ui.readOnlyNotice} role="status">
            <CloudOffRoundedIcon aria-hidden="true" />
            <div>
              <strong>Preview mode</strong>
              <span>
                Built-in content is available to review, but the site-content
                database is not connected, so changes cannot be published.
              </span>
            </div>
          </div>
        ) : null}
        {meta.configured && !canUpdate && loaded && !error ? (
          <div className={ui.readOnlyNotice} role="status">
            <CloudOffRoundedIcon aria-hidden="true" />
            <div>
              <strong>Read-only access</strong>
              <span>
                Your account can review the current copy but cannot publish
                site-content changes.
              </span>
            </div>
          </div>
        ) : null}

        <section className={styles.statsGrid} aria-label="Site content overview">
          <div className={`${ui.statCard} ${styles.sourceCard}`}>
            {meta.configured ? (
              <CloudDoneRoundedIcon aria-hidden="true" />
            ) : (
              <CloudOffRoundedIcon aria-hidden="true" />
            )}
            <div>
              <span>Content source</span>
              <strong>
                {loading
                  ? 'Loading'
                  : !loaded
                    ? 'Unavailable'
                  : meta.source === 'dynamo'
                    ? 'Published'
                    : 'Built-in copy'}
              </strong>
              <small>
                {!loaded
                  ? 'Content could not be read'
                  : meta.configured
                    ? 'Storage connected'
                    : 'Preview only'}
              </small>
            </div>
          </div>
          <div className={ui.statCard}>
            <span>Last published</span>
            <strong className={styles.dateValue}>
              {loading || !loaded ? '—' : meta.updated_at ? 'Saved' : 'Not yet'}
            </strong>
            <small>
              {loaded ? formatUpdatedAt(meta.updated_at) : 'Unavailable'}
            </small>
          </div>
          <div className={ui.statCard}>
            <span>Homepage actions</span>
            <strong>{loading || !loaded ? '—' : visibleBlocks}</strong>
            <small>Spotlight, featured link, and donate shown</small>
          </div>
          <div className={`${ui.statCard} ${styles.draftCard}`}>
            <span>Editor status</span>
            <strong>
              {loading || !loaded ? '—' : dirty ? 'Draft' : 'Current'}
            </strong>
            <small>
              {!loaded
                ? 'Unavailable'
                : dirty
                  ? 'Unsaved changes in this browser'
                  : 'Matches published copy'}
            </small>
          </div>
        </section>

        {loading ? (
          <div className={ui.rosterSurface}>
            <div className={ui.loadingState} role="status">
              <span />
              Loading site content…
            </div>
          </div>
        ) : loaded ? (
          <form className={styles.contentForm} onSubmit={saveContent}>
            <section
              id="about-page-content"
              className={`${ui.formSection} ${styles.contentSection}`}
            >
              <div className={ui.formSectionHeading}>
                <span>01</span>
                <div>
                  <h2>About page</h2>
                  <p>
                    The program story, mission callout, and optional listening
                    link shown above the Hosts &amp; Team roster.
                  </p>
                </div>
              </div>
              <div className={styles.sectionLayout}>
                <div className={styles.sectionFields}>
                  <div className={ui.fieldGrid}>
                    <TextField
                      label="Eyebrow"
                      name="aboutEyebrow"
                      value={content.aboutEyebrow}
                      onChange={updateField}
                      required
                      disabled={formDisabled}
                      maxLength={80}
                    />
                    <TextField
                      label="Mission heading"
                      name="aboutMissionHeading"
                      value={content.aboutMissionHeading}
                      onChange={updateField}
                      required
                      disabled={formDisabled}
                      maxLength={120}
                    />
                  </div>
                  <TextField
                    label="Main heading"
                    name="aboutHeading"
                    value={content.aboutHeading}
                    onChange={updateField}
                    multiline
                    required
                    disabled={formDisabled}
                    maxLength={240}
                  />
                  <TextField
                    label="Program description"
                    name="aboutIntro"
                    value={content.aboutIntro}
                    onChange={updateField}
                    multiline
                    required
                    disabled={formDisabled}
                    maxLength={1800}
                  />
                  <TextField
                    label="Mission body"
                    name="aboutMissionBody"
                    value={content.aboutMissionBody}
                    onChange={updateField}
                    multiline
                    required
                    disabled={formDisabled}
                    maxLength={1000}
                  />
                  <div className={ui.fieldGrid}>
                    <TextField
                      label="Listening button label"
                      name="aboutListenLabel"
                      value={content.aboutListenLabel}
                      onChange={updateField}
                      hint="Optional; clear both button fields to hide it."
                      disabled={formDisabled}
                      maxLength={80}
                    />
                    <TextField
                      label="Listening button URL"
                      name="aboutListenUrl"
                      value={content.aboutListenUrl}
                      onChange={updateField}
                      type="url"
                      hint="A complete https:// link."
                      disabled={formDisabled}
                      maxLength={500}
                    />
                  </div>
                </div>
                <PreviewCard label="About page">
                  <span className={styles.previewEyebrow}>
                    {content.aboutEyebrow || 'About the program'}
                  </span>
                  <h3>{content.aboutHeading || 'Program heading'}</h3>
                  <p>{content.aboutIntro || 'Program description'}</p>
                  <div className={styles.previewCallout}>
                    <strong>
                      {content.aboutMissionHeading || 'Mission heading'}
                    </strong>
                    <span>{content.aboutMissionBody || 'Mission body'}</span>
                    {content.aboutListenUrl ? (
                      <b>{content.aboutListenLabel || 'Listen'}</b>
                    ) : null}
                  </div>
                </PreviewCard>
              </div>
            </section>

            <section
              id="homepage-support-content"
              className={`${ui.formSection} ${styles.contentSection}`}
            >
              <div className={ui.formSectionHeading}>
                <span>02</span>
                <div>
                  <h2>Homepage support</h2>
                  <p>
                    The primary sponsorship message and link shown near the
                    bottom of the homepage.
                  </p>
                </div>
              </div>
              <div className={styles.sectionLayout}>
                <div className={styles.sectionFields}>
                  <TextField
                    label="Heading"
                    name="supportHeading"
                    value={content.supportHeading}
                    onChange={updateField}
                    required
                    disabled={formDisabled}
                    maxLength={160}
                  />
                  <TextField
                    label="Body"
                    name="supportBody"
                    value={content.supportBody}
                    onChange={updateField}
                    multiline
                    required
                    disabled={formDisabled}
                    maxLength={1000}
                  />
                  <div className={ui.fieldGrid}>
                    <TextField
                      label="Button label"
                      name="supportButtonLabel"
                      value={content.supportButtonLabel}
                      onChange={updateField}
                      required
                      disabled={formDisabled}
                      maxLength={80}
                    />
                    <TextField
                      label="Button destination"
                      name="supportButtonUrl"
                      value={content.supportButtonUrl}
                      onChange={updateField}
                      hint="Use /support for an internal page or a complete https:// URL."
                      required
                      disabled={formDisabled}
                      maxLength={500}
                    />
                  </div>
                </div>
                <PreviewCard label="Homepage support">
                  <span className={styles.previewEyebrow}>Support the show</span>
                  <h3>{content.supportHeading || 'Support heading'}</h3>
                  <p>{content.supportBody || 'Support message'}</p>
                  <b>{content.supportButtonLabel || 'View support options'}</b>
                </PreviewCard>
              </div>
            </section>

            <section
              id="community-spotlight-content"
              className={`${ui.formSection} ${styles.contentSection}`}
            >
              <div className={ui.formSectionHeading}>
                <span>03</span>
                <div>
                  <h2>Community spotlight</h2>
                  <p>
                    A timely event or community message displayed beside the
                    homepage support block.
                  </p>
                </div>
              </div>
              <ToggleField
                id="spotlightEnabled"
                label="Show the community spotlight"
                hint="Hide the block without deleting its saved copy."
                checked={content.spotlightEnabled}
                onChange={updateField}
                disabled={formDisabled}
              />
              <div className={styles.sectionLayout}>
                <div
                  className={`${styles.sectionFields} ${
                    !content.spotlightEnabled ? styles.fieldsDisabled : ''
                  }`}
                >
                  <div className={ui.fieldGrid}>
                    <TextField
                      label="Eyebrow"
                      name="spotlightEyebrow"
                      value={content.spotlightEyebrow}
                      onChange={updateField}
                      required={content.spotlightEnabled}
                      disabled={formDisabled || !content.spotlightEnabled}
                      maxLength={80}
                    />
                    <TextField
                      label="Heading"
                      name="spotlightHeading"
                      value={content.spotlightHeading}
                      onChange={updateField}
                      required={content.spotlightEnabled}
                      disabled={formDisabled || !content.spotlightEnabled}
                      maxLength={160}
                    />
                  </div>
                  <TextField
                    label="Body"
                    name="spotlightBody"
                    value={content.spotlightBody}
                    onChange={updateField}
                    multiline
                    required={content.spotlightEnabled}
                    disabled={formDisabled || !content.spotlightEnabled}
                    maxLength={900}
                  />
                  <div className={ui.fieldGrid}>
                    <TextField
                      label="Button label"
                      name="spotlightButtonLabel"
                      value={content.spotlightButtonLabel}
                      onChange={updateField}
                      required={content.spotlightEnabled}
                      disabled={formDisabled || !content.spotlightEnabled}
                      maxLength={80}
                    />
                    <TextField
                      label="Button URL"
                      name="spotlightButtonUrl"
                      value={content.spotlightButtonUrl}
                      onChange={updateField}
                      type="url"
                      hint="A complete https:// link."
                      required={content.spotlightEnabled}
                      disabled={formDisabled || !content.spotlightEnabled}
                      maxLength={500}
                    />
                  </div>
                </div>
                <PreviewCard
                  label="Community spotlight"
                  hidden={!content.spotlightEnabled}
                >
                  <span className={styles.previewEyebrow}>
                    {content.spotlightEyebrow || 'Community spotlight'}
                  </span>
                  <h3>{content.spotlightHeading || 'Spotlight heading'}</h3>
                  <p>{content.spotlightBody || 'Spotlight message'}</p>
                  <b>{content.spotlightButtonLabel || 'Learn more'}</b>
                </PreviewCard>
              </div>
            </section>

            <section
              id="featured-link-content"
              className={`${ui.formSection} ${styles.contentSection}`}
            >
              <div className={ui.formSectionHeading}>
                <span>04</span>
                <div>
                  <h2>Featured link</h2>
                  <p>
                    A flexible homepage action for Instagram, TikTok, a
                    campaign, a resource, or another timely destination.
                  </p>
                </div>
              </div>
              <ToggleField
                id="featuredLinkEnabled"
                label="Show the featured link"
                hint="Hide the button without deleting its label or destination."
                checked={content.featuredLinkEnabled}
                onChange={updateField}
                disabled={formDisabled}
              />
              <div className={styles.sectionLayout}>
                <div
                  className={`${styles.sectionFields} ${
                    !content.featuredLinkEnabled ? styles.fieldsDisabled : ''
                  }`}
                >
                  <div className={ui.fieldGrid}>
                    <TextField
                      label="Button label"
                      name="featuredLinkLabel"
                      value={content.featuredLinkLabel}
                      onChange={updateField}
                      hint='For example, "Follow on TikTok" or "View the field guide."'
                      required={content.featuredLinkEnabled}
                      disabled={formDisabled || !content.featuredLinkEnabled}
                      maxLength={80}
                    />
                    <TextField
                      label="Destination URL"
                      name="featuredLinkUrl"
                      value={content.featuredLinkUrl}
                      onChange={updateField}
                      type="url"
                      hint="A complete https:// link to any trusted destination."
                      required={content.featuredLinkEnabled}
                      disabled={formDisabled || !content.featuredLinkEnabled}
                      maxLength={500}
                    />
                  </div>
                </div>
                <PreviewCard
                  label="Featured link"
                  hidden={!content.featuredLinkEnabled}
                >
                  <span className={styles.previewEyebrow}>Featured action</span>
                  <h3>{content.supportHeading || 'Support the podcast'}</h3>
                  <p>
                    This flexible link appears beside the primary support
                    button on the homepage.
                  </p>
                  <b>{content.featuredLinkLabel || 'Open featured link'}</b>
                </PreviewCard>
              </div>
            </section>

            <section
              id="donate-content"
              className={`${ui.formSection} ${styles.contentSection}`}
            >
              <div className={ui.formSectionHeading}>
                <span>05</span>
                <div>
                  <h2>Donate action</h2>
                  <p>
                    A separate donation button on the homepage, independent of
                    the Donate link in the main navigation.
                  </p>
                </div>
              </div>
              <ToggleField
                id="donateEnabled"
                label="Show the donate button"
                hint="Hide the homepage button without changing the Donate link in the navigation."
                checked={content.donateEnabled}
                onChange={updateField}
                disabled={formDisabled}
              />
              <div className={styles.sectionLayout}>
                <div
                  className={`${styles.sectionFields} ${
                    !content.donateEnabled ? styles.fieldsDisabled : ''
                  }`}
                >
                  <div className={ui.fieldGrid}>
                    <TextField
                      label="Button label"
                      name="donateButtonLabel"
                      value={content.donateButtonLabel}
                      onChange={updateField}
                      required={content.donateEnabled}
                      disabled={formDisabled || !content.donateEnabled}
                      maxLength={80}
                    />
                    <TextField
                      label="Donation URL"
                      name="donateButtonUrl"
                      value={content.donateButtonUrl}
                      onChange={updateField}
                      type="url"
                      hint="A complete https:// link to the donation page."
                      required={content.donateEnabled}
                      disabled={formDisabled || !content.donateEnabled}
                      maxLength={500}
                    />
                  </div>
                </div>
                <PreviewCard
                  label="Donate action"
                  hidden={!content.donateEnabled}
                >
                  <span className={styles.previewEyebrow}>Support action</span>
                  <h3>{content.supportHeading || 'Support the podcast'}</h3>
                  <p>
                    The donation action appears with the other homepage support
                    buttons.
                  </p>
                  <b>{content.donateButtonLabel || 'Donate'}</b>
                </PreviewCard>
              </div>
            </section>

            <footer className={styles.saveBar}>
              {resetArmed ? (
                <div className={styles.resetPrompt} role="alert">
                  <div>
                    <strong>Load the built-in copy into this draft?</strong>
                    <span>
                      Published content stays unchanged until you save.
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className={ui.dangerOutlineButton}
                      onClick={loadDefaults}
                    >
                      Load defaults
                    </button>
                    <button
                      type="button"
                      className={ui.tertiaryButton}
                      onClick={() => setResetArmed(false)}
                    >
                      Keep draft
                    </button>
                  </div>
                </div>
              ) : discardArmed ? (
                <div className={styles.resetPrompt} role="alert">
                  <div>
                    <strong>Discard every unsaved change in this draft?</strong>
                    <span>
                      The editor will return to the currently published copy.
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className={ui.dangerOutlineButton}
                      onClick={discardDraft}
                    >
                      Discard changes
                    </button>
                    <button
                      type="button"
                      className={ui.tertiaryButton}
                      onClick={() => setDiscardArmed(false)}
                    >
                      Keep draft
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={ui.saveContext}>
                    <strong>
                      {saving
                        ? 'Publishing changes'
                        : dirty
                          ? 'Unsaved site-content draft'
                          : 'Everything is up to date'}
                    </strong>
                    <span>
                      {dirty
                        ? 'All five sections publish together when you save.'
                        : 'This editor matches the currently published content.'}
                    </span>
                  </div>
                  <div className={styles.saveActions}>
                    <button
                      type="button"
                      className={ui.tertiaryButton}
                      onClick={() => {
                        setResetArmed(true);
                        setDiscardArmed(false);
                      }}
                      disabled={saving || !canManage}
                    >
                      <RestartAltRoundedIcon aria-hidden="true" />
                      Load defaults
                    </button>
                    {dirty ? (
                      <button
                        type="button"
                        className={ui.tertiaryButton}
                        onClick={() => {
                          setDiscardArmed(true);
                          setResetArmed(false);
                        }}
                        disabled={saving}
                      >
                        Discard changes
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className={ui.primaryButton}
                      disabled={!canManage || !dirty || saving}
                    >
                      <SaveRoundedIcon aria-hidden="true" />
                      {saving ? 'Saving…' : 'Save site content'}
                    </button>
                  </div>
                </>
              )}
            </footer>
          </form>
        ) : null}
      </div>
    </AdminLayout>
  );
}
