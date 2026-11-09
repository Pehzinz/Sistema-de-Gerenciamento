// Adapted from Spell UI Label Input (MIT). See ../../SPELL-UI-LICENSE.txt.
import { useId, useState } from 'react';

export function LabelInput({ label, ringColor = 'primary', containerClassName = '', className = '', type = 'text', placeholder = '', style, ref, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  const caption = label || props['aria-label'] || placeholder;
  // Keep layout sizing from existing callers; visual styles live in the shared stylesheet.
  const layout = Object.fromEntries(Object.entries(style || {}).filter(([key]) => /^(width|minWidth|maxWidth|flex|flexBasis|flexGrow|flexShrink|margin.*|grid.*|alignSelf|display)$/.test(key)));
  return (
    <div className={`label-input ${password ? 'label-input--password' : ''} ${containerClassName}`} style={{ ...layout, '--field-ring': ringColor === 'blue' ? '#2563eb' : 'var(--primary)' }}>
      <input {...props} ref={ref} id={inputId} type={password && visible ? 'text' : type} placeholder={placeholder || ' '} className={`label-input__control ${className}`} />
      {caption && <label htmlFor={inputId} className="label-input__label">{caption}</label>}
      {password && <button type="button" className="label-input__visibility" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} disabled={props.disabled}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}
        </svg>
      </button>}
    </div>
  );
}

export default LabelInput;
