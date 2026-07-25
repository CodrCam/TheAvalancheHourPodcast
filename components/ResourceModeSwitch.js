import Link from 'next/link';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import styles from '../styles/Studio.module.css';

export default function ResourceModeSwitch({
  activeMode = 'view',
  canEdit = false,
}) {
  return (
    <nav className={styles.modeSwitch} aria-label="Resource workspace mode">
      <Link
        href="/studio/resources"
        className={`${styles.modeLink} ${
          activeMode === 'view' ? styles.modeLinkActive : ''
        }`}
        aria-current={activeMode === 'view' ? 'page' : undefined}
      >
        <VisibilityRoundedIcon aria-hidden="true" />
        Resource center
      </Link>
      {canEdit ? (
        <Link
          href="/studio/manage/resources"
          className={`${styles.modeLink} ${
            activeMode === 'edit' ? styles.modeLinkActive : ''
          }`}
          aria-current={activeMode === 'edit' ? 'page' : undefined}
        >
          <EditNoteRoundedIcon aria-hidden="true" />
          Edit host guide
        </Link>
      ) : null}
    </nav>
  );
}
