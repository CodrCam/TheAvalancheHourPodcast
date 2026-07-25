import Link from 'next/link';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import styles from '../styles/Studio.module.css';

const PATH_ICONS = {
  host: PodcastsRoundedIcon,
  operations: Inventory2RoundedIcon,
  production: AssignmentRoundedIcon,
};

export default function StudioResourcePathways({
  pathways = [],
  activePathId = '',
}) {
  const activePath =
    pathways.find((pathway) => pathway.id === activePathId) || pathways[0];

  if (!activePath) return null;

  return (
    <>
      <section
        className={styles.pathwayPicker}
        aria-labelledby="resource-pathway-heading"
      >
        <div className={styles.pathwayPickerHeading}>
          <div>
            <span className={styles.eyebrow}>Choose your responsibility</span>
            <h2 id="resource-pathway-heading">Follow the path for your work</h2>
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

      {activePath.id !== 'host' ? (
        <section
          className={styles.workflowSection}
          aria-labelledby={`${activePath.id}-workflow-heading`}
        >
          <div className={styles.workflowHeading}>
            <div>
              <span className={styles.eyebrow}>{activePath.audience}</span>
              <h2 id={`${activePath.id}-workflow-heading`}>
                {activePath.title}
              </h2>
              <p>{activePath.summary}</p>
            </div>
            <span className={styles.workflowCount}>
              {activePath.steps.length}{' '}
              {activePath.steps.length === 1 ? 'workspace' : 'workspaces'}
            </span>
          </div>

          <div className={styles.workflowGrid}>
            {activePath.steps.map((step, index) => (
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
                <Link href={step.href} className={styles.workflowAction}>
                  {step.action}
                  <ArrowForwardRoundedIcon aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
