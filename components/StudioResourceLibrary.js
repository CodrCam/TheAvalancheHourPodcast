import { useMemo, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import StudioFormattedContent from './StudioFormattedContent';
import { studioGuideSearchText } from '../lib/studioGuidePresentation.mjs';
import styles from '../styles/Studio.module.css';

function formatUpdatedAt(value) {
  if (!value) return 'Evergreen host manual';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return `Updated ${date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function formatVideoSize(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return '';
  const gibibytes = bytes / (1024 * 1024 * 1024);
  if (gibibytes >= 1) return `${gibibytes.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

export default function StudioResourceLibrary({
  guide,
  updatedAt = '',
  loading = false,
  error = '',
  headerActions = null,
  previewLabel = '',
  showHeader = true,
  showAnnouncement = true,
  previewVideos = false,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [expanded, setExpanded] = useState([]);

  const categories = useMemo(
    () => [
      'All',
      ...new Set((guide?.sections || []).map((section) => section.category)),
    ],
    [guide]
  );

  const activeCategory = categories.includes(category) ? category : 'All';

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (guide?.sections || []).filter((section) => {
      const categoryMatches =
        activeCategory === 'All' || section.category === activeCategory;
      const queryMatches =
        !normalizedQuery ||
        studioGuideSearchText(section).includes(normalizedQuery);
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, guide, query]);

  function toggleSection(sectionId) {
    setExpanded((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId]
    );
  }

  const visibleExpanded = query.trim()
    ? filteredSections.map((section) => section.id)
    : expanded;
  const allVisibleExpanded =
    filteredSections.length > 0 &&
    filteredSections.every((section) => visibleExpanded.includes(section.id));

  return (
    <>
      {showHeader ? (
        <header className={styles.pageHeader}>
          <div>
            <div className={styles.eyebrowRow}>
              <span className={styles.eyebrow}>
                {guide?.eyebrow || 'Host resources'}
              </span>
              {previewLabel ? (
                <span className={styles.previewBadge}>{previewLabel}</span>
              ) : null}
            </div>
            <h1>{guide?.title || 'Host Guide'}</h1>
            <p>
              {guide?.intro ||
                'Search the guide or browse by production stage.'}
            </p>
          </div>
          {headerActions ? (
            <div className={styles.resourceHeaderActions}>{headerActions}</div>
          ) : null}
        </header>
      ) : null}

      {showAnnouncement && guide?.announcement?.enabled ? (
        <section className={styles.announcement}>
          <span className={styles.announcementIcon}>
            <CampaignRoundedIcon aria-hidden="true" />
          </span>
          <div>
            <h2>{guide.announcement.title}</h2>
            <p>{guide.announcement.body}</p>
          </div>
        </section>
      ) : null}

      <section
        className={styles.resourceControls}
        aria-label="Filter the Host Field Manual"
      >
        <div className={styles.searchRow}>
          <div className={styles.searchField}>
            <SearchRoundedIcon aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Riverside, microphones, guest prep, uploads, editing…"
              aria-label="Search the Host Field Manual"
            />
            {query ? (
              <button
                type="button"
                className={styles.clearSearch}
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <CloseRoundedIcon aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.expandButton}
            disabled={Boolean(query.trim())}
            onClick={() =>
              setExpanded(
                allVisibleExpanded
                  ? []
                  : filteredSections.map((section) => section.id)
              )
            }
          >
            {query.trim()
              ? 'Matches expanded'
              : allVisibleExpanded
                ? 'Collapse all'
                : 'Expand all'}
          </button>
        </div>
        <div className={styles.categoryFilters}>
          {categories.map((item) => (
            <button
              type="button"
              key={item}
              className={`${styles.categoryButton} ${
                activeCategory === item ? styles.categoryButtonActive : ''
              }`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {error ? <p className={styles.errorMessage}>{error}</p> : null}

      <div className={styles.resultsMeta}>
        <span>
          {loading
            ? 'Loading resources…'
            : `${filteredSections.length} ${
                filteredSections.length === 1 ? 'section' : 'sections'
              }`}
        </span>
        <span>{formatUpdatedAt(updatedAt)}</span>
      </div>

      {!loading && !error && !filteredSections.length ? (
        <section className={styles.emptyState}>
          <h2>No guide sections match</h2>
          <p>Try a different search term or select another category.</p>
        </section>
      ) : (
        <section className={styles.resourceList}>
          {filteredSections.map((section, index) => (
            <Accordion
              key={section.id}
              expanded={visibleExpanded.includes(section.id)}
              onChange={() => toggleSection(section.id)}
              className={styles.resourceAccordion}
              disableGutters
            >
              <AccordionSummary
                expandIcon={<ExpandMoreRoundedIcon />}
                className={styles.resourceSummary}
              >
                <div className={styles.resourceSummaryContent}>
                  <span className={styles.resourceNumber}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <span className={styles.resourceCategory}>
                      {section.category}
                    </span>
                    <h2>{section.title}</h2>
                    <p>{section.summary}</p>
                  </div>
                </div>
              </AccordionSummary>
              <AccordionDetails className={styles.resourceDetails}>
                <StudioFormattedContent value={section.body} />
                {section.videos?.length ? (
                  <div className={styles.resourceVideos}>
                    {section.videos.map((video) => (
                      <article
                        className={styles.resourceVideoCard}
                        key={video.id}
                      >
                        <div className={styles.resourceVideoHeading}>
                          <div>
                            <h3>{video.title}</h3>
                            {video.description ? (
                              <p>{video.description}</p>
                            ) : null}
                          </div>
                          {formatVideoSize(video.size) ? (
                            <span>{formatVideoSize(video.size)} MP4</span>
                          ) : null}
                        </div>
                        <video
                          className={styles.resourceVideoPlayer}
                          controls
                          controlsList="nodownload noremoteplayback"
                          disablePictureInPicture
                          playsInline
                          preload="metadata"
                          aria-label={video.title}
                          src={`/api/studio/resource-videos/${encodeURIComponent(
                            video.id
                          )}${previewVideos ? '?draft=1' : ''}`}
                        >
                          Your browser does not support inline video playback.
                        </video>
                      </article>
                    ))}
                  </div>
                ) : null}
                {section.links?.length ? (
                  <div className={styles.resourceLinks}>
                    {section.links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.resourceLink}
                      >
                        <strong>{link.label}</strong>
                        <OpenInNewRoundedIcon
                          fontSize="small"
                          aria-hidden="true"
                        />
                        {link.note ? <span>{link.note}</span> : null}
                      </a>
                    ))}
                  </div>
                ) : null}
              </AccordionDetails>
            </Accordion>
          ))}
        </section>
      )}
    </>
  );
}
