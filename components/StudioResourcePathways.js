import { useMemo, useState } from 'react';
import Link from 'next/link';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import styles from '../styles/Studio.module.css';

const PATH_ICONS = {
  host: PodcastsRoundedIcon,
  operations: Inventory2RoundedIcon,
  production: AssignmentRoundedIcon,
};

function searchableText(item = {}) {
  return [
    item.title,
    item.label,
    item.description,
    item.use_for,
    item.handoff,
    item.question,
    item.answer,
    ...(item.instructions || []),
    ...(item.keywords || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesQuery(item, query) {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return true;
  const haystack = searchableText(item);
  return words.every((word) => haystack.includes(word));
}

export default function StudioResourcePathways({
  pathways = [],
  activePathId = '',
  featuredContent = null,
}) {
  const [query, setQuery] = useState('');
  const activePath =
    pathways.find((pathway) => pathway.id === activePathId) || pathways[0];

  const filteredSteps = useMemo(
    () =>
      (activePath?.steps || []).filter((step) => matchesQuery(step, query)),
    [activePath, query]
  );
  const filteredFaqs = useMemo(
    () => (activePath?.faqs || []).filter((faq) => matchesQuery(faq, query)),
    [activePath, query]
  );

  if (!activePath) return null;

  const searching = Boolean(query.trim());
  const resultCount = filteredSteps.length + filteredFaqs.length;

  return (
    <>
      {pathways.length > 1 ? (
        <section
          className={styles.pathwayPicker}
          aria-labelledby="resource-pathway-heading"
        >
          <div className={styles.pathwayPickerHeading}>
            <div>
              <span className={styles.eyebrow}>Choose your responsibility</span>
              <h2 id="resource-pathway-heading">
                Follow the path for your work
              </h2>
            </div>
            <p>
              You only see paths your account can use. Switching paths changes
              the instructions, not your permissions.
            </p>
          </div>
          <nav className={styles.pathwayTabs} aria-label="Resource pathways">
            {pathways.map((pathway) => {
              const Icon = PATH_ICONS[pathway.id] || AssignmentRoundedIcon;
              const active = pathway.id === activePath.id;
              return (
                <Link
                  key={pathway.id}
                  href={{
                    pathname: '/studio/resources',
                    query: { path: pathway.id },
                  }}
                  scroll={false}
                  className={`${styles.pathwayTab} ${
                    active ? styles.pathwayTabActive : ''
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={styles.pathwayTabIcon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <small>{pathway.audience}</small>
                    <strong>{pathway.title}</strong>
                    <span>{pathway.summary}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </section>
      ) : null}

      {featuredContent}

      <section
        className={styles.resourceFinder}
        aria-labelledby="resource-finder-heading"
      >
        <div className={styles.resourceFinderIntro}>
          <span className={styles.resourceFinderIcon}>
            <SearchRoundedIcon aria-hidden="true" />
          </span>
          <div>
            <span className={styles.eyebrow}>{activePath.audience}</span>
            <h2 id="resource-finder-heading">What are you trying to do?</h2>
            <p>
              Search a plain-language task, page name, problem, or question.
              Results stay inside the permissions for your account.
            </p>
          </div>
        </div>
        <div className={styles.resourceFinderSearch}>
          <SearchRoundedIcon aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              activePath.id === 'host'
                ? 'Try “set up Riverside” or “upload not finished”'
                : activePath.id === 'operations'
                  ? 'Try “assign product images” or “sold out versus standby”'
                  : 'Search this responsibility…'
            }
            aria-label={`Search ${activePath.title} help`}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear help search"
            >
              <CloseRoundedIcon aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className={styles.suggestedSearches}>
          <span>Popular:</span>
          {(activePath.suggested_searches || []).map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => setQuery(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className={styles.resourceFinderMeta} aria-live="polite">
          {searching
            ? `${resultCount} ${resultCount === 1 ? 'answer' : 'answers'} found`
            : `${activePath.steps.length} workspace guides · ${
                activePath.faqs?.length || 0
              } quick answers`}
        </div>
      </section>

      {searching && !resultCount ? (
        <section className={styles.resourceSearchEmpty}>
          <SearchRoundedIcon aria-hidden="true" />
          <h2>No answer matched “{query}”</h2>
          <p>
            Try a page name, Riverside, microphone, upload, product, stock,
            shipping, access, or a shorter phrase.
          </p>
          <button type="button" onClick={() => setQuery('')}>
            Clear search
          </button>
        </section>
      ) : null}

      {filteredSteps.length ? (
        <section
          className={styles.workflowSection}
          aria-labelledby={`${activePath.id}-workflow-heading`}
        >
          <div className={styles.workflowHeading}>
            <div>
              <span className={styles.eyebrow}>
                {searching ? 'Matching workspace guides' : activePath.audience}
              </span>
              <h2 id={`${activePath.id}-workflow-heading`}>
                {searching ? 'Where to do the work' : activePath.title}
              </h2>
              <p>
                {searching
                  ? 'Open the right workspace, follow the operating sequence, and leave the shared record ready for the next person.'
                  : activePath.summary}
              </p>
            </div>
            <span className={styles.workflowCount}>
              {filteredSteps.length}{' '}
              {filteredSteps.length === 1 ? 'guide' : 'guides'}
            </span>
          </div>

          <div className={styles.workflowGrid}>
            {filteredSteps.map((step, index) => (
              <article key={step.id} className={styles.workflowCard}>
                <div className={styles.workflowCardHeader}>
                  <span className={styles.workflowNumber}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.workflowLabel}>{step.label}</span>
                </div>
                <h3>{step.title}</h3>
                <p className={styles.workflowDescription}>
                  {step.description}
                </p>
                <dl className={styles.workflowDetails}>
                  <div>
                    <dt>Use this for</dt>
                    <dd>{step.use_for}</dd>
                  </div>
                  <div>
                    <dt>What happens next</dt>
                    <dd>{step.handoff}</dd>
                  </div>
                </dl>
                {step.instructions?.length ? (
                  <details className={styles.instructionDisclosure}>
                    <summary>
                      <span>
                        <MenuBookRoundedIcon aria-hidden="true" />
                        Step-by-step
                      </span>
                      <ExpandMoreRoundedIcon aria-hidden="true" />
                    </summary>
                    <ol>
                      {step.instructions.map((instruction) => (
                        <li key={instruction}>{instruction}</li>
                      ))}
                    </ol>
                  </details>
                ) : null}
                <Link href={step.href} className={styles.workflowAction}>
                  {step.action}
                  <ArrowForwardRoundedIcon aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {filteredFaqs.length ? (
        <section
          className={styles.resourceFaqSection}
          aria-labelledby={`${activePath.id}-faq-heading`}
        >
          <div className={styles.resourceFaqHeading}>
            <span className={styles.resourceFaqIcon}>
              <HelpOutlineRoundedIcon aria-hidden="true" />
            </span>
            <div>
              <span className={styles.eyebrow}>
                {searching ? 'Matching quick answers' : 'Frequently asked'}
              </span>
              <h2 id={`${activePath.id}-faq-heading`}>
                Answers without the runaround
              </h2>
              <p>
                Short explanations for the decisions and edge cases that are
                easiest to get wrong.
              </p>
            </div>
          </div>
          <div className={styles.resourceFaqList}>
            {filteredFaqs.map((faq) => (
              <details className={styles.resourceFaqItem} key={faq.id}>
                <summary>
                  <span>{faq.question}</span>
                  <ExpandMoreRoundedIcon aria-hidden="true" />
                </summary>
                <div>
                  <p>{faq.answer}</p>
                  {faq.href ? (
                    <Link href={faq.href}>
                      {faq.action || 'Open workspace'}
                      <ArrowForwardRoundedIcon aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
