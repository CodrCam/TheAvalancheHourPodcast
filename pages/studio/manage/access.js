import { useEffect, useMemo, useState } from 'react';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import StudioLayout from '../../../components/StudioLayout';
import styles from '../../../styles/Studio.module.css';

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function editablePerson(person) {
  return {
    ...person,
    user_sub: person.binding?.user_sub || '',
    account_email: person.binding?.account_email || '',
    binding_active: person.binding?.active !== false,
    savedFingerprint: JSON.stringify({
      user_sub: person.binding?.user_sub || '',
      account_email: person.binding?.account_email || '',
      active: person.binding?.active !== false,
    }),
  };
}

export default function StudioAccessPage() {
  const [people, setPeople] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [currentPersonId, setCurrentPersonId] = useState('');
  const [currentAccountLabel, setCurrentAccountLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyPersonId, setBusyPersonId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAccess() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/studio/manage/access', {
        credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load host access.');
      }
      setPeople((data.people || []).map(editablePerson));
      setConfigured(data.configured === true);
      setCurrentPersonId(data.current_account?.person_id || '');
      setCurrentAccountLabel(data.current_account?.label || '');
    } catch (err) {
      setError(err.message || 'Could not load host access.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccess();
  }, []);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people;
    return people.filter((person) =>
      [person.name, person.title, person.account_email, person.user_sub]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [people, query]);

  const connectedCount = people.filter((person) => person.user_sub).length;
  const accessDirty = people.some(isDirty);

  function updatePerson(personId, patch) {
    setPeople((current) =>
      current.map((person) =>
        person.person_id === personId ? { ...person, ...patch } : person
      )
    );
    setMessage('');
    setError('');
  }

  function isDirty(person) {
    return (
      person.savedFingerprint !==
      JSON.stringify({
        user_sub: person.user_sub.trim(),
        account_email: person.account_email.trim().toLowerCase(),
        active: person.binding_active,
      })
    );
  }

  async function saveBinding(person) {
    if (!person.user_sub.trim() || busyPersonId) return;
    setBusyPersonId(person.person_id);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/studio/manage/access', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          binding: {
            person_id: person.person_id,
            user_sub: person.user_sub.trim(),
            account_email: person.account_email.trim(),
            active: person.binding_active,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not connect that account.');
      }
      setPeople((current) =>
        current.map((item) =>
          item.person_id === person.person_id
            ? editablePerson({ ...item, binding: data.binding })
            : item
        )
      );
      setMessage(`${person.name} is connected to their Cognito account.`);
    } catch (err) {
      setError(err.message || 'Could not connect that account.');
    } finally {
      setBusyPersonId('');
    }
  }

  async function connectSelf(person) {
    if (
      busyPersonId ||
      currentPersonId ||
      !window.confirm(
        `Connect your signed-in account to ${person.name}? Host Studio and My Profile will use this identity.`
      )
    ) {
      return;
    }
    setBusyPersonId(person.person_id);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/studio/manage/access', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect_self',
          person_id: person.person_id,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not connect your account.');
      }
      setPeople((current) =>
        current.map((item) =>
          item.person_id === person.person_id
            ? editablePerson({ ...item, binding: data.binding })
            : item
        )
      );
      setCurrentPersonId(person.person_id);
      setMessage(
        `Your signed-in account is now connected to ${person.name}. Host Studio and My Profile are ready.`
      );
    } catch (err) {
      setError(err.message || 'Could not connect your account.');
    } finally {
      setBusyPersonId('');
    }
  }

  async function removeBinding(person) {
    if (
      busyPersonId ||
      !window.confirm(
        `Disconnect ${person.name}? They will lose access to self-service profile editing.`
      )
    ) {
      return;
    }
    setBusyPersonId(person.person_id);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/studio/manage/access', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: person.person_id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not disconnect that account.');
      }
      setPeople((current) =>
        current.map((item) =>
          item.person_id === person.person_id
            ? editablePerson({ ...item, binding: null })
            : item
        )
      );
      if (currentPersonId === person.person_id) {
        setCurrentPersonId('');
      }
      setMessage(`${person.name} has been disconnected.`);
    } catch (err) {
      setError(err.message || 'Could not disconnect that account.');
    } finally {
      setBusyPersonId('');
    }
  }

  return (
    <StudioLayout
      hasUnsavedChanges={accessDirty}
      unsavedChangesMessage="You have unsaved profile-access changes. Leave and discard them?"
    >
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Producer workspace</span>
          <h1>Host &amp; Team Access</h1>
          <p>
            Connect each Cognito account to exactly one team profile. This
            identity link does not grant permissions; Cognito groups still
            control what the account can access.
          </p>
        </div>
      </header>

      {!configured && !loading ? (
        <p className={styles.warningMessage}>
          Profile access requires both the team profile database and the
          existing site-content database. Seed the team profiles before
          connecting accounts.
        </p>
      ) : null}
      {message ? <p className={styles.successMessage}>{message}</p> : null}
      {error ? <p className={styles.errorMessage}>{error}</p> : null}

      {!loading ? (
        <section className={styles.notice}>
          <h2>
            {currentPersonId
              ? 'Your signed-in account is connected'
              : 'Connect your signed-in account'}
          </h2>
          <p>
            {currentPersonId
              ? `${
                  currentAccountLabel || 'This account'
                } can now use Host Studio and My Profile through its connected team profile.`
              : 'Choose your own team profile below and select “Connect my account.” The server uses your verified login automatically, so there is no Cognito ID to copy.'}
          </p>
        </section>
      ) : null}

      <div className={styles.statusBar}>
        <span>
          {connectedCount} of {people.length} team profiles connected
        </span>
        <span>
          Copy the user’s <strong>sub</strong> attribute from Cognito
        </span>
      </div>

      <div className={styles.resourceControls}>
        <div className={styles.searchField}>
          <SearchRoundedIcon aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team profiles, account emails, or Cognito IDs…"
            aria-label="Search host and team access"
          />
        </div>
      </div>

      {loading ? <div className={styles.notice}>Loading team profiles…</div> : null}

      <section className={styles.accessList}>
        {filteredPeople.map((person) => (
          <article key={person.person_id} className={styles.accessRow}>
            <div className={styles.personIdentity}>
              <span className={styles.personAvatar}>
                {person.image ? (
                  <img src={person.image} alt="" />
                ) : (
                  initials(person.name)
                )}
              </span>
              <div>
                <strong>{person.name}</strong>
                <span>
                  {person.user_sub ? (
                    <>
                      <CheckCircleRoundedIcon
                        sx={{ fontSize: 13, verticalAlign: '-2px', mr: 0.4 }}
                      />
                      {currentPersonId === person.person_id
                        ? 'Your account'
                        : 'Connected'}
                    </>
                  ) : (
                    person.active === false
                      ? 'Inactive profile'
                      : 'Not connected'
                  )}
                </span>
              </div>
            </div>
            <input
              className={styles.input}
              value={person.account_email}
              disabled={
                person.active === false || busyPersonId === person.person_id
              }
              onChange={(event) =>
                updatePerson(person.person_id, {
                  account_email: event.target.value,
                })
              }
              placeholder="Account email"
              aria-label={`${person.name} account email`}
            />
            <input
              className={styles.input}
              value={person.user_sub}
              disabled={
                person.active === false || busyPersonId === person.person_id
              }
              onChange={(event) =>
                updatePerson(person.person_id, {
                  user_sub: event.target.value,
                })
              }
              placeholder="Cognito user sub"
              aria-label={`${person.name} Cognito user ID`}
            />
            <div className={styles.editorActions}>
              {!currentPersonId &&
              !person.binding?.user_sub &&
              person.active !== false ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => connectSelf(person)}
                  disabled={!configured || Boolean(busyPersonId)}
                >
                  <PersonAddRoundedIcon fontSize="small" aria-hidden="true" />
                  {busyPersonId === person.person_id
                    ? 'Connecting…'
                    : 'Connect my account'}
                </button>
              ) : null}
              {person.binding?.user_sub ? (
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.dangerButton}`}
                  onClick={() => removeBinding(person)}
                  disabled={busyPersonId === person.person_id}
                  aria-label={`Disconnect ${person.name}`}
                >
                  <LinkOffRoundedIcon aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => saveBinding(person)}
                disabled={
                  !configured ||
                  person.active === false ||
                  !person.user_sub.trim() ||
                  !isDirty(person) ||
                  Boolean(busyPersonId)
                }
              >
                <SaveRoundedIcon fontSize="small" aria-hidden="true" />
                {busyPersonId === person.person_id ? 'Saving…' : 'Connect'}
              </button>
            </div>
          </article>
        ))}
      </section>
    </StudioLayout>
  );
}
