import styles from '../styles/Studio.module.css';

function formatVideoSize(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return '';
  const gibibytes = bytes / (1024 * 1024 * 1024);
  if (gibibytes >= 1) return `${gibibytes.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

export default function StudioResourceVideos({
  videos = [],
  previewVideos = false,
  featured = false,
}) {
  if (!videos.length) return null;

  return (
    <div
      className={`${styles.resourceVideos} ${
        featured ? styles.resourceVideosFeatured : ''
      }`}
    >
      {videos.map((video) => (
        <article className={styles.resourceVideoCard} key={video.id}>
          <div className={styles.resourceVideoHeading}>
            <div>
              <h3>{video.title}</h3>
              {video.description ? <p>{video.description}</p> : null}
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
            src={`/api/studio/resource-videos/${encodeURIComponent(video.id)}${
              previewVideos ? '?draft=1' : ''
            }`}
          >
            Your browser does not support inline video playback.
          </video>
        </article>
      ))}
    </div>
  );
}
