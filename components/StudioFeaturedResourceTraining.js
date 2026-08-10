import StudioResourceVideos from './StudioResourceVideos';
import styles from '../styles/Studio.module.css';

const FEATURED_TRAINING_COPY = {
  host: {
    title: 'Watch the host walkthrough',
    description:
      'New or returning hosts can begin with the complete visual tour, then use the searchable help below for the details behind each part of the work.',
  },
  production: {
    title: 'Watch the producer walkthrough',
    description:
      'Start with the complete production tour, then use the producer pathway and searchable help below whenever you need a specific workflow or decision.',
  },
  operations: {
    title: 'Watch the operations walkthrough',
    description:
      'Start with the complete operations tour, then use the searchable help below for a specific fulfillment or inventory workflow.',
  },
};

export default function StudioFeaturedResourceTraining({
  videos = [],
  resourcePathId = 'host',
}) {
  if (!videos.length) return null;
  const copy =
    FEATURED_TRAINING_COPY[resourcePathId] || FEATURED_TRAINING_COPY.host;

  return (
    <section
      className={styles.featuredResourceTraining}
      aria-labelledby="featured-resource-training-heading"
    >
      <div className={styles.featuredResourceTrainingIntro}>
        <span className={styles.eyebrow}>Start here</span>
        <h2 id="featured-resource-training-heading">{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
      <StudioResourceVideos videos={videos} featured />
    </section>
  );
}
