import { useId } from 'react';
import PlainTextArea from './PlainTextArea';
import { getGuestProfileFieldErrors } from '../lib/episodeStudioPresentation.mjs';
import styles from '../styles/EpisodeGuestDetailsFields.module.css';

const PUBLIC_PROFILE_FIELDS = [
  {
    key: 'website',
    label: 'Website',
    placeholder: 'https://guestwebsite.com',
    type: 'url',
    inputMode: 'url',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: '@handle or profile link',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: '@handle or profile link',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/in/...',
    type: 'url',
    inputMode: 'url',
  },
  {
    key: 'x_twitter',
    label: 'X / Twitter',
    placeholder: '@handle or profile link',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: '@channel or channel link',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: '@handle or profile link',
  },
  {
    key: 'other',
    label: 'Other public profile',
    placeholder: '@handle or https://...',
  },
];

function fieldValue(profile, key) {
  return typeof profile?.[key] === 'string' ? profile[key] : '';
}

export default function EpisodeGuestDetailsFields({
  profile = {},
  additionalNotes = '',
  earlierSocialNotes = '',
  disabled = false,
  disabledTitle,
  onProfileChange,
  onAdditionalNotesChange,
  onEarlierSocialNotesChange,
}) {
  const generatedId = useId().replace(/:/g, '');
  const id = (suffix) => `guest-details-${generatedId}-${suffix}`;
  const noPublicProfiles = profile.no_public_profiles === true;
  const validationErrors = getGuestProfileFieldErrors(profile);
  const contactHelpId = id('contact-help');
  const publicProfilesHelpId = id('public-profiles-help');

  function updateProfile(field, value) {
    onProfileChange?.({ [field]: value });
  }

  return (
    <div className={styles.workspace}>
      <fieldset className={styles.section} disabled={disabled}>
        <legend className={styles.legend}>
          Guest information
          <span>Required details</span>
        </legend>
        <p className={styles.sectionIntro}>
          Use the guest&apos;s public-facing name and the contact information
          the producer should use.
        </p>

        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={id('name')}>
            <span className={styles.fieldLabel}>
              Guest name <small>Required</small>
            </span>
            <input
              id={id('name')}
              value={fieldValue(profile, 'name')}
              disabled={disabled}
              title={disabled ? disabledTitle : undefined}
              maxLength={180}
              autoComplete="off"
              aria-required="true"
              onChange={(event) => updateProfile('name', event.target.value)}
            />
          </label>

          <label className={styles.field} htmlFor={id('title-affiliation')}>
            <span className={styles.fieldLabel}>
              Title or affiliation <small>Required</small>
            </span>
            <input
              id={id('title-affiliation')}
              value={fieldValue(profile, 'title_affiliation')}
              disabled={disabled}
              title={disabled ? disabledTitle : undefined}
              maxLength={240}
              autoComplete="off"
              aria-required="true"
              onChange={(event) =>
                updateProfile('title_affiliation', event.target.value)
              }
            />
          </label>

          <fieldset
            className={styles.contactGroup}
            aria-describedby={contactHelpId}
          >
            <legend>
              Producer contact <span>One required</span>
            </legend>
            <p id={contactHelpId}>
              Add an email address, a phone number, or both.
            </p>
            <div className={styles.contactGrid}>
              <label
                className={`${styles.field} ${
                  validationErrors.contact_email ? styles.fieldInvalid : ''
                }`}
                htmlFor={id('contact-email')}
              >
                <span className={styles.fieldLabel}>Contact email</span>
                <input
                  id={id('contact-email')}
                  type="email"
                  inputMode="email"
                  value={fieldValue(profile, 'contact_email')}
                  disabled={disabled}
                  title={disabled ? disabledTitle : undefined}
                  maxLength={254}
                  autoComplete="off"
                  aria-invalid={
                    validationErrors.contact_email ? 'true' : undefined
                  }
                  aria-describedby={
                    validationErrors.contact_email
                      ? id('contact-email-error')
                      : undefined
                  }
                  onChange={(event) =>
                    updateProfile('contact_email', event.target.value)
                  }
                />
                {validationErrors.contact_email ? (
                  <span
                    id={id('contact-email-error')}
                    className={styles.fieldError}
                  >
                    {validationErrors.contact_email}
                  </span>
                ) : null}
              </label>

              <label className={styles.field} htmlFor={id('contact-phone')}>
                <span className={styles.fieldLabel}>Contact phone</span>
                <input
                  id={id('contact-phone')}
                  type="tel"
                  inputMode="tel"
                  value={fieldValue(profile, 'contact_phone')}
                  disabled={disabled}
                  title={disabled ? disabledTitle : undefined}
                  maxLength={100}
                  autoComplete="off"
                  onChange={(event) =>
                    updateProfile('contact_phone', event.target.value)
                  }
                />
              </label>
            </div>
          </fieldset>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.fieldLabel} htmlFor={id('short-bio')}>
              Short biography <small>Required</small>
            </label>
            <p className={styles.fieldHelp} id={id('short-bio-help')}>
              Paste or write the bio the producer can use as source material.
            </p>
            <PlainTextArea
              id={id('short-bio')}
              value={fieldValue(profile, 'short_bio')}
              disabled={disabled}
              title={disabled ? disabledTitle : undefined}
              aria-required="true"
              aria-describedby={id('short-bio-help')}
              maxLength={4000}
              expandedMinHeight="clamp(16rem, 48vh, 30rem)"
              onValueChange={(value) => updateProfile('short_bio', value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.section} disabled={disabled}>
        <legend className={styles.legend}>
          Public profiles
          <span>One profile or none</span>
        </legend>
        <p className={styles.sectionIntro} id={publicProfilesHelpId}>
          Add at least one public profile the producer may publish. Use an
          @handle where offered, or paste the complete https:// link.
        </p>

        <label className={styles.noProfilesChoice}>
          <input
            type="checkbox"
            checked={noPublicProfiles}
            disabled={disabled}
            title={disabled ? disabledTitle : undefined}
            onChange={(event) =>
              updateProfile('no_public_profiles', event.target.checked)
            }
          />
          <span>
            <strong>Guest has no public profiles</strong>
            <small>Saved profile entries stay intact but are not required.</small>
          </span>
        </label>

        <div
          className={`${styles.profileGrid} ${
            noPublicProfiles ? styles.profileGridDisabled : ''
          }`}
          aria-describedby={publicProfilesHelpId}
          aria-disabled={noPublicProfiles || undefined}
        >
          {PUBLIC_PROFILE_FIELDS.map((field) => {
            const fieldError = noPublicProfiles
              ? ''
              : validationErrors[field.key];
            return (
              <label
                key={field.key}
                className={`${styles.field} ${
                  fieldError ? styles.fieldInvalid : ''
                }`}
                htmlFor={id(field.key)}
              >
                <span className={styles.fieldLabel}>{field.label}</span>
                <input
                  id={id(field.key)}
                  type={field.type || 'text'}
                  inputMode={field.inputMode}
                  value={fieldValue(profile, field.key)}
                  disabled={disabled || noPublicProfiles}
                  title={disabled ? disabledTitle : undefined}
                  placeholder={field.placeholder}
                  maxLength={field.key === 'other' ? 2000 : 1000}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-invalid={fieldError ? 'true' : undefined}
                  aria-describedby={
                    fieldError ? id(`${field.key}-error`) : undefined
                  }
                  onChange={(event) =>
                    updateProfile(field.key, event.target.value)
                  }
                />
                {fieldError ? (
                  <span
                    id={id(`${field.key}-error`)}
                    className={styles.fieldError}
                  >
                    {fieldError}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>

        <p className={styles.securityNote}>
          Public information only—never include passwords, private account
          access, or other credentials.
        </p>
      </fieldset>

      <details className={styles.notesSection}>
        <summary>
          <span>
            <strong>Additional guest notes</strong>
            <small>Optional context that does not fit above</small>
          </span>
          <span className={styles.summaryStatus}>
            {String(additionalNotes || '').trim() ? 'Added' : 'Optional'}
          </span>
        </summary>
        <div className={styles.notesBody}>
          <label htmlFor={id('additional-notes')}>
            Additional guest notes
          </label>
          <PlainTextArea
            id={id('additional-notes')}
            value={additionalNotes}
            disabled={disabled}
            title={disabled ? disabledTitle : undefined}
            aria-label="Additional guest notes"
            maxLength={12000}
            onValueChange={onAdditionalNotesChange}
          />
          <p>Plain text and pasted lists stay exactly as entered.</p>
        </div>
      </details>

      {String(earlierSocialNotes || '').trim() ? (
        <details className={styles.notesSection}>
          <summary>
            <span>
              <strong>Earlier social-profile notes</strong>
              <small>Preserved from the previous Guest details form</small>
            </span>
            <span className={styles.summaryStatus}>Preserved</span>
          </summary>
          <div className={styles.notesBody}>
            <label htmlFor={id('earlier-social-notes')}>
              Earlier social-profile notes
            </label>
            <PlainTextArea
              id={id('earlier-social-notes')}
              value={earlierSocialNotes}
              disabled={disabled}
              title={disabled ? disabledTitle : undefined}
              aria-label="Earlier social-profile notes"
              maxLength={3000}
              onValueChange={onEarlierSocialNotesChange}
            />
            <p>
              Move current public links into the labeled fields above when
              convenient; this earlier response remains editable.
            </p>
          </div>
        </details>
      ) : null}
    </div>
  );
}
