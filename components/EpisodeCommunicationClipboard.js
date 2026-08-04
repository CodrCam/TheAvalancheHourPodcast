import { useMemo } from 'react';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PlainTextArea from './PlainTextArea';
import styles from '../styles/EpisodeCommunicationClipboard.module.css';

const ROLE_LABELS = {
  producer: 'Producer',
  studio_manager: 'Studio manager',
  creator: 'Episode creator',
  host: 'Host',
};

const PRODUCTION_ROLES = new Set([
  'producer',
  'studio_manager',
  'creator',
]);

function defaultFormatMessageDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sortMessagesChronologically(messages) {
  return messages
    .map((message, originalIndex) => ({
      message,
      originalIndex,
      timestamp: Date.parse(message?.created_at || ''),
    }))
    .sort((left, right) => {
      const leftHasTime = Number.isFinite(left.timestamp);
      const rightHasTime = Number.isFinite(right.timestamp);

      if (leftHasTime && rightHasTime && left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }
      if (leftHasTime !== rightHasTime) return leftHasTime ? -1 : 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ message }) => message);
}

export default function EpisodeCommunicationClipboard({
  pinnedNote = '',
  pinnedNoteEditable = false,
  pinnedNoteSaving = false,
  pinnedNoteMaxLength = 4000,
  onPinnedNoteChange,
  onSavePinnedNote,
  messages = [],
  messageDraft = '',
  messageComposerEnabled = true,
  messagePosting = false,
  messageMaxLength = 2400,
  onMessageDraftChange,
  onPostMessage,
  formatMessageDate = defaultFormatMessageDate,
}) {
  const normalizedPinnedNote =
    typeof pinnedNote === 'string' ? pinnedNote : '';
  const normalizedMessageDraft =
    typeof messageDraft === 'string' ? messageDraft : '';
  const chronologicalMessages = useMemo(
    () => sortMessagesChronologically(Array.isArray(messages) ? messages : []),
    [messages]
  );
  const cleanPinnedNote = normalizedPinnedNote.trim();
  const cleanMessageDraft = normalizedMessageDraft.trim();
  const canSavePinnedNote =
    pinnedNoteEditable &&
    !pinnedNoteSaving &&
    typeof onSavePinnedNote === 'function';
  const canPostMessage =
    messageComposerEnabled &&
    !messagePosting &&
    cleanMessageDraft.length >= 2 &&
    typeof onPostMessage === 'function';

  function savePinnedNote(event) {
    event.preventDefault();
    if (!canSavePinnedNote) return;
    onSavePinnedNote(normalizedPinnedNote, event);
  }

  function postMessage(event) {
    event.preventDefault();
    if (!canPostMessage) return;
    onPostMessage(cleanMessageDraft, event);
  }

  return (
    <section
      className={styles.clipboard}
      aria-labelledby="episode-communication-heading"
    >
      <span className={styles.clip} aria-hidden="true" />

      <header className={styles.clipboardHeading}>
        <div>
          <span className={styles.eyebrow}>Episode communication</span>
          <h2 id="episode-communication-heading">
            Direction and decisions, together
          </h2>
          <p>
            Keep producer guidance and episode-specific decisions attached to
            this episode.
          </p>
        </div>
        <aside className={styles.technicalHelp}>
          <WhatsAppIcon aria-hidden="true" />
          <div>
            <strong>Need technical help?</strong>
            <span>Seek help in the team WhatsApp chat.</span>
          </div>
        </aside>
      </header>

      <div className={styles.communicationZones}>
        <section
          id="producer-notes"
          className={`${styles.zone} ${styles.pinnedZone}`}
          aria-labelledby="producer-notes-heading"
        >
          <header className={styles.zoneHeading}>
            <span className={styles.zoneIcon}>
              <PushPinRoundedIcon aria-hidden="true" />
            </span>
            <div>
              <span>Pinned direction</span>
              <h3 id="producer-notes-heading">Note for the hosts</h3>
            </div>
          </header>

          {pinnedNoteEditable ? (
            <form className={styles.pinnedNoteForm} onSubmit={savePinnedNote}>
              <label htmlFor="episode-pinned-note">
                Current producer guidance
                <small>
                  Keep the active instruction here. Put dated decisions and
                  follow-up questions in the conversation.
                </small>
              </label>
              <PlainTextArea
                id="episode-pinned-note"
                value={normalizedPinnedNote}
                maxLength={pinnedNoteMaxLength}
                disabled={pinnedNoteSaving}
                onValueChange={onPinnedNoteChange}
              />
              <div className={styles.formFooter}>
                <small>
                  {normalizedPinnedNote.length.toLocaleString()} /{' '}
                  {pinnedNoteMaxLength.toLocaleString()}
                </small>
                <button type="submit" disabled={!canSavePinnedNote}>
                  <SaveRoundedIcon aria-hidden="true" />
                  {pinnedNoteSaving ? 'Saving…' : 'Save pinned note'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.pinnedNotePaper}>
              {cleanPinnedNote ? (
                <p>{normalizedPinnedNote}</p>
              ) : (
                <p className={styles.emptyPinnedNote}>
                  No producer direction is pinned for this episode.
                </p>
              )}
            </div>
          )}
        </section>

        <section
          id="discussion"
          className={`${styles.zone} ${styles.discussionZone}`}
          aria-labelledby="discussion-heading"
        >
          <header className={styles.zoneHeading}>
            <span className={styles.zoneIcon}>
              <ForumRoundedIcon aria-hidden="true" />
            </span>
            <div>
              <span>Episode record</span>
              <h3 id="discussion-heading">Team conversation</h3>
            </div>
            <span className={styles.messageCount}>
              {chronologicalMessages.length}{' '}
              {chronologicalMessages.length === 1 ? 'update' : 'updates'}
            </span>
          </header>

          <p className={styles.discussionPurpose}>
            Record episode decisions, handoffs, and production questions here.
            This is not the technical-help channel.
          </p>

          {chronologicalMessages.length ? (
            <div className={styles.messageList} aria-label="Episode updates">
              {chronologicalMessages.map((entry, index) => {
                const role = entry?.author_role || 'host';
                const dateLabel = formatMessageDate(entry?.created_at);
                const messageClassName = PRODUCTION_ROLES.has(role)
                  ? `${styles.message} ${styles.productionMessage}`
                  : styles.message;

                return (
                  <article
                    key={entry?.message_id || `${entry?.created_at}-${index}`}
                    className={messageClassName}
                  >
                    <header>
                      <strong>{entry?.author_name || 'Team member'}</strong>
                      <span>{ROLE_LABELS[role] || 'Team member'}</span>
                      {dateLabel ? (
                        <time dateTime={entry.created_at}>{dateLabel}</time>
                      ) : null}
                    </header>
                    <p>{entry?.body || ''}</p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyConversation}>
              No updates yet. Start with the first episode decision or handoff.
            </p>
          )}

          <form className={styles.messageComposer} onSubmit={postMessage}>
            <label htmlFor="episode-message">
              Add an episode update
              <small>
                Use WhatsApp instead when the problem is with the website,
                recording tools, or account access.
              </small>
            </label>
            <PlainTextArea
              id="episode-message"
              value={normalizedMessageDraft}
              maxLength={messageMaxLength}
              disabled={!messageComposerEnabled || messagePosting}
              onValueChange={onMessageDraftChange}
            />
            <div className={styles.formFooter}>
              <small>
                {normalizedMessageDraft.length.toLocaleString()} /{' '}
                {messageMaxLength.toLocaleString()}
              </small>
              <button type="submit" disabled={!canPostMessage}>
                <SendRoundedIcon aria-hidden="true" />
                {messagePosting ? 'Posting…' : 'Post update'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}
