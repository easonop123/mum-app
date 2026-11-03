import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18n';
import { AlertIcon, InfoIcon, PauseIcon, PhoneCallIcon } from './Icons';
import { href } from '../router';

/** Page wrapper: one h1 that receives focus on route change (screen readers announce it). */
export function Page({ title, children, lead }: { title: ReactNode; children?: ReactNode; lead?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, []);
  return (
    <div className="stack">
      <div>
        <h1 ref={ref} tabIndex={-1}>
          {title}
        </h1>
        {lead ? <p className="muted">{lead}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function LinkButton({
  to,
  children,
  variant = 'default',
  large,
  block,
}: {
  to: string;
  children: ReactNode;
  variant?: 'default' | 'primary' | 'quiet' | 'safety';
  large?: boolean;
  block?: boolean;
}) {
  const cls = ['btn', variant !== 'default' ? `btn--${variant}` : '', large ? 'btn--large' : '', block ? 'btn--block' : ''].join(' ');
  return (
    <a className={cls} href={href(to)}>
      {children}
    </a>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  large,
  block,
  disabled,
  type = 'button',
  ariaLabel,
  lang,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'quiet' | 'safety' | 'link';
  large?: boolean;
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  ariaLabel?: string;
  lang?: string;
}) {
  const cls = ['btn', variant !== 'default' ? `btn--${variant}` : '', large ? 'btn--large' : '', block ? 'btn--block' : ''].join(' ');
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel} lang={lang}>
      {children}
    </button>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
}

/** Large radio choices (fieldset + legend) — keyboard and screen-reader friendly. */
export function ChoiceGroup<T extends string>({
  legend,
  choices,
  value,
  onChange,
  name,
  hint,
}: {
  legend: ReactNode;
  choices: Choice<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  name?: string;
  hint?: ReactNode;
}) {
  const auto = useId();
  const groupName = name ?? auto;
  const hintId = `${groupName}-hint`;
  return (
    <fieldset className="choice-group" aria-describedby={hint ? hintId : undefined}>
      <legend>{legend}</legend>
      {hint ? (
        <div className="choice-hint" id={hintId}>
          {hint}
        </div>
      ) : null}
      <div className="choice-list">
        {choices.map((c) => (
          <label key={c.value} className="choice">
            <input type="radio" name={groupName} value={c.value} checked={value === c.value} onChange={() => onChange(c.value)} />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function StatusLabel({ kind, children }: { kind: 'safety' | 'pause' | 'info'; children: ReactNode }) {
  const Icon = kind === 'safety' ? AlertIcon : kind === 'pause' ? PauseIcon : InfoIcon;
  return (
    <p className="status-label">
      <Icon size={24} />
      <span>{children}</span>
    </p>
  );
}

/** NZ help numbers as user-initiated call links. Never auto-dialled. */
export function HelpNumbers({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="stack-sm">
      <a className="btn btn--safety btn--block btn--large" href="tel:111">
        <PhoneCallIcon size={26} />
        <span>{t.help.call111}</span>
      </a>
      <a className="btn btn--block" href="tel:0800611116">
        <PhoneCallIcon size={24} />
        <span>{t.help.callHealthline}</span>
      </a>
      {!compact ? <p className="muted">{t.help.callNote}</p> : null}
    </div>
  );
}

export function BackLink({ to, label }: { to: string; label?: string }) {
  const { t } = useI18n();
  return (
    <p className="no-print">
      <a href={href(to)}>← {label ?? t.back}</a>
    </p>
  );
}
