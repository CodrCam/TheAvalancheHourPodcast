import { useEffect, useMemo, useRef, useState } from 'react';
import Drawer from '@mui/material/Drawer';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import AdminLayout from '../../components/AdminLayout';
import {
  MAX_PERSON_IMAGES,
  PEOPLE_SECTIONS,
  groupPeopleForDisplay,
  moveImageAtIndex,
  removeImageAtIndex,
  restoreImageAtIndex,
} from '../../lib/peoplePresentation.mjs';
import styles from '../../styles/AdminPeople.module.css';

const ROLE_OPTIONS = [
  { value: 'host', label: 'Host' },
  { value: 'webmaster', label: 'Webmaster' },
  { value: 'social_media_manager', label: 'Social Media Manager' },
  { value: 'team', label: 'Team' },
  { value: 'producer', label: 'Producer' },
];

const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map((option) => [option.value, option.label])
);

const MAX_SOURCE_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_STORED_IMAGE_LENGTH = 300000;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function createBlankPerson() {
  return {
    person_id: '',
    slug: '',
    slug_manually_edited: false,
    role: 'host',
    name: '',
    title: '',
    roles: [],
    roles_entry: '',
    studioRoles: [],
    images: [],
    image_entry: '',
    bioShort: '',
    bioFull: '',
    active: true,
    needsBio: false,
    needsImages: false,
    sort_order: 0,
  };
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getRoleLabel(role) {
  return ROLE_LABELS[role] || 'Team';
}

function getSectionLabel(person) {
  return person.role === 'host' ? 'Host' : 'Team';
}

function getInitials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load that image file.'));
    };
    image.src = url;
  });
}

