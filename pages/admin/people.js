import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';

const blankPerson = {
  person_id: '',
  slug: '',
  role: 'host',
  name: '',
  title: '',
  roles: [],
  roles_entry: '',
  images: [],
  image_entry: '',
  bioShort: '',
  bioFull: '',
  active: true,
  needsBio: false,
  needsImages: false,
  sort_order: 0,
};

const ROLE_OPTIONS = [
  { value: 'host', label: 'Host', sectionLabel: 'Hosts' },
  { value: 'webmaster', label: 'Webmaster', sectionLabel: 'Webmasters' },
  {
    value: 'social_media_manager',
    label: 'Social Media Manager',
    sectionLabel: 'Social Media Managers',
  },
  { value: 'team', label: 'Team', sectionLabel: 'Team' },
  { value: 'producer', label: 'Producer', sectionLabel: 'Producers' },
];

const MAX_SOURCE_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_STORED_IMAGE_LENGTH = 300000;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '8px 9px',
  font: 'inherit',
};

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 14,
  background: '#fff',
  display: 'grid',
  gap: 12,
  minWidth: 0,
  overflow: 'hidden',
};

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
      reject(new Error('Could not load image file'));
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
    throw new Error('Could not prepare image for upload.');
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

  throw new Error('That image is still too large after resizing. Please try a smaller photo.');
}

