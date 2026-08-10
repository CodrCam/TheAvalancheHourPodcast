import StudioResourceVideos from './StudioResourceVideos';
import styles from '../styles/Studio.module.css';

export default function StudioFeaturedResourceTraining({ videos = [] }) {
  if (!videos.length) return null;

  return (
    <section
      className={styles.featuredResourceTraining}
      aria-labelledby="featured-resource-training-heading"
    >
      <div className={styles.featuredResourceTrainingIntro}>
        <span className={styles.eyebrow}>Start here</span>
        <h2 id="featured-resource-training-heading">
          Watch the host walkthrough
        </h2>
        <p>
          New or returning hosts can begin with the complete visual tour, then
          use the pathways and searchable manual below for the details behind
          each part of the work.
        </p>
      </div>
      <StudioResourceVideos videos={videos} featured />
    </section>
  );
}
