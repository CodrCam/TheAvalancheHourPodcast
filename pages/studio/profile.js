import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import StudioLayout from '../../components/StudioLayout';
import styles from '../../styles/Studio.module.css';

const MAX_IMAGES = 3;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DATA_LENGTH = 95000;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function fingerprint(profile) {
  if (!profile) return '';
  return JSON.stringify({
    bioShort: profile.bioShort || '',
    bioFull: profile.bioFull || '',
    images: profile.images || [],
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That photo could not be opened.'));
    };
    image.src = url;
  });
}

function renderImage(image, maxSide, quality) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare that photo.');
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, nextWidth, nextHeight);
  context.drawImage(image, 0, 0, nextWidth, nextHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

async function prepareImage(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP photo.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose a photo smaller than 8 MB.');
  }
  const image = await loadImage(file);
  for (const maxSide of [1000, 820, 700, 560]) {
    for (const quality of [0.8, 0.7, 0.6, 0.52]) {
      const result = renderImage(image, maxSide, quality);
      if (result.length <= MAX_IMAGE_DATA_LENGTH) return result;
    }
  }
  throw new Error('That photo is still too large after resizing.');
}

export default function StudioProfilePage() {
  const [profile, setProfile] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const dirty = useMemo(
    () => fingerprint(profile) !== fingerprint(baseline),
    [baseline, profile]
  );

  useEffect(() => {
    let alive = true;
    async function loadProfile() {
      setLoading(true);
      try {
        const response = await fetch('/api/studio/profile', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.code === 'PROFILE_NOT_CONNECTED') {
            setNotConnected(true);
            setCanManageAccess(data.can_manage_access === true);
            return;
          }
          throw new Error(data.error || 'Could not load your profile.');
        }
        if (!alive) return;
        setProfile(data.profile);
        setBaseline(data.profile);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load your profile.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      alive = false;
    };
  }, []);

  function updateProfile(patch) {
    setProfile((current) => ({ ...current, ...patch }));
    setMessage('');
    setError('');
  }

  async function addPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !profile || uploading) return;
    if ((profile.images || []).length >= MAX_IMAGES) {
      setError(`Profiles can include up to ${MAX_IMAGES} photos.`);
      return;
    }
    setUploading(true);
    setError('');
    try {
      const image = await prepareImage(file);
      updateProfile({ images: [...(profile.images || []), image] });
    } catch (err) {
      setError(err.message || 'Could not add that photo.');
    } finally {
      setUploading(false);
    }
  }

  function movePhoto(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= profile.images.length) return;
    const images = [...profile.images];
    [images[index], images[target]] = [images[target], images[index]];
    updateProfile({ images });
  }

  function removePhoto(index) {
    updateProfile({
      images: profile.images.filter((_, imageIndex) => imageIndex !== index),
    });
  }

  async function saveProfile() {
    if (!dirty || saving || !profile) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/studio/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            bioShort: profile.bioShort,
            bioFull: profile.bioFull,
            images: profile.images,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not publish your profile.');
      }
      setProfile(data.profile);
      setBaseline(data.profile);
      setMessage('Your public profile has been updated.');
    } catch (err) {
      setError(err.message || 'Could not publish your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StudioLayout hasUnsavedChanges={dirty}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Public presence</span>
          <h1>My Profile</h1>
          <p>
            Shape how listeners see you on The Avalanche Hour. Your account can
            update only the profile connected by a Studio manager.
          </p>
        </div>
        {profile ? (
          <Link
            href={profile.public_url}
            target="_blank"
            className={styles.secondaryButton}
          >
            <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
            View public profile
          </Link>
        ) : null}
      </header>

      {loading ? <div className={styles.notice}>Loading your profile…</div> : null}
      {notConnected && !loading ? (
        <section className={styles.notice}>
          <h2>Your profile is not connected yet</h2>
          <p>
            This login needs a one-time secure connection to your team profile
            before it can open or edit My Profile.
          </p>
          {canManageAccess ? (
            <Link
              href="/studio/manage/access"
              className={styles.primaryButton}
            >
              Connect my account
            </Link>
          ) : (
            <p>Ask a Studio manager to connect your account in Host Access.</p>
          )}
        </section>
      ) : null}
      {message ? <p className={styles.successMessage}>{message}</p> : null}
      {error ? <p className={styles.errorMessage}>{error}</p> : null}

      {profile ? (
        <div className={styles.editorMain}>
          <section className={styles.editorPanel}>
            <div className={styles.editorPanelHeader}>
              <div>
                <h2>{profile.name}</h2>
                <p>
                  Your name, role, URL, and team placement remain managed by the
                  production team.
                </p>
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldFull}>
                <label htmlFor="profile-short-bio">Short biography</label>
                <textarea
                  id="profile-short-bio"
                  className={styles.textarea}
                  value={profile.bioShort || ''}
                  maxLength={1200}
                  onChange={(event) =>
                    updateProfile({ bioShort: event.target.value })
                  }
                />
                <small>
                  Used in condensed profile displays. Keep this clear and
                  welcoming.
                </small>
              </div>
              <div className={styles.fieldFull}>
                <label htmlFor="profile-full-bio">Full biography</label>
                <textarea
                  id="profile-full-bio"
                  className={styles.textarea}
                  style={{ minHeight: 240 }}
                  value={profile.bioFull || ''}
                  maxLength={12000}
                  onChange={(event) =>
                    updateProfile({ bioFull: event.target.value })
                  }
                />
              </div>
            </div>
          </section>

          <section className={styles.editorPanel}>
            <div className={styles.editorPanelHeader}>
              <div>
                <h2>Profile photography</h2>
                <p>
                  The first image is your primary portrait. Add up to three
                  photos and arrange them in the order you prefer.
                </p>
              </div>
              <label className={styles.secondaryButton}>
                <AddPhotoAlternateRoundedIcon fontSize="small" aria-hidden="true" />
                {uploading ? 'Preparing…' : 'Add photo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={addPhoto}
                  disabled={
                    uploading || (profile.images || []).length >= MAX_IMAGES
                  }
                  hidden
                />
              </label>
            </div>

            <div className={styles.cardGrid}>
              {(profile.images || []).map((image, index) => (
                <article key={`${image.slice(0, 40)}-${index}`} className={styles.actionCard}>
                  <img
                    src={image}
                    alt={`${profile.name} profile option ${index + 1}`}
                    style={{
                      width: '100%',
                      height: 210,
                      objectFit: 'cover',
                      borderRadius: 14,
                      marginBottom: 16,
                    }}
                  />
                  <div className={styles.editorActions}>
                    <strong style={{ fontSize: 13 }}>
                      {index === 0 ? 'Primary photo' : `Photo ${index + 1}`}
                    </strong>
                    <div className={styles.editorActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => movePhoto(index, -1)}
                        disabled={index === 0}
                        aria-label="Move photo earlier"
                      >
                        <ArrowUpwardRoundedIcon aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => movePhoto(index, 1)}
                        disabled={index === profile.images.length - 1}
                        aria-label="Move photo later"
                      >
                        <ArrowDownwardRoundedIcon aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconButton} ${styles.dangerButton}`}
                        onClick={() => removePhoto(index)}
                        aria-label="Remove photo"
                      >
                        <DeleteOutlineRoundedIcon aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!profile.images?.length ? (
              <div className={styles.emptyState}>
                <h2>Add your first profile photo</h2>
                <p>A clear face-forward portrait is the best first image.</p>
              </div>
            ) : null}
          </section>

          <div className={styles.saveDock}>
            <div>
              <strong>
                {dirty ? 'Unpublished profile changes' : 'Profile is up to date'}
              </strong>
              <span>
                Changes publish directly to your public Avalanche Hour profile.
              </span>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={saveProfile}
              disabled={!dirty || saving || uploading}
            >
              <SaveRoundedIcon fontSize="small" aria-hidden="true" />
              {saving ? 'Publishing…' : 'Publish profile'}
            </button>
          </div>
        </div>
      ) : null}
    </StudioLayout>
  );
}
