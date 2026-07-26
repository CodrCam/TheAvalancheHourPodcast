import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import FriendlyDateField from './FriendlyDateField';
import {
  EPISODE_RECORDING_DURATIONS,
  EPISODE_RECORDING_TIME_ZONES,
  formatRecordingSchedule,
} from '../lib/episodeCalendar.mjs';
import styles from '../styles/EpisodeStudio.module.css';

export function EpisodeRecordingSummary({ episode, onDownload }) {
  const scheduleLabel = formatRecordingSchedule(episode);
  const recordingLocation = String(episode.recording_location || '');
  const recordingLocationUrl = /^https:\/\//i.test(recordingLocation)
    ? recordingLocation
    : '';

  return (
    <section className={styles.recordingSchedule}>
      <div className={styles.recordingScheduleIcon}>
        <EventRoundedIcon aria-hidden="true" />
      </div>
      <div className={styles.recordingScheduleCopy}>
        <span className={styles.eyebrow}>Recording session</span>
        {scheduleLabel ? (
          <>
            <strong>{scheduleLabel}</strong>
            <p>
              {episode.recording_duration_minutes} minutes
              {recordingLocation && !recordingLocationUrl
                ? ` · ${recordingLocation}`
                : ''}
              {recordingLocationUrl ? (
                <>
                  {' · '}
                  <a
                    href={recordingLocationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open recording room
                  </a>
                </>
              ) : null}
            </p>
          </>
        ) : (
          <>
            <strong>Recording time not scheduled</strong>
            <p>
              A producer can add the confirmed date, time, and time zone below.
            </p>
          </>
        )}
      </div>
      {scheduleLabel ? (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onDownload}
        >
          <DownloadRoundedIcon aria-hidden="true" />
          Add to calendar
        </button>
      ) : null}
    </section>
  );
}

export function EpisodeRecordingFields({ schedule, onChange }) {
  const currentTimeZone = String(schedule.recording_time_zone || '');
  const hasCustomTimeZone =
    currentTimeZone &&
    !EPISODE_RECORDING_TIME_ZONES.some(
      (timeZone) => timeZone.value === currentTimeZone
    );

  return (
    <>
      <label>
        Recording date
        <FriendlyDateField
          value={schedule.recording_date || ''}
          onChange={(event) =>
            onChange({ recording_date: event.target.value })
          }
          ariaLabel="recording date"
        />
      </label>
      <label>
        Recording time
        <input
          type="time"
          value={schedule.recording_time || ''}
          onChange={(event) =>
            onChange({ recording_time: event.target.value })
          }
        />
      </label>
      <label>
        Recording time zone
        <select
          value={currentTimeZone}
          onChange={(event) =>
            onChange({ recording_time_zone: event.target.value })
          }
        >
          <option value="">Choose time zone</option>
          {hasCustomTimeZone ? (
            <option value={currentTimeZone}>{currentTimeZone}</option>
          ) : null}
          {EPISODE_RECORDING_TIME_ZONES.map((timeZone) => (
            <option key={timeZone.value} value={timeZone.value}>
              {timeZone.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Recording length
        <select
          value={schedule.recording_duration_minutes || 60}
          onChange={(event) =>
            onChange({
              recording_duration_minutes: Number(event.target.value),
            })
          }
        >
          {EPISODE_RECORDING_DURATIONS.map((duration) => (
            <option key={duration} value={duration}>
              {duration} minutes
            </option>
          ))}
        </select>
      </label>
      <label className={styles.fullField}>
        Recording location or link
        <input
          value={schedule.recording_location || ''}
          onChange={(event) =>
            onChange({ recording_location: event.target.value })
          }
          placeholder="Riverside link, Zoom link, phone, or studio"
        />
      </label>
    </>
  );
}
