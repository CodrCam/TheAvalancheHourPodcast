import { useRef } from 'react';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import styles from '../styles/EpisodeStudio.module.css';

export default function FriendlyDateField({
  value,
  onChange,
  ariaLabel,
  required = false,
  disabled = false,
  min,
  max,
}) {
  const localRef = useRef(null);

  function openPicker() {
    const input = localRef.current;
    if (!input || disabled) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // The focused native date input remains the browser fallback.
      }
    }
  }

  return (
    <div className={styles.friendlyDateField}>
      <input
        ref={localRef}
        type="date"
        value={value}
        onChange={onChange}
        onClick={openPicker}
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label={`Open ${ariaLabel || 'date'} calendar`}
        disabled={disabled}
      >
        <CalendarMonthRoundedIcon aria-hidden="true" />
      </button>
    </div>
  );
}