function normalizeEditablePerson(value = {}) {
  const slug = value.slug || value.person_id || '';
  return {
    ...blankPerson,
    ...value,
    person_id: value.person_id || slug,
    slug,
    active: value.active !== false,
    roles: Array.isArray(value.roles) ? value.roles : [],
    roles_entry: Array.isArray(value.roles) ? value.roles.join(', ') : '',
    images: Array.isArray(value.images) ? value.images : [],
    image_entry: '',
  };
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ fontWeight: 700, color: '#334155', fontSize: 13 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ImageManager({ person, onChange, onError }) {
  const images = person.images || [];

  function addImage() {
    const image = String(person.image_entry || '').trim();
    if (!image) return;
    if (images.includes(image)) {
      onError('That image is already attached to this person.');
      return;
    }
    onChange({ images: [...images, image], image_entry: '' });
  }

  function removeImage(index) {
    onChange({ images: images.filter((_, itemIndex) => itemIndex !== index) });
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      onError('Please use a PNG, JPG, or WebP image.');
      return;
    }

    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      onError('Please choose an image under 6 MB.');
      return;
    }

    try {
      const dataUrl = await resizeImageAsDataUrl(file);
      if (images.includes(dataUrl)) {
        onError('That image is already attached to this person.');
        return;
      }
      onChange({ images: [...images, dataUrl] });
    } catch (err) {
      onError(err.message || 'Could not prepare image file.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {images.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
          {images.map((image, index) => (
            <div key={`${image}-${index}`} style={{ display: 'grid', gap: 5 }}>
              <div
                style={{
                  height: 96,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: '#f8fafc',
                }}
              >
                <img
                  src={image}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <button type="button" onClick={() => removeImage(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ color: '#64748b', fontSize: 13 }}>No images attached.</span>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
        <input
          style={fieldStyle}
          value={person.image_entry || ''}
          placeholder="/images/hosts/name.jpg or https://..."
          onChange={(event) => onChange({ image_entry: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addImage();
            }
          }}
        />
        <button type="button" onClick={addImage}>
          Add
        </button>
      </div>
      <label
        style={{
          display: 'inline-flex',
          justifyContent: 'center',
          border: '1px solid #cbd5e1',
          borderRadius: 6,
          padding: '7px 9px',
          cursor: 'pointer',
          fontWeight: 700,
          color: '#334155',
          background: '#fff',
        }}
      >
        Upload image
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </label>
      <span style={{ color: '#64748b', fontSize: 12 }}>
        Uploads are resized for the database. Existing files can be referenced
        by path.
      </span>
    </div>
  );
}

export default function AdminPeoplePage() {
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState(blankPerson);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(
      ROLE_OPTIONS.map((option) => [option.value, []])
    );
    for (const person of people) {
      groups[person.role]?.push(person);
    }
    return groups;
  }, [people]);

  async function loadPeople() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/people', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'You can view the team, but your admin account cannot edit it yet.'
              : 'Failed to load team')
        );
      }
      setPeople((data.people || []).map(normalizeEditablePerson));
      setConfigured(data.configured === true);
    } catch (err) {
      setError(err.message || 'Failed to load team.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  function updatePerson(personId, patch) {
    setPeople((current) =>
      current.map((person) =>
        person.person_id === personId ? { ...person, ...patch } : person
      )
    );
  }

  function updateDraft(patch) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.name && !current.slug) {
        next.slug = slugify(patch.name);
        next.person_id = next.slug;
      }
      if (patch.slug) {
        next.person_id = patch.slug;
      }
      return next;
    });
  }

  function personPayload(person) {
    const { image_entry, roles_entry, ...cleanPerson } = person;
    return {
      ...cleanPerson,
      person_id: cleanPerson.person_id || cleanPerson.slug,
      roles: String(roles_entry || '')
        .split(/[\n,]+/)
        .map((role) => role.trim())
        .filter(Boolean),
      images: Array.isArray(person.images) ? person.images : [],
    };
  }

  async function savePerson(person) {
    setSavingId(person.person_id || 'new');
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/people', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person: personPayload(person) }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your admin account does not have permission to save team edits.'
              : 'Failed to save person')
        );
      }
      setMessage(`${data.person.name} saved.`);
      setDraft(blankPerson);
      await loadPeople();
    } catch (err) {
      setError(err.message || 'Failed to save person.');
    } finally {
      setSavingId('');
    }
  }

  async function deletePerson(person) {
    if (deleteConfirmId !== person.person_id) {
      setDeleteConfirmId(person.person_id);
      return;
    }

    setSavingId(person.person_id);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/people', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: person.person_id }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            (res.status === 403
              ? 'Your admin account does not have permission to delete team members.'
              : 'Failed to delete person')
        );
      }
      setMessage(`${person.name} deleted.`);
      setDeleteConfirmId('');
      await loadPeople();
    } catch (err) {
      setError(err.message || 'Failed to delete person.');
    } finally {
      setSavingId('');
    }
  }

  function renderPersonCard(person) {
    const disabled = savingId === person.person_id;

    return (
      <article key={person.person_id} style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <input
              type="checkbox"
              checked={person.active}
              onChange={(event) =>
                updatePerson(person.person_id, { active: event.target.checked })
              }
            />
            Active
          </label>
          <span
            title={person.person_id}
            style={{
              color: '#64748b',
              fontSize: 12,
              maxWidth: '48%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}
          >
            {person.person_id}
          </span>
        </div>

        <Field label="Name">
          <input
            style={fieldStyle}
            value={person.name}
            onChange={(event) => updatePerson(person.person_id, { name: event.target.value })}
          />
        </Field>

        <Field label="Slug">
          <input
            style={fieldStyle}
            value={person.slug}
            onChange={(event) =>
              updatePerson(person.person_id, {
                slug: slugify(event.target.value),
              })
            }
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 10 }}>
          <Field label="Role">
            <select
              style={fieldStyle}
              value={person.role}
              onChange={(event) => updatePerson(person.person_id, { role: event.target.value })}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order">
            <input
              type="number"
              style={fieldStyle}
              value={person.sort_order}
              onChange={(event) =>
                updatePerson(person.person_id, { sort_order: event.target.value })
              }
            />
          </Field>
        </div>

        <Field label="Optional title">
          <input
            style={fieldStyle}
            value={person.title}
            placeholder="Optional single-line title"
            onChange={(event) => updatePerson(person.person_id, { title: event.target.value })}
          />
        </Field>

        <Field label="Display roles">
          <input
            style={fieldStyle}
            value={person.roles_entry}
            placeholder="Social Media Manager, Webmaster"
            onChange={(event) =>
              updatePerson(person.person_id, { roles_entry: event.target.value })
            }
          />
        </Field>

        <Field label="Short bio">
          <textarea
            style={{ ...fieldStyle, resize: 'vertical' }}
            rows={3}
            value={person.bioShort}
            onChange={(event) => updatePerson(person.person_id, { bioShort: event.target.value })}
          />
        </Field>

        <Field label="Full bio">
          <textarea
            style={{ ...fieldStyle, resize: 'vertical' }}
            rows={6}
            value={person.bioFull}
            onChange={(event) => updatePerson(person.person_id, { bioFull: event.target.value })}
          />
        </Field>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <input
              type="checkbox"
              checked={person.needsBio}
              onChange={(event) =>
                updatePerson(person.person_id, { needsBio: event.target.checked })
              }
            />
            Bio coming soon
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <input
              type="checkbox"
              checked={person.needsImages}
              onChange={(event) =>
                updatePerson(person.person_id, { needsImages: event.target.checked })
              }
            />
            Images needed
          </label>
        </div>

        <Field label="Images">
          <ImageManager
            person={person}
            onChange={(patch) => updatePerson(person.person_id, patch)}
            onError={setError}
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" disabled={disabled} onClick={() => savePerson(person)}>
            {disabled ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => deletePerson(person)}
            style={{ color: '#991b1b' }}
          >
            {deleteConfirmId === person.person_id ? 'Confirm delete' : 'Delete'}
          </button>
        </div>
      </article>
    );
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1180 }}>
        <h1>Team</h1>
        <p style={{ color: '#64748b', maxWidth: 760 }}>
          Edit the host and team cards that appear on the About page and
          individual profile pages.
        </p>

        {loading ? <p>Loading...</p> : null}
        {error ? <p style={{ color: '#991b1b' }}>{error}</p> : null}
        {message ? <p style={{ color: '#166534' }}>{message}</p> : null}

        <div style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
          {configured
            ? 'Team database connected.'
            : 'Team database is not connected yet; showing the built-in team list.'}
        </div>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Add Team Member</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <Field label="Name">
              <input
                style={fieldStyle}
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
              />
            </Field>
            <Field label="Slug">
              <input
                style={fieldStyle}
                value={draft.slug}
                onChange={(event) => updateDraft({ slug: slugify(event.target.value) })}
              />
            </Field>
            <Field label="Role">
              <select
                style={fieldStyle}
                value={draft.role}
                onChange={(event) => updateDraft({ role: event.target.value })}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Display roles">
            <input
              style={fieldStyle}
              value={draft.roles_entry}
              placeholder="Social Media Manager, Webmaster"
              onChange={(event) => updateDraft({ roles_entry: event.target.value })}
            />
          </Field>
          <Field label="Short bio">
            <textarea
              style={{ ...fieldStyle, resize: 'vertical' }}
              rows={3}
              value={draft.bioShort}
              onChange={(event) => updateDraft({ bioShort: event.target.value })}
            />
          </Field>
          <Field label="Full bio">
            <textarea
              style={{ ...fieldStyle, resize: 'vertical' }}
              rows={5}
              value={draft.bioFull}
              onChange={(event) => updateDraft({ bioFull: event.target.value })}
            />
          </Field>
          <Field label="Images">
            <ImageManager person={draft} onChange={updateDraft} onError={setError} />
          </Field>
          <button type="button" disabled={savingId === 'new'} onClick={() => savePerson(draft)}>
            {savingId === 'new' ? 'Saving...' : 'Add team member'}
          </button>
        </section>

        {ROLE_OPTIONS.map((option) => (
          <section key={option.value} style={{ marginTop: 22 }}>
            <h2 style={{ marginBottom: 10 }}>{option.sectionLabel}</h2>
            {grouped[option.value]?.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                {grouped[option.value].map(renderPersonCard)}
              </div>
            ) : (
              <p style={{ color: '#64748b' }}>No {option.sectionLabel.toLowerCase()} yet.</p>
            )}
          </section>
        ))}
      </div>
    </AdminLayout>
  );
}