function imageToDataUrl(image, maxSide, quality) {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not prepare that image for upload.');
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

async function resizeImageAsDataUrl(file) {
  const image = await loadImageFromFile(file);

  for (const maxSide of [1400, 1100, 900, 700]) {
    for (const quality of [0.82, 0.74, 0.66, 0.58]) {
      const dataUrl = imageToDataUrl(image, maxSide, quality);
      if (dataUrl.length <= MAX_STORED_IMAGE_LENGTH) {
        return dataUrl;
      }
    }
  }

  throw new Error(
    'That image is still too large after resizing. Please choose a smaller photo.'
  );
}

function normalizeEditablePerson(value = {}) {
  const slug = value.slug || value.person_id || '';

  return {
    ...createBlankPerson(),
    ...value,
    person_id: value.person_id || slug,
    slug,
    active: value.active !== false,
    roles: Array.isArray(value.roles) ? value.roles : [],
    roles_entry: Array.isArray(value.roles) ? value.roles.join(', ') : '',
    studioRoles: Array.isArray(value.studioRoles) ? value.studioRoles : [],
    images: Array.isArray(value.images) ? value.images : [],
    image_entry: '',
  };
}

function parseAdditionalLabels(person) {
  const reservedLabels = new Set(
    [getRoleLabel(person.role), person.title]
      .map((label) => String(label || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const seen = new Set();

  return String(person.roles_entry || '')
    .split(/[\n,]+/)
    .map((role) => role.trim())
    .filter((role) => {
      const key = role.toLowerCase();
      if (!key || reservedLabels.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function personPayload(person) {
  const {
    image_entry,
    roles_entry,
    slug_manually_edited,
    updated_at,
    roles: _roles,
    ...cleanPerson
  } = person;
  const sortOrder = Number(cleanPerson.sort_order);

  return {
    ...cleanPerson,
    person_id: cleanPerson.person_id || cleanPerson.slug,
    sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
    roles: parseAdditionalLabels({ ...person, roles_entry }),
    images: Array.isArray(person.images) ? person.images : [],
  };
}

function personFingerprint(person) {
  return JSON.stringify(personPayload(person || createBlankPerson()));
}

function Field({ label, htmlFor, hint, required = false, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.fieldLabel}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}

function ToggleField({ id, label, hint, checked, onChange, disabled }) {
  return (
    <label htmlFor={id} className={styles.toggleField}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={styles.toggleControl} aria-hidden="true">
        <span />
      </span>
      <span className={styles.toggleCopy}>
        <strong>{label}</strong>
        {hint ? <span>{hint}</span> : null}
      </span>
    </label>
  );
}

function ImageManager({
  person,
  idPrefix,
  onChange,
  onError,
  onBusyChange,
  disabled,
}) {
  const images = person.images || [];
  const [lastRemoved, setLastRemoved] = useState(null);
  const [orderMessage, setOrderMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const removalLockRef = useRef(false);
  const removalTimerRef = useRef(null);
  const reorderLockRef = useRef(false);
  const reorderTimerRef = useRef(null);
  const uploadLockRef = useRef(false);
  const mountedRef = useRef(true);
  const imageActionsDisabled = disabled || uploading;
  const atImageLimit = images.length >= MAX_PERSON_IMAGES;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (removalTimerRef.current) {
        window.clearTimeout(removalTimerRef.current);
      }
      if (reorderTimerRef.current) {
        window.clearTimeout(reorderTimerRef.current);
      }
      onBusyChange(false);
    };
  }, [onBusyChange]);

  function clearRemovalLockSoon() {
    if (removalTimerRef.current) {
      window.clearTimeout(removalTimerRef.current);
    }
    removalTimerRef.current = window.setTimeout(() => {
      removalLockRef.current = false;
    }, 450);
  }

  function clearReorderLockSoon() {
    if (reorderTimerRef.current) {
      window.clearTimeout(reorderTimerRef.current);
    }
    reorderTimerRef.current = window.setTimeout(() => {
      reorderLockRef.current = false;
    }, 450);
  }

  function addImage() {
    if (
      imageActionsDisabled ||
      uploadLockRef.current ||
      removalLockRef.current ||
      reorderLockRef.current
    ) {
      return;
    }
    if (atImageLimit) {
      onError(
        `Each profile can have up to ${MAX_PERSON_IMAGES} photos. Remove one before adding another.`
      );
      return;
    }
    const image = String(person.image_entry || '').trim();
    if (!image) return;

    if (images.includes(image)) {
      onError('That image is already attached to this person.');
      return;
    }

    onError('');
    setLastRemoved(null);
    setOrderMessage('');
    onChange({ images: [...images, image], image_entry: '' });
  }

  function removeImage(index, expectedImage) {
    if (
      imageActionsDisabled ||
      uploadLockRef.current ||
      removalLockRef.current ||
      reorderLockRef.current
    ) {
      return;
    }
    removalLockRef.current = true;
    clearRemovalLockSoon();

    const nextImages = removeImageAtIndex(images, index, expectedImage);
    if (nextImages.length !== images.length - 1) {
      onError('That photo changed before it could be removed. Please try again.');
      return;
    }

    onError('');
    setLastRemoved({ image: expectedImage, index });
    setOrderMessage('');
    onChange({ images: nextImages });
  }

  function undoRemoval() {
    if (
      !lastRemoved ||
      imageActionsDisabled ||
      uploadLockRef.current ||
      removalLockRef.current ||
      reorderLockRef.current
    ) {
      return;
    }
    onChange({
      images: restoreImageAtIndex(
        images,
        lastRemoved.index,
        lastRemoved.image
      ),
    });
    setLastRemoved(null);
    setOrderMessage('');
    onError('');
  }

  function moveImage(fromIndex, toIndex, expectedImage, asHeadshot = false) {
    if (
      imageActionsDisabled ||
      uploadLockRef.current ||
      removalLockRef.current ||
      reorderLockRef.current
    ) {
      return;
    }

    const nextImages = moveImageAtIndex(
      images,
      fromIndex,
      toIndex,
      expectedImage
    );
    if (nextImages.every((image, index) => image === images[index])) {
      onError('That photo order changed. Please try again.');
      return;
    }

    reorderLockRef.current = true;
    clearReorderLockSoon();

    onError('');
    setLastRemoved(null);
    setOrderMessage(
      asHeadshot
        ? `Photo ${fromIndex + 1} is now the primary headshot.`
        : `Photo ${fromIndex + 1} moved ${
            toIndex < fromIndex ? 'earlier' : 'later'
          } in the gallery.`
    );
    onChange({ images: nextImages });
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (
      !file ||
      imageActionsDisabled ||
      uploadLockRef.current ||
      removalLockRef.current ||
      reorderLockRef.current
    ) {
      return;
    }

    if (atImageLimit) {
      onError(
        `Each profile can have up to ${MAX_PERSON_IMAGES} photos. Remove one before uploading another.`
      );
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      onError('Please use a PNG, JPG, or WebP image.');
      return;
    }

    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      onError('Please choose an image under 6 MB.');
      return;
    }

    uploadLockRef.current = true;
    setUploading(true);
    onBusyChange(true);

    try {
      const dataUrl = await resizeImageAsDataUrl(file);
      if (!mountedRef.current) return;

      if (images.includes(dataUrl)) {
        onError('That image is already attached to this person.');
        return;
      }

      onError('');
      setLastRemoved(null);
      setOrderMessage('');
      onChange({ images: [...images, dataUrl] });
    } catch (err) {
      if (mountedRef.current) {
        onError(err.message || 'Could not prepare that image file.');
      }
    } finally {
      uploadLockRef.current = false;
      if (mountedRef.current) {
        setUploading(false);
        onBusyChange(false);
      }
    }
  }

  return (
    <fieldset
      className={styles.imageFieldset}
      disabled={imageActionsDisabled}
      aria-busy={uploading}
    >
      <legend>Photos</legend>
      <div className={styles.imageHelpRow}>
        <p>
          Choose up to three photos. Photo 1 is the primary headshot used on the
          About page; reorder anytime before saving.
        </p>
        <span>
          {images.length} / {MAX_PERSON_IMAGES} attached
        </span>
      </div>

      {images.length ? (
        <div className={styles.imageGrid}>
          {images.map((image, index) => (
            <article
              key={`${index}-${String(image).slice(0, 80)}`}
              className={styles.imageTile}
            >
              <div className={styles.imagePreview}>
                <img
                  src={image}
                  alt={`${person.name || 'Team member'} photo ${index + 1}`}
                />
                {index === 0 ? (
                  <span className={styles.primaryImageBadge}>
                    <StarRoundedIcon aria-hidden="true" />
                    Headshot
                  </span>
                ) : null}
                <span className={styles.imageNumber}>Photo {index + 1}</span>
              </div>
              <div className={styles.imageOrderControls}>
                {index === 0 ? (
                  <div className={styles.primarySelection}>
                    <StarRoundedIcon aria-hidden="true" />
                    Primary headshot
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.headshotButton}
                    onClick={() => moveImage(index, 0, image, true)}
                    disabled={imageActionsDisabled}
                    aria-label={`Use photo ${index + 1} as the primary headshot for ${
                      person.name || 'this team member'
                    }`}
                  >
                    <StarRoundedIcon aria-hidden="true" />
                    Use as headshot
                  </button>
                )}
                <div className={styles.moveButtons}>
                  <button
                    type="button"
                    onClick={() => moveImage(index, index - 1, image)}
                    disabled={imageActionsDisabled || index === 0}
                    aria-label={`Move photo ${index + 1} earlier`}
                    title="Move earlier"
                  >
                    <ArrowBackRoundedIcon aria-hidden="true" />
                    Earlier
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, index + 1, image)}
                    disabled={
                      imageActionsDisabled || index === images.length - 1
                    }
                    aria-label={`Move photo ${index + 1} later`}
                    title="Move later"
                  >
                    Later
                    <ArrowForwardRoundedIcon aria-hidden="true" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                className={styles.removeImageButton}
                onClick={() => removeImage(index, image)}
                disabled={imageActionsDisabled}
                aria-label={`Remove photo ${index + 1} for ${
                  person.name || 'this team member'
                }`}
              >
                <DeleteOutlineRoundedIcon aria-hidden="true" />
                Remove this photo
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyImages}>
          <PhotoLibraryRoundedIcon aria-hidden="true" />
          <strong>No photos attached</strong>
          <span>Add an image path or upload a new photo below.</span>
        </div>
      )}

      {lastRemoved ? (
        <div className={styles.undoNotice} role="status" aria-live="polite">
          <span>
            Photo {lastRemoved.index + 1} was removed from this draft only.
          </span>
          <button
            type="button"
            onClick={undoRemoval}
            disabled={imageActionsDisabled}
          >
            <UndoRoundedIcon aria-hidden="true" />
            Undo
          </button>
        </div>
      ) : null}

      {orderMessage ? (
        <div className={styles.orderNotice} role="status" aria-live="polite">
          <StarRoundedIcon aria-hidden="true" />
          {orderMessage} Save changes to publish the new order.
        </div>
      ) : null}

      {atImageLimit ? (
        <div className={styles.imageLimitNotice}>
          Three-photo limit reached. Remove a photo before adding a new one.
        </div>
      ) : null}

      <div className={styles.imageAddRow}>
        <Field
          label="Image path or URL"
          htmlFor={`${idPrefix}-image-entry`}
          hint="Use an existing /images/hosts/... path or a complete https:// URL."
        >
          <input
            id={`${idPrefix}-image-entry`}
            className={styles.input}
            value={person.image_entry || ''}
            placeholder="/images/hosts/name.jpg"
            onChange={(event) => onChange({ image_entry: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addImage();
              }
            }}
            disabled={imageActionsDisabled || atImageLimit}
          />
        </Field>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={addImage}
          disabled={
            imageActionsDisabled ||
            atImageLimit ||
            !String(person.image_entry || '').trim()
          }
        >
          Add path
        </button>
      </div>

      <label
        className={`${styles.uploadButton} ${
          imageActionsDisabled || atImageLimit ? styles.buttonDisabled : ''
        }`}
      >
        <AddRoundedIcon aria-hidden="true" />
        {uploading ? 'Preparing photo…' : 'Upload a photo'}
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={imageActionsDisabled || atImageLimit}
        />
      </label>
      <span className={styles.fieldHint}>
        {atImageLimit
          ? 'Remove a photo to upload a replacement.'
          : 'PNG, JPG, or WebP up to 6 MB. Uploads are resized before saving.'}
      </span>
    </fieldset>
  );
}

function PersonForm({
  person,
  onChange,
  onError,
  onImageBusyChange,
  disabled,
  isNew,
  deleteConfirm,
  onRequestDelete,
  onCancelDelete,
}) {
  const idPrefix = `person-${slugify(person.person_id || person.slug || 'new')}`;
  const studioRoles = Array.isArray(person.studioRoles)
    ? person.studioRoles
    : [];

  function toggleStudioRole(role, enabled) {
    onChange({
      studioRoles: enabled
        ? [...new Set([...studioRoles, role])]
        : studioRoles.filter((candidate) => candidate !== role),
    });
  }

  return (
    <div className={styles.formSections}>
      <section className={styles.formSection}>
        <div className={styles.formSectionHeading}>
          <span>01</span>
          <div>
            <h3>Profile basics</h3>
            <p>Name, public URL, and how this person is identified.</p>
          </div>
        </div>

        <div className={styles.fieldGrid}>
          <Field label="Name" htmlFor={`${idPrefix}-name`} required>
            <input
              id={`${idPrefix}-name`}
              className={styles.input}
              value={person.name}
              onChange={(event) => onChange({ name: event.target.value })}
              autoComplete="off"
              disabled={disabled}
              required
            />
          </Field>
          <Field
            label="Profile URL"
            htmlFor={`${idPrefix}-slug`}
            hint={`/hosts/${person.slug || 'profile-name'}`}
            required
          >
            <input
              id={`${idPrefix}-slug`}
              className={styles.input}
              value={person.slug}
              onChange={(event) =>
                onChange({
                  slug: slugify(event.target.value),
                  slug_manually_edited: true,
                })
              }
              autoComplete="off"
              disabled={disabled}
              required
            />
          </Field>
          <Field
            label="Role"
            htmlFor={`${idPrefix}-role`}
            hint={`This person will appear under ${getSectionLabel(person)}.`}
          >
            <select
              id={`${idPrefix}-role`}
              className={styles.input}
              value={person.role}
              onChange={(event) => onChange({ role: event.target.value })}
              disabled={disabled}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Display order"
            htmlFor={`${idPrefix}-order`}
            hint="Lower numbers appear first inside Hosts or Team."
          >
            <input
              id={`${idPrefix}-order`}
              type="number"
              className={styles.input}
              value={person.sort_order}
              onChange={(event) =>
                onChange({ sort_order: event.target.value })
              }
              disabled={disabled}
            />
          </Field>
        </div>

        <Field
          label="Optional title"
          htmlFor={`${idPrefix}-title`}
          hint="A short title shown on the public profile."
        >
          <input
            id={`${idPrefix}-title`}
            className={styles.input}
            value={person.title}
            placeholder="Avalanche educator"
            onChange={(event) => onChange({ title: event.target.value })}
            disabled={disabled}
          />
        </Field>

        <Field
          label="Additional labels"
          htmlFor={`${idPrefix}-roles`}
          hint="Optional comma-separated labels. The selected role above is already shown."
        >
          <input
            id={`${idPrefix}-roles`}
            className={styles.input}
            value={person.roles_entry}
            placeholder="Audio editor, Community lead"
            onChange={(event) =>
              onChange({ roles_entry: event.target.value })
            }
            disabled={disabled}
          />
        </Field>

        <div className={styles.toggleGrid}>
          <ToggleField
            id={`${idPrefix}-studio-host`}
            label="Available as an Episode Studio host"
            hint="Internal assignment access; this does not move the public profile into Hosts."
            checked={
              person.role === 'host' || studioRoles.includes('host')
            }
            onChange={(event) =>
              toggleStudioRole('host', event.target.checked)
            }
            disabled={disabled || person.role === 'host'}
          />
          <ToggleField
            id={`${idPrefix}-studio-producer`}
            label="Available as an Episode Studio producer"
            hint="Adds this person to the producer picker without changing their public role."
            checked={
              person.role === 'producer' || studioRoles.includes('producer')
            }
            onChange={(event) =>
              toggleStudioRole('producer', event.target.checked)
            }
            disabled={disabled || person.role === 'producer'}
          />
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.formSectionHeading}>
          <span>02</span>
          <div>
            <h3>Biography</h3>
            <p>Short context for cards and the full public profile.</p>
          </div>
        </div>

        <Field
          label="Short bio"
          htmlFor={`${idPrefix}-bio-short`}
          hint="Aim for one or two concise sentences."
        >
          <textarea
            id={`${idPrefix}-bio-short`}
            className={styles.textarea}
            rows={4}
            value={person.bioShort}
            onChange={(event) => onChange({ bioShort: event.target.value })}
            disabled={disabled}
          />
        </Field>
        <Field
          label="Full bio"
          htmlFor={`${idPrefix}-bio-full`}
          hint="Long-form profile copy. Existing HTML links are supported."
        >
          <textarea
            id={`${idPrefix}-bio-full`}
            className={styles.textarea}
            rows={9}
            value={person.bioFull}
            onChange={(event) => onChange({ bioFull: event.target.value })}
            disabled={disabled}
          />
        </Field>
      </section>

      <section className={styles.formSection}>
        <div className={styles.formSectionHeading}>
          <span>03</span>
          <div>
            <h3>Photos</h3>
            <p>Manage the gallery without changing live content until Save.</p>
          </div>
        </div>
        <ImageManager
          key={isNew ? 'new-person' : person.person_id}
          person={person}
          idPrefix={idPrefix}
          onChange={onChange}
          onError={onError}
          onBusyChange={onImageBusyChange}
          disabled={disabled}
        />
      </section>

      <section className={styles.formSection}>
        <div className={styles.formSectionHeading}>
          <span>04</span>
          <div>
            <h3>Publishing</h3>
            <p>Control visibility and flag anything that still needs work.</p>
          </div>
        </div>

        <div className={styles.toggleGrid}>
          <ToggleField
            id={`${idPrefix}-active`}
            label="Visible on the website"
            hint="Turn this off to hide the profile without deleting it."
            checked={person.active}
            onChange={(event) => onChange({ active: event.target.checked })}
            disabled={disabled}
          />
          <ToggleField
            id={`${idPrefix}-needs-bio`}
            label="Bio coming soon"
            hint="Show a temporary bio status on the profile."
            checked={person.needsBio}
            onChange={(event) =>
              onChange({ needsBio: event.target.checked })
            }
            disabled={disabled}
          />
          <ToggleField
            id={`${idPrefix}-needs-images`}
            label="Photos still needed"
            hint="Keep an internal reminder that the gallery is incomplete."
            checked={person.needsImages}
            onChange={(event) =>
              onChange({ needsImages: event.target.checked })
            }
            disabled={disabled}
          />
        </div>
      </section>

      {!isNew ? (
        <section className={`${styles.formSection} ${styles.dangerSection}`}>
          <div>
            <h3>Remove team member</h3>
            <p>
              This permanently removes the profile record. Hiding the profile
              above is safer if the person may return.
            </p>
          </div>
          {deleteConfirm ? (
            <div className={styles.deleteConfirm} role="alert">
              <strong>Delete {person.name} permanently?</strong>
              <span>This action cannot be undone from this screen.</span>
              <div>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={onRequestDelete}
                  disabled={disabled}
                >
                  Yes, delete profile
                </button>
                <button
                  type="button"
                  className={styles.tertiaryButton}
                  onClick={onCancelDelete}
                  disabled={disabled}
                >
                  Keep profile
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.dangerOutlineButton}
              onClick={onRequestDelete}
              disabled={disabled}
            >
              <DeleteOutlineRoundedIcon aria-hidden="true" />
              Delete profile
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function MemberCard({ person, onEdit, readOnly }) {
  const image = person.images?.[0] || '';
  const roleLabel = getRoleLabel(person.role);

  return (
    <article className={styles.memberCard}>
      <div className={styles.memberAvatar}>
        {image ? (
          <img src={image} alt="" />
        ) : (
          <span>{getInitials(person.name) || '—'}</span>
        )}
      </div>

      <div className={styles.memberMain}>
        <div className={styles.memberTopline}>
          <span
            className={
              person.role === 'host'
                ? styles.hostBadge
                : styles.teamBadge
            }
          >
            {getSectionLabel(person)}
          </span>
          <span
            className={
              person.active ? styles.activeStatus : styles.hiddenStatus
            }
          >
            {person.active ? (
              <CheckCircleRoundedIcon aria-hidden="true" />
            ) : (
              <VisibilityOffRoundedIcon aria-hidden="true" />
            )}
            {person.active ? 'Live' : 'Hidden'}
          </span>
        </div>
        <h3>{person.name || 'Unnamed team member'}</h3>
        <p>{person.title || roleLabel}</p>
        <div className={styles.memberMeta}>
          <span>{roleLabel}</span>
          <span aria-hidden="true">·</span>
          <span>
            <PhotoLibraryRoundedIcon aria-hidden="true" />
            {person.images?.length || 0}{' '}
            {(person.images?.length || 0) === 1 ? 'photo' : 'photos'}
          </span>
        </div>
      </div>

      <button
        type="button"
        className={styles.editButton}
        onClick={onEdit}
        aria-label={`${readOnly ? 'View' : 'Edit'} ${person.name}`}
      >
        <EditRoundedIcon aria-hidden="true" />
        {readOnly ? 'View' : 'Edit'}
      </button>
    </article>
  );
}

export default function AdminPeoplePage() {
  const [people, setPeople] = useState([]);
  const [baselines, setBaselines] = useState({});
  const [draft, setDraft] = useState(createBlankPerson);
  const [editor, setEditor] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function loadPeople() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/store/admin/people', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your account can view this area but cannot manage the team.'
              : 'Failed to load the team.')
        );
      }

      const nextPeople = (data.people || []).map(normalizeEditablePerson);
      setPeople(nextPeople);
      setBaselines(
        Object.fromEntries(
          nextPeople.map((person) => [person.person_id, person])
        )
      );
      setConfigured(data.configured === true);
      setCanUpdate(data.canUpdate === true);
    } catch (err) {
      setError(err.message || 'Failed to load the team.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  function updatePerson(personId, patch) {
    setPeople((current) => {
      let updated = false;
      return current.map((person) => {
        if (updated || person.person_id !== personId) return person;
        updated = true;
        return { ...person, ...patch };
      });
    });
    setCloseConfirm(false);
    setError('');
  }

  function updateDraft(patch) {
    setDraft((current) => {
      const next = { ...current, ...patch };

      if (
        Object.prototype.hasOwnProperty.call(patch, 'name') &&
        !current.slug_manually_edited
      ) {
        next.slug = slugify(patch.name);
        next.person_id = next.slug;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'slug')) {
        next.person_id = patch.slug;
      }

      return next;
    });
    setCloseConfirm(false);
    setError('');
  }

  function openEditor(personId) {
    setEditor({ mode: 'edit', personId });
    setDeleteConfirm(false);
    setCloseConfirm(false);
    setImageBusy(false);
    setError('');
    setMessage('');
  }

  function openAddEditor() {
    setDraft(createBlankPerson());
    setEditor({ mode: 'add', personId: '' });
    setDeleteConfirm(false);
    setCloseConfirm(false);
    setImageBusy(false);
    setError('');
    setMessage('');
  }

  const editorPerson =
    editor?.mode === 'add'
      ? draft
      : people.find((person) => person.person_id === editor?.personId) || null;
  const editorBaseline =
    editor?.mode === 'add'
      ? createBlankPerson()
      : baselines[editor?.personId] || null;
  const editorDirty = Boolean(
    editorPerson &&
      editorBaseline &&
      personFingerprint(editorPerson) !== personFingerprint(editorBaseline)
  );
  const editorReadOnly = !configured || !canUpdate;

  function closeEditor() {
    setEditor(null);
    setDeleteConfirm(false);
    setCloseConfirm(false);
    setImageBusy(false);
    setError('');
  }

  function requestCloseEditor() {
    if (saving || imageBusy) return;
    if (editorDirty) {
      setCloseConfirm(true);
      return;
    }
    closeEditor();
  }

  function discardAndCloseEditor() {
    if (editor?.mode === 'edit' && editorBaseline) {
      setPeople((current) =>
        current.map((person) =>
          person.person_id === editor.personId ? editorBaseline : person
        )
      );
    } else {
      setDraft(createBlankPerson());
    }
    closeEditor();
  }

  async function savePerson(event) {
    event.preventDefault();
    if (
      !configured ||
      !canUpdate ||
      !editorPerson ||
      saving ||
      imageBusy
    ) {
      return;
    }

    const isNew = editor?.mode === 'add';
    const payload = personPayload(editorPerson);

    if (!payload.name || !payload.slug) {
      setError('Name and profile URL are required.');
      return;
    }

    const conflictingPerson = people.find(
      (person) =>
        (person.slug === payload.slug ||
          person.person_id === payload.person_id) &&
        (isNew || person.person_id !== editorPerson.person_id)
    );
    if (conflictingPerson) {
      setError(
        `That profile URL is already used by ${conflictingPerson.name}. Choose a different one.`
      );
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/people', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person: payload }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your account does not have permission to save team edits.'
              : 'Failed to save this profile.')
        );
      }

      const savedPerson = normalizeEditablePerson(data.person);
      setPeople((current) => {
        if (isNew) {
          return [
            ...current.filter(
              (person) => person.person_id !== savedPerson.person_id
            ),
            savedPerson,
          ];
        }

        return current.map((person) =>
          person.person_id === editorPerson.person_id ? savedPerson : person
        );
      });
      setBaselines((current) => ({
        ...current,
        [savedPerson.person_id]: savedPerson,
      }));
      setDraft(createBlankPerson());
      setEditor(null);
      setDeleteConfirm(false);
      setCloseConfirm(false);
      setImageBusy(false);
      setMessage(
        savedPerson.active
          ? `${savedPerson.name} is saved and live.`
          : `${savedPerson.name} is saved and remains hidden.`
      );
    } catch (err) {
      setError(err.message || 'Failed to save this profile.');
    } finally {
      setSaving(false);
    }
  }

  async function deletePerson() {
    if (
      !configured ||
      !canUpdate ||
      !editorPerson ||
      editor?.mode !== 'edit'
    ) {
      return;
    }

    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/people', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: editorPerson.person_id }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your account does not have permission to delete team members.'
              : 'Failed to delete this profile.')
        );
      }

      const deletedName = editorPerson.name;
      setPeople((current) =>
        current.filter(
          (person) => person.person_id !== editorPerson.person_id
        )
      );
      setBaselines((current) => {
        const next = { ...current };
        delete next[editorPerson.person_id];
        return next;
      });
      setEditor(null);
      setDeleteConfirm(false);
      setCloseConfirm(false);
      setImageBusy(false);
      setMessage(`${deletedName} was removed from the team.`);
    } catch (err) {
      setError(err.message || 'Failed to delete this profile.');
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => groupPeopleForDisplay(people), [people]);
  const visibleGrouped = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const next = { hosts: [], team: [] };

    for (const section of PEOPLE_SECTIONS) {
      next[section.id] = grouped[section.id].filter((person) => {
        if (statusFilter === 'active' && !person.active) return false;
        if (statusFilter === 'hidden' && person.active) return false;
        if (!cleanQuery) return true;

        return [
          person.name,
          person.title,
          getRoleLabel(person.role),
          ...(person.roles || []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(cleanQuery);
      });
    }

    return next;
  }, [grouped, query, statusFilter]);

  const activeCount = people.filter((person) => person.active).length;
  const hiddenCount = people.length - activeCount;
  const canSave = Boolean(
    configured &&
      canUpdate &&
      editorDirty &&
      editorPerson?.name.trim() &&
      editorPerson?.slug.trim() &&
      !saving &&
      !imageBusy
  );

  return (
    <AdminLayout
      hasUnsavedChanges={editorDirty}
      unsavedChangesMessage="You have unsaved team-profile changes. Leave this page and discard them?"
    >
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>Website content</span>
            <h1>Hosts &amp; Team</h1>
            <p>
              Manage the people shown on the About page and their public
              profiles.
            </p>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={openAddEditor}
            disabled={loading || !configured || !canUpdate}
            title={
              !configured
                ? 'Connect the team database before adding a person.'
                : !canUpdate
                  ? 'Your account can view the team but cannot change it.'
                  : undefined
            }
          >
            <AddRoundedIcon aria-hidden="true" />
            Add team member
          </button>
        </header>

        {error && !editor ? (
          <div className={styles.errorNotice} role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className={styles.successNotice} role="status" aria-live="polite">
            <CheckCircleRoundedIcon aria-hidden="true" />
            {message}
          </div>
        ) : null}
        {!configured && !loading && !error ? (
          <div className={styles.readOnlyNotice} role="status">
            <CloudOffRoundedIcon aria-hidden="true" />
            <div>
              <strong>Preview mode</strong>
              <span>
                The team database is not connected, so the built-in roster is
                available to view but cannot be changed.
              </span>
            </div>
          </div>
        ) : null}
        {configured && !canUpdate && !loading && !error ? (
          <div className={styles.readOnlyNotice} role="status">
            <CloudOffRoundedIcon aria-hidden="true" />
            <div>
              <strong>Read-only access</strong>
              <span>
                Your account can review team profiles but cannot publish
                changes.
              </span>
            </div>
          </div>
        ) : null}

        <section className={styles.statsGrid} aria-label="Team overview">
          <div className={styles.statCard}>
            <span>Total profiles</span>
            <strong>{loading ? '—' : people.length}</strong>
            <small>Across hosts and team</small>
          </div>
          <div className={styles.statCard}>
            <span>Visible</span>
            <strong>{loading ? '—' : activeCount}</strong>
            <small>Published on the website</small>
          </div>
          <div className={styles.statCard}>
            <span>Hidden</span>
            <strong>{loading ? '—' : hiddenCount}</strong>
            <small>Saved but not public</small>
          </div>
          <div className={`${styles.statCard} ${styles.connectionCard}`}>
            {configured ? (
              <CloudDoneRoundedIcon aria-hidden="true" />
            ) : (
              <CloudOffRoundedIcon aria-hidden="true" />
            )}
            <div>
              <span>Team database</span>
              <strong>{configured ? 'Connected' : 'Preview only'}</strong>
              <small>
                {configured
                  ? canUpdate
                    ? 'Changes can be saved'
                    : 'Read only for your account'
                  : 'Editing is unavailable'}
              </small>
            </div>
          </div>
        </section>

        <section className={styles.rosterSurface}>
          <div className={styles.rosterToolbar}>
            <div className={styles.searchField}>
              <SearchRoundedIcon aria-hidden="true" />
              <label htmlFor="people-search" className={styles.visuallyHidden}>
                Search hosts and team
              </label>
              <input
                id="people-search"
                type="search"
                value={query}
                placeholder="Search by name, title, or role"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="people-status">Show</label>
              <select
                id="people-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All profiles</option>
                <option value="active">Visible only</option>
                <option value="hidden">Hidden only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState} role="status">
              <span />
              Loading the team…
            </div>
          ) : (
            PEOPLE_SECTIONS.map((section) => {
              const visiblePeople = visibleGrouped[section.id];
              const totalPeople = grouped[section.id].length;

              return (
                <section key={section.id} className={styles.peopleSection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <div className={styles.sectionTitleRow}>
                        <h2>{section.label}</h2>
                        <span>{totalPeople}</span>
                      </div>
                      <p>{section.description}</p>
                    </div>
                  </div>

                  {visiblePeople.length ? (
                    <div className={styles.memberGrid}>
                      {visiblePeople.map((person) => (
                        <MemberCard
                          key={person.person_id}
                          person={person}
                          readOnly={!configured || !canUpdate}
                          onEdit={() => openEditor(person.person_id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyRoster}>
                      {totalPeople
                        ? 'No profiles in this section match the current filters.'
                        : `No ${section.label.toLowerCase()} have been added yet.`}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </section>
      </div>

      <Drawer
        anchor="right"
        open={Boolean(editorPerson)}
        onClose={requestCloseEditor}
        PaperProps={{ className: styles.drawerPaper }}
      >
        {editorPerson ? (
          <form
            className={`${styles.editor} ${
              editorReadOnly ? styles.editorPreview : ''
            }`}
            onSubmit={savePerson}
          >
            <header className={styles.editorHeader}>
              <div>
                <span className={styles.eyebrow}>
                  {editor?.mode === 'add' ? 'New profile' : 'Profile editor'}
                </span>
                <h2>
                  {editor?.mode === 'add'
                    ? 'Add a team member'
                    : editorPerson.name}
                </h2>
                <div className={styles.editorStatusLine}>
                  <span
                    className={
                      editorPerson.role === 'host'
                        ? styles.hostBadge
                        : styles.teamBadge
                    }
                  >
                    {getSectionLabel(editorPerson)}
                  </span>
                  {editorReadOnly ? (
                    <span className={styles.previewBadge}>
                      {configured ? 'Read only' : 'Preview'}
                    </span>
                  ) : editorDirty ? (
                    <span className={styles.unsavedBadge}>
                      Unsaved changes
                    </span>
                  ) : (
                    <span className={styles.savedBadge}>Up to date</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={requestCloseEditor}
                aria-label="Close profile editor"
                disabled={saving || imageBusy}
              >
                <CloseRoundedIcon aria-hidden="true" />
              </button>
            </header>

            {editorReadOnly ? (
              <div className={styles.editorReadOnly}>
                {!configured
                  ? 'Preview only — connect the team database to edit this profile.'
                  : 'Read only — your account can review this profile but cannot change it.'}
              </div>
            ) : null}
            {error ? (
              <div className={styles.errorNotice} role="alert">
                {error}
              </div>
            ) : null}

            <div className={styles.editorBody}>
              <PersonForm
                person={editorPerson}
                onChange={
                  editor?.mode === 'add'
                    ? updateDraft
                    : (patch) => updatePerson(editor.personId, patch)
                }
                onError={setError}
                onImageBusyChange={setImageBusy}
                disabled={saving || editorReadOnly}
                isNew={editor?.mode === 'add'}
                deleteConfirm={deleteConfirm}
                onRequestDelete={deletePerson}
                onCancelDelete={() => setDeleteConfirm(false)}
              />
            </div>

            <footer className={styles.editorFooter}>
              {editorReadOnly ? (
                <>
                  <div className={styles.saveContext}>
                    <strong>
                      {configured ? 'Read-only profile' : 'Preview profile'}
                    </strong>
                    <span>
                      {configured
                        ? 'Your account can review this profile but cannot publish changes.'
                        : 'Viewing built-in preview data; no live database record is connected.'}
                    </span>
                  </div>
                  <div className={styles.footerButtons}>
                    <button
                      type="button"
                      className={styles.tertiaryButton}
                      onClick={requestCloseEditor}
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : closeConfirm ? (
                <div className={styles.discardPrompt} role="alert">
                  <div>
                    <strong>Discard unsaved changes?</strong>
                    <span>Nothing has been changed on the live website yet.</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className={styles.dangerOutlineButton}
                      onClick={discardAndCloseEditor}
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      className={styles.tertiaryButton}
                      onClick={() => setCloseConfirm(false)}
                    >
                      Keep editing
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.saveContext}>
                    <strong>
                      {imageBusy
                        ? 'Preparing photo'
                        : editorDirty
                          ? 'Draft changes'
                          : 'No unsaved changes'}
                    </strong>
                    <span>
                      {imageBusy
                        ? 'Please wait a moment before saving or closing.'
                        : editorDirty
                          ? 'Your edits are not live until you save.'
                          : 'This profile matches the live version.'}
                    </span>
                  </div>
                  <div className={styles.footerButtons}>
                    <button
                      type="button"
                      className={styles.tertiaryButton}
                      onClick={requestCloseEditor}
                      disabled={saving || imageBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={!canSave}
                    >
                      <SaveRoundedIcon aria-hidden="true" />
                      {saving
                        ? 'Saving…'
                        : editor?.mode === 'add'
                          ? 'Add team member'
                          : 'Save changes'}
                    </button>
                  </div>
                </>
              )}
            </footer>
          </form>
        ) : null}
      </Drawer>
    </AdminLayout>
  );
}
