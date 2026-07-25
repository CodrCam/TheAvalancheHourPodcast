import { useEffect, useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded';
import TitleRoundedIcon from '@mui/icons-material/TitleRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import StudioLayout from '../../../components/StudioLayout';
import StudioFormattedContent from '../../../components/StudioFormattedContent';
import ResourceModeSwitch from '../../../components/ResourceModeSwitch';
import StudioResourceLibrary from '../../../components/StudioResourceLibrary';
import { DEFAULT_STUDIO_GUIDE } from '../../../lib/studioGuideDefaults';
import {
  normalizeStudioGuide,
  sanitizeStudioGuideForHosts,
} from '../../../lib/studioGuidePresentation.mjs';
import styles from '../../../styles/Studio.module.css';

function cloneDefaultGuide() {
  return JSON.parse(JSON.stringify(DEFAULT_STUDIO_GUIDE));
}

function fingerprint(value) {
  return JSON.stringify(normalizeStudioGuide(value, DEFAULT_STUDIO_GUIDE));
}

function formatUpdatedAt(value, label = 'Last published') {
  if (!value) return `${label}: not yet`;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? `${label}: recently`
    : `${label} ${date.toLocaleString()}`;
}

function BodyEditor({ value, onChange }) {
  const textareaRef = useRef(null);

  function transformSelection(kind) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const source = value || '';
    let selectionStart = textarea.selectionStart;
    let selectionEnd = textarea.selectionEnd;
    const lineStart = source.lastIndexOf('\n', selectionStart - 1) + 1;
    const nextBreak = source.indexOf('\n', selectionEnd);
    const lineEnd = nextBreak === -1 ? source.length : nextBreak;
    const selectedLines = source.slice(lineStart, lineEnd).split('\n');
    const cleanedLines = selectedLines.map((line) =>
      line.replace(/^(?:#{2,3}\s+|[-*•]\s+|\d+[.)]\s+)/, '')
    );
    const transformed = cleanedLines
      .map((line, index) => {
        if (!line.trim()) return line;
        if (kind === 'bullet') return `- ${line}`;
        if (kind === 'number') return `${index + 1}. ${line}`;
        return `## ${line}`;
      })
      .join('\n');
    const nextValue =
      source.slice(0, lineStart) + transformed + source.slice(lineEnd);

    onChange(nextValue);
    selectionStart = lineStart;
    selectionEnd = lineStart + transformed.length;
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  return (
    <div>
      <div className={styles.sectionToolbar} aria-label="Text formatting">
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={() => transformSelection('heading')}
        >
          <TitleRoundedIcon aria-hidden="true" />
          Subheading
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={() => transformSelection('bullet')}
        >
          <FormatListBulletedRoundedIcon aria-hidden="true" />
          Bullets
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={() => transformSelection('number')}
        >
          <FormatListNumberedRoundedIcon aria-hidden="true" />
          Numbered steps
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${styles.textarea} ${styles.bodyEditor}`}
        placeholder={
          'Write or paste content here.\n\n- Bullet points begin with a dash\n1. Numbered steps begin with a number\n## Subheadings begin with two hash marks'
        }
      />
    </div>
  );
}

function createBlankSection(index) {
  const suffix = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return {
    id: `resource-section-${suffix}`,
    category: 'Getting started',
    title: 'New guide section',
    summary: '',
    body: '',
    published: false,
    sort_order: index * 10,
    links: [],
  };
}

export default function ManageStudioResourcesPage() {
  const [guide, setGuide] = useState(cloneDefaultGuide);
  const [baseline, setBaseline] = useState(cloneDefaultGuide);
  const [publishedGuide, setPublishedGuide] = useState(cloneDefaultGuide);
  const [meta, setMeta] = useState({
    configured: false,
    source: 'default',
    updated_at: '',
    updated_by: '',
    draft_updated_at: '',
    draft_updated_by: '',
    has_saved_draft: false,
  });
  const [selectedSectionId, setSelectedSectionId] = useState(
    DEFAULT_STUDIO_GUIDE.sections[0]?.id || ''
  );
  const [managerNotesText, setManagerNotesText] = useState(
    DEFAULT_STUDIO_GUIDE.manager_notes.join('\n')
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const dirty = useMemo(
    () => fingerprint(guide) !== fingerprint(baseline),
    [baseline, guide]
  );
  const hasUnpublishedChanges = useMemo(
    () => fingerprint(guide) !== fingerprint(publishedGuide),
    [guide, publishedGuide]
  );
  const hostPreviewGuide = useMemo(
    () => sanitizeStudioGuideForHosts(guide, DEFAULT_STUDIO_GUIDE),
    [guide]
  );
  const selectedIndex = guide.sections.findIndex(
    (section) => section.id === selectedSectionId
  );
  const selectedSection =
    guide.sections[selectedIndex] || guide.sections[0] || null;
  const publishedCount = guide.sections.filter(
    (section) => section.published
  ).length;
  const liveSectionCount = publishedGuide.sections.filter(
    (section) => section.published
  ).length;

  async function loadGuide() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/studio/manage/resources', {
        credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load the resource editor.');
      }
      const nextGuide = normalizeStudioGuide(
        data.guide || DEFAULT_STUDIO_GUIDE,
        DEFAULT_STUDIO_GUIDE
      );
      const nextPublishedGuide = normalizeStudioGuide(
        data.published_guide || data.guide || DEFAULT_STUDIO_GUIDE,
        DEFAULT_STUDIO_GUIDE
      );
      setGuide(nextGuide);
      setBaseline(nextGuide);
      setPublishedGuide(nextPublishedGuide);
      setManagerNotesText((nextGuide.manager_notes || []).join('\n'));
      setMeta({
        configured: data.configured === true,
        source: data.source || 'default',
        updated_at: data.updated_at || '',
        updated_by: data.updated_by || '',
        draft_updated_at: data.draft_updated_at || '',
        draft_updated_by: data.draft_updated_by || '',
        has_saved_draft: data.has_draft === true,
      });
      setCanPublish(data.canPublish === true);
      setSelectedSectionId((current) =>
        nextGuide.sections.some((section) => section.id === current)
          ? current
          : nextGuide.sections[0]?.id || ''
      );
    } catch (err) {
      setError(err.message || 'Could not load the resource editor.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGuide();
  }, []);

  function updateGuide(patch) {
    setGuide((current) => ({ ...current, ...patch }));
    setMessage('');
    setError('');
  }

  function updateAnnouncement(patch) {
    updateGuide({
      announcement: { ...guide.announcement, ...patch },
    });
  }

  function updateSection(sectionId, patch) {
    setGuide((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section
      ),
    }));
    setMessage('');
    setError('');
  }

  function replaceSections(sections) {
    setGuide((current) => ({
      ...current,
      sections: sections.map((section, index) => ({
        ...section,
        sort_order: (index + 1) * 10,
      })),
    }));
    setMessage('');
    setError('');
  }

  function moveSection(sectionId, direction) {
    const index = guide.sections.findIndex(
      (section) => section.id === sectionId
    );
    const target = index + direction;
    if (index < 0 || target < 0 || target >= guide.sections.length) return;
    const sections = [...guide.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    replaceSections(sections);
  }

  function addSection() {
    const section = createBlankSection(guide.sections.length + 1);
    replaceSections([...guide.sections, section]);
    setSelectedSectionId(section.id);
  }

  function duplicateSection(section) {
    const copy = {
      ...section,
      id: `${section.id}-copy-${Date.now().toString(36)}`,
      title: `${section.title} copy`,
      published: false,
      links: (section.links || []).map((link) => ({
        ...link,
        id: `${link.id}-copy-${Date.now().toString(36)}`,
        active: false,
      })),
    };
    const sections = [...guide.sections];
    const index = sections.findIndex((item) => item.id === section.id);
    sections.splice(index + 1, 0, copy);
    replaceSections(sections);
    setSelectedSectionId(copy.id);
  }

  function removeSection(section) {
    if (
      !window.confirm(
        `Remove "${section.title}" from the guide? This takes effect when you publish.`
      )
    ) {
      return;
    }
    const sections = guide.sections.filter((item) => item.id !== section.id);
    replaceSections(sections);
    setSelectedSectionId(sections[0]?.id || '');
  }

  function updateLink(sectionId, linkId, patch) {
    const section = guide.sections.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      links: (section.links || []).map((link) =>
        link.id === linkId ? { ...link, ...patch } : link
      ),
    });
  }

  function addLink(sectionId) {
    const section = guide.sections.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      links: [
        ...(section.links || []),
        {
          id: `${sectionId}-link-${Date.now().toString(36)}`,
          label: '',
          url: '',
          note: '',
          manager_note: '',
          active: false,
        },
      ],
    });
  }

  function removeLink(sectionId, linkId) {
    const section = guide.sections.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      links: (section.links || []).filter((link) => link.id !== linkId),
    });
  }

  function currentGuidePayload() {
    return {
      ...guide,
      manager_notes: managerNotesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    };
  }

  async function saveDraft() {
    if (!dirty || !meta.configured || saving) return;
    setSaving('draft');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/studio/manage/resources', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide: currentGuidePayload(),
          expected_draft_updated_at: meta.draft_updated_at,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not save the resource draft.');
      }
      const nextGuide = normalizeStudioGuide(
        data.guide,
        DEFAULT_STUDIO_GUIDE
      );
      const nextPublishedGuide = normalizeStudioGuide(
        data.published_guide || publishedGuide,
        DEFAULT_STUDIO_GUIDE
      );
      setGuide(nextGuide);
      setBaseline(nextGuide);
      setPublishedGuide(nextPublishedGuide);
      setManagerNotesText((nextGuide.manager_notes || []).join('\n'));
      setMeta((current) => ({
        ...current,
        configured: data.configured === true,
        source: data.source || 'dynamo',
        updated_at: data.updated_at ?? current.updated_at,
        updated_by: data.updated_by ?? current.updated_by,
        draft_updated_at: data.draft_updated_at || '',
        draft_updated_by: data.draft_updated_by || '',
        has_saved_draft: data.has_draft === true,
      }));
      setMessage('Draft saved. Hosts still see the published guide.');
    } catch (err) {
      setError(err.message || 'Could not save the resource draft.');
    } finally {
      setSaving('');
    }
  }

  async function publishGuide() {
    if (
      (!dirty && !hasUnpublishedChanges) ||
      !canPublish ||
      !meta.configured ||
      saving
    ) {
      return;
    }
    setSaving('publish');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/studio/manage/resources', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide: currentGuidePayload(),
          expected_updated_at: meta.updated_at,
          expected_draft_updated_at: meta.draft_updated_at,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not publish the Host Guide.');
      }
      const nextGuide = normalizeStudioGuide(
        data.guide,
        DEFAULT_STUDIO_GUIDE
      );
      const nextPublishedGuide = normalizeStudioGuide(
        data.published_guide || data.guide,
        DEFAULT_STUDIO_GUIDE
      );
      setGuide(nextGuide);
      setBaseline(nextGuide);
      setPublishedGuide(nextPublishedGuide);
      setManagerNotesText((nextGuide.manager_notes || []).join('\n'));
      setMeta({
        configured: data.configured === true,
        source: data.source || 'dynamo',
        updated_at: data.updated_at || '',
        updated_by: data.updated_by || '',
        draft_updated_at: data.draft_updated_at || data.updated_at || '',
        draft_updated_by:
          data.draft_updated_by || data.updated_by || '',
        has_saved_draft: data.has_draft === true,
      });
      setMessage('Host Guide published successfully.');
    } catch (err) {
      setError(err.message || 'Could not publish the Host Guide.');
    } finally {
      setSaving('');
    }
  }

  if (previewing) {
    return (
      <StudioLayout
        hasUnsavedChanges={dirty}
        unsavedChangesMessage="You have resource changes that are not saved as a draft. Leave and discard them?"
        requiredPermission="resources:update"
        accessDeniedRedirect="/studio/resources"
      >
        <StudioResourceLibrary
          guide={hostPreviewGuide}
          updatedAt={meta.draft_updated_at || meta.updated_at}
          previewLabel={dirty ? 'Unsaved preview' : 'Draft preview'}
          headerActions={
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setPreviewing(false)}
              >
                <ArrowBackRoundedIcon fontSize="small" aria-hidden="true" />
                Back to editor
              </button>
              <ResourceModeSwitch activeMode="edit" canEdit />
            </>
          }
        />
      </StudioLayout>
    );
  }

  return (
    <StudioLayout
      hasUnsavedChanges={dirty}
      unsavedChangesMessage="You have resource changes that are not saved as a draft. Leave and discard them?"
      requiredPermission="resources:update"
      accessDeniedRedirect="/studio/resources"
    >
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Producer workspace</span>
          <h1>Resource Editor</h1>
          <p>
            Build the Host Guide one section at a time. Reorder the outline,
            format pasted content, preview it, and publish when it is ready.
          </p>
        </div>
        <div className={styles.resourceHeaderActions}>
          <ResourceModeSwitch activeMode="edit" canEdit />
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setPreviewing(true)}
            disabled={loading}
          >
            <VisibilityRoundedIcon fontSize="small" aria-hidden="true" />
            Preview as host
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={saveDraft}
            disabled={!dirty || !meta.configured || !!saving}
          >
            <SaveRoundedIcon fontSize="small" aria-hidden="true" />
            {saving === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={publishGuide}
            disabled={
              (!dirty && !hasUnpublishedChanges) ||
              !canPublish ||
              !meta.configured ||
              !!saving
            }
          >
            <PublishRoundedIcon fontSize="small" aria-hidden="true" />
            {saving === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </header>

      {loading ? <p className={styles.notice}>Opening the editor…</p> : null}
      {!meta.configured && !loading ? (
        <p className={styles.warningMessage}>
          The default guide is available to preview, but publishing requires
          the existing DynamoDB site-content configuration.
        </p>
      ) : null}
      {message ? <p className={styles.successMessage}>{message}</p> : null}
      {error ? <p className={styles.errorMessage}>{error}</p> : null}

      {!loading ? (
        <>
          <div className={styles.statusBar}>
            <span>
              {guide.sections.length} draft sections · {publishedCount} set
              visible · {liveSectionCount} currently live
            </span>
            <span>
              {dirty
                ? 'Changes not saved'
                : hasUnpublishedChanges
                  ? formatUpdatedAt(meta.draft_updated_at, 'Draft saved')
                  : formatUpdatedAt(meta.updated_at)}
            </span>
          </div>

          <div className={styles.editorShell}>
            <aside className={styles.editorOutline}>
              <div className={styles.editorOutlineHeader}>
                <strong>Guide outline</strong>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={addSection}
                  aria-label="Add guide section"
                >
                  <AddRoundedIcon aria-hidden="true" />
                </button>
              </div>
              {guide.sections.map((section) => (
                <button
                  type="button"
                  key={section.id}
                  className={`${styles.outlineItem} ${
                    selectedSection?.id === section.id
                      ? styles.outlineItemActive
                      : ''
                  }`}
                  onClick={() => setSelectedSectionId(section.id)}
                >
                  <div>
                    <strong>{section.title || 'Untitled section'}</strong>
                    <span>{section.category}</span>
                  </div>
                  <span
                    className={`${styles.outlineStatus} ${
                      section.published
                        ? styles.outlineStatusPublished
                        : ''
                    }`}
                    title={section.published ? 'Published' : 'Draft'}
                  />
                </button>
              ))}
            </aside>

            <div className={styles.editorMain}>
              <section className={styles.editorPanel}>
                <div className={styles.editorPanelHeader}>
                  <div>
                    <h2>Guide identity</h2>
                    <p>The introduction hosts see above the resource library.</p>
                  </div>
                </div>
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor="guide-eyebrow">Eyebrow</label>
                    <input
                      id="guide-eyebrow"
                      className={styles.input}
                      value={guide.eyebrow}
                      onChange={(event) =>
                        updateGuide({ eyebrow: event.target.value })
                      }
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="guide-title">Guide title</label>
                    <input
                      id="guide-title"
                      className={styles.input}
                      value={guide.title}
                      onChange={(event) =>
                        updateGuide({ title: event.target.value })
                      }
                    />
                  </div>
                  <div className={styles.fieldFull}>
                    <label htmlFor="guide-intro">Introduction</label>
                    <textarea
                      id="guide-intro"
                      className={styles.textarea}
                      value={guide.intro}
                      onChange={(event) =>
                        updateGuide({ intro: event.target.value })
                      }
                    />
                  </div>
                </div>
              </section>

              <section className={styles.editorPanel}>
                <div className={styles.editorPanelHeader}>
                  <div>
                    <h2>Studio announcement</h2>
                    <p>A timely message shown on Studio Home and the guide.</p>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={guide.announcement.enabled}
                      onChange={(event) =>
                        updateAnnouncement({ enabled: event.target.checked })
                      }
                    />
                    Show announcement
                  </label>
                </div>
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor="announcement-title">Title</label>
                    <input
                      id="announcement-title"
                      className={styles.input}
                      value={guide.announcement.title}
                      onChange={(event) =>
                        updateAnnouncement({ title: event.target.value })
                      }
                    />
                  </div>
                  <div className={styles.fieldFull}>
                    <label htmlFor="announcement-body">Message</label>
                    <textarea
                      id="announcement-body"
                      className={styles.textarea}
                      value={guide.announcement.body}
                      onChange={(event) =>
                        updateAnnouncement({ body: event.target.value })
                      }
                    />
                  </div>
                </div>
              </section>

              {selectedSection ? (
                <section className={styles.editorPanel}>
                  <div className={styles.sectionEditorHeader}>
                    <div>
                      <h2>{selectedSection.title || 'Untitled section'}</h2>
                      <p>
                        Section {selectedIndex + 1} of {guide.sections.length}
                      </p>
                    </div>
                    <div className={styles.editorActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => moveSection(selectedSection.id, -1)}
                        disabled={selectedIndex === 0}
                        aria-label="Move section up"
                      >
                        <ArrowUpwardRoundedIcon aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => moveSection(selectedSection.id, 1)}
                        disabled={selectedIndex === guide.sections.length - 1}
                        aria-label="Move section down"
                      >
                        <ArrowDownwardRoundedIcon aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => duplicateSection(selectedSection)}
                        aria-label="Duplicate section"
                      >
                        <ContentCopyRoundedIcon aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconButton} ${styles.dangerButton}`}
                        onClick={() => removeSection(selectedSection)}
                        aria-label="Remove section"
                      >
                        <DeleteOutlineRoundedIcon aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className={styles.fieldGrid} style={{ marginTop: 20 }}>
                    <div className={styles.field}>
                      <label htmlFor="section-category">Category</label>
                      <input
                        id="section-category"
                        className={styles.input}
                        value={selectedSection.category}
                        onChange={(event) =>
                          updateSection(selectedSection.id, {
                            category: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="section-title">Section title</label>
                      <input
                        id="section-title"
                        className={styles.input}
                        value={selectedSection.title}
                        onChange={(event) =>
                          updateSection(selectedSection.id, {
                            title: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className={styles.fieldFull}>
                      <label htmlFor="section-summary">Short summary</label>
                      <input
                        id="section-summary"
                        className={styles.input}
                        value={selectedSection.summary}
                        onChange={(event) =>
                          updateSection(selectedSection.id, {
                            summary: event.target.value,
                          })
                        }
                      />
                      <small>
                        This appears while the section is collapsed and is
                        included in search.
                      </small>
                    </div>
                    <div className={styles.fieldFull}>
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={selectedSection.published}
                          onChange={(event) =>
                            updateSection(selectedSection.id, {
                              published: event.target.checked,
                            })
                          }
                        />
                        Publish this section to hosts
                      </label>
                    </div>
                    <div className={styles.fieldFull}>
                      <label htmlFor="section-body">Section content</label>
                      <div className={styles.editorSplit}>
                        <BodyEditor
                          value={selectedSection.body}
                          onChange={(body) =>
                            updateSection(selectedSection.id, { body })
                          }
                        />
                        <aside className={styles.previewPane}>
                          <span className={styles.previewPaneLabel}>
                            Live reading preview
                          </span>
                          <StudioFormattedContent value={selectedSection.body} />
                        </aside>
                      </div>
                      <small>
                        Pasted paragraphs and lists are preserved. Select one or
                        more lines and use the formatting buttons when needed.
                      </small>
                    </div>
                  </div>

                  <div className={styles.editorPanelHeader} style={{ marginTop: 26 }}>
                    <div>
                      <h2>Links and downloads</h2>
                      <p>
                        Inactive links remain visible to managers but are hidden
                        from hosts.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => addLink(selectedSection.id)}
                    >
                      <LinkRoundedIcon fontSize="small" aria-hidden="true" />
                      Add link
                    </button>
                  </div>

                  <div className={styles.linkEditorList}>
                    {(selectedSection.links || []).map((link) => (
                      <div key={link.id} className={styles.linkEditorRow}>
                        <input
                          className={styles.input}
                          value={link.label}
                          placeholder="Link label"
                          aria-label="Link label"
                          onChange={(event) =>
                            updateLink(selectedSection.id, link.id, {
                              label: event.target.value,
                            })
                          }
                        />
                        <input
                          className={styles.input}
                          value={link.url}
                          placeholder="https://…"
                          aria-label="Link URL"
                          onChange={(event) =>
                            updateLink(selectedSection.id, link.id, {
                              url: event.target.value,
                            })
                          }
                        />
                        <label className={styles.toggle}>
                          <input
                            type="checkbox"
                            checked={link.active}
                            onChange={(event) =>
                              updateLink(selectedSection.id, link.id, {
                                active: event.target.checked,
                              })
                            }
                          />
                          Live
                        </label>
                        <input
                          className={`${styles.input} ${styles.linkNote}`}
                          value={link.note}
                          placeholder="Optional description shown to hosts"
                          aria-label="Host-facing link description"
                          onChange={(event) =>
                            updateLink(selectedSection.id, link.id, {
                              note: event.target.value,
                            })
                          }
                        />
                        <input
                          className={`${styles.input} ${styles.linkNote} ${styles.linkManagerNote}`}
                          value={link.manager_note || ''}
                          placeholder="Private manager reminder — never shown to hosts"
                          aria-label="Private link manager note"
                          onChange={(event) =>
                            updateLink(selectedSection.id, link.id, {
                              manager_note: event.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.dangerButton}`}
                          onClick={() =>
                            removeLink(selectedSection.id, link.id)
                          }
                          aria-label={`Remove ${link.label || 'link'}`}
                        >
                          <DeleteOutlineRoundedIcon aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    {!selectedSection.links?.length ? (
                      <div className={styles.emptyState}>
                        <p>This section does not have any links yet.</p>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className={styles.editorPanel}>
                <div className={styles.editorPanelHeader}>
                  <div>
                    <h2>Manager notes</h2>
                    <p>
                      Private reminders for Studio managers and admins. Hosts
                      never receive these notes.
                    </p>
                  </div>
                </div>
                <textarea
                  className={styles.textarea}
                  value={managerNotesText}
                  onChange={(event) => {
                    const value = event.target.value;
                    setManagerNotesText(value);
                    updateGuide({
                      manager_notes: value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean),
                    });
                  }}
                  placeholder="One manager note per line"
                />
              </section>

              <div className={styles.saveDock}>
                <div>
                  <strong>
                    {dirty
                      ? 'Changes not saved'
                      : hasUnpublishedChanges
                        ? 'Draft saved — not live'
                        : 'Everything is published'}
                  </strong>
                  <span>
                    {publishedCount} of {guide.sections.length} draft sections
                    will be visible when published
                  </span>
                </div>
                <div className={styles.saveDockActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={saveDraft}
                    disabled={!dirty || !meta.configured || !!saving}
                  >
                    <SaveRoundedIcon fontSize="small" aria-hidden="true" />
                    {saving === 'draft' ? 'Saving…' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={publishGuide}
                    disabled={
                      (!dirty && !hasUnpublishedChanges) ||
                      !canPublish ||
                      !meta.configured ||
                      !!saving
                    }
                  >
                    <PublishRoundedIcon fontSize="small" aria-hidden="true" />
                    {saving === 'publish' ? 'Publishing…' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </StudioLayout>
  );
}
