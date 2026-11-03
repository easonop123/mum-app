import { useEffect, useRef, useState } from 'react';
import { createInitialAppData } from '../../data/defaults';
import { deleteAllLocalData, listQuarantine, persistenceStatus, requestPersistentStorage, storageEstimate, type PersistResult } from '../../data/db';
import { backupFileName, buildBackup, MAX_IMPORT_BYTES, parseBackupText, summarizeForPrivacy, type ImportResult } from '../../data/exportImport';
import { useStore } from '../../data/store';
import { useI18n } from '../../i18n/I18n';
import { formatLocalDate } from '../../lib/dates';
import { downloadText, shareFile } from '../../lib/download';
import { BackLink, Button, Page } from '../components/ui';
import { navigate } from '../router';

function PrivacyList() {
  const { data } = useStore();
  const { t } = useI18n();
  const s = summarizeForPrivacy(data);
  const items = [
    t.data.preview.answers(s.healthAnswers),
    s.hasProfessionalAdvice ? t.data.preview.advice : null,
    s.hasClinicianPlan ? t.data.preview.clinicianPlan : null,
    t.data.preview.sessions(s.practiceSessions),
    s.notes > 0 ? t.data.preview.notes(s.notes) : null,
    s.safetyHolds > 0 ? t.data.preview.holds(s.safetyHolds) : null,
    s.hasName ? t.data.preview.name : null,
    s.hasBirthYear ? t.data.preview.birthYear : null,
  ].filter((x): x is string => !!x);
  return (
    <ul>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export function DataScreen() {
  const { data, today, replaceAll, makeCtx } = useStore();
  const { t, lang } = useI18n();
  const [persist, setPersist] = useState<PersistResult | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [reviewingBackup, setReviewingBackup] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1>(0);
  const [confirmText, setConfirmText] = useState('');
  const [deleted, setDeleted] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void persistenceStatus().then(setPersist);
    void storageEstimate().then((e) => setUsage(e ? `${Math.max(1, Math.round(e.usage / 1024))} KB` : null));
  }, []);

  const backupText = () => JSON.stringify(buildBackup(data, new Date().toISOString()), null, 2);

  return (
    <Page title={t.data.title}>
      <BackLink to="/settings" />
      <p>{t.data.where}</p>
      {usage ? <p className="muted">{t.data.storageUse(usage)}</p> : null}

      <section className="card stack-sm">
        <h2>{t.data.persistTitle}</h2>
        {persist ? <p>{t.data.persist[persist]}</p> : null}
        {persist === 'not_granted' ? (
          <Button onClick={() => void requestPersistentStorage().then(setPersist)}>{t.data.requestPersist}</Button>
        ) : null}
      </section>

      <section className="card stack-sm">
        <h2>{t.data.backupTitle}</h2>
        {!reviewingBackup ? (
          <Button onClick={() => setReviewingBackup(true)}>{t.data.reviewBackup}</Button>
        ) : (
          <>
            <p>{t.data.previewTitle}</p>
            <PrivacyList />
            <p className="card card--info">{t.data.notEncrypted}</p>
            <Button
              variant="primary"
              block
              onClick={() => {
                downloadText(backupFileName(today), backupText(), 'application/json');
                setBackupStatus(t.data.savedFile);
              }}
            >
              {t.data.saveFile}
            </Button>
            <Button
              block
              onClick={async () => {
                const ok = await shareFile(backupFileName(today), backupText(), 'application/json');
                if (ok) setBackupStatus(t.data.savedFile);
              }}
            >
              {t.data.shareFile}
            </Button>
          </>
        )}
        {backupStatus ? <p role="status">{backupStatus}</p> : null}
      </section>

      <section className="card stack-sm">
        <h2>{t.data.restoreTitle}</h2>
        <p className="muted">{t.data.restoreWarning}</p>
        <input
          ref={fileInput}
          id="restore-file"
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label={t.data.chooseFile}
          tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setImportStatus(null);
            if (file.size > MAX_IMPORT_BYTES) {
              setImported({ ok: false, error: 'too_large', details: [] });
              return;
            }
            const text = await file.text();
            setImported(parseBackupText(text, file.size, new Date().toISOString()));
          }}
        />
        <Button onClick={() => fileInput.current?.click()}>{t.data.chooseFile}</Button>
        {imported && !imported.ok ? (
          <p role="alert" className="card card--info">
            {t.data.importError[imported.error]}
          </p>
        ) : null}
        {imported && imported.ok ? (
          <div className="stack-sm">
            <p>
              {t.data.restorePreview(
                imported.summary.practiceSessions,
                imported.summary.firstPractice ? formatLocalDate(imported.summary.firstPractice, lang) : '',
                imported.summary.lastPractice ? formatLocalDate(imported.summary.lastPractice, lang) : '',
              )}
            </p>
            <p>{t.data.restoreWarning}</p>
            <Button
              variant="primary"
              block
              onClick={async () => {
                await replaceAll(imported.data);
                setImported(null);
                setImportStatus(t.data.restored);
              }}
            >
              {t.data.confirmRestore}
            </Button>
            <Button variant="quiet" block onClick={() => setImported(null)}>
              {t.cancel}
            </Button>
          </div>
        ) : null}
        {importStatus ? <p role="status">{importStatus}</p> : null}
      </section>

      <section className="card card--safety stack-sm">
        <h2>{t.data.deleteTitle}</h2>
        <p>{t.data.deleteBody}</p>
        {deleted ? <p role="status">{t.data.deleted}</p> : null}
        {deleteStep === 0 ? (
          <Button onClick={() => setDeleteStep(1)}>{t.data.deleteReview}</Button>
        ) : (
          <form
            className="stack-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!['DELETE', '删除'].includes(confirmText.trim().toUpperCase())) return;
              try {
                await deleteAllLocalData();
              } catch {
                /* storage may be unavailable; still reset in memory */
              }
              await replaceAll(createInitialAppData(makeCtx().now));
              setDeleteStep(0);
              setConfirmText('');
              setDeleted(true);
              navigate('/onboarding', { replace: true });
            }}
          >
            <PrivacyList />
            <div className="field">
              <label htmlFor="delete-confirm">{t.data.deleteTypeLabel}</label>
              <input id="delete-confirm" type="text" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <Button type="submit" variant="safety" block disabled={!['DELETE', '删除'].includes(confirmText.trim().toUpperCase())}>
              {t.data.deleteFinal}
            </Button>
            <Button variant="quiet" block onClick={() => setDeleteStep(0)}>
              {t.cancel}
            </Button>
          </form>
        )}
      </section>
    </Page>
  );
}

/** Shown when stored data can't be read. The damaged copy stays quarantined. */
export function RecoveryScreen() {
  const { replaceAll, makeCtx } = useStore();
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <Page title={t.recovery.title}>
      <p>{t.recovery.body}</p>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        aria-label={t.data.chooseFile}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > MAX_IMPORT_BYTES) return setImported({ ok: false, error: 'too_large', details: [] });
          setImported(parseBackupText(await file.text(), file.size, new Date().toISOString()));
        }}
      />
      <Button variant="primary" block onClick={() => fileInput.current?.click()}>
        {t.data.chooseFile}
      </Button>
      {imported && !imported.ok ? <p role="alert">{t.data.importError[imported.error]}</p> : null}
      {imported && imported.ok ? (
        <Button variant="primary" block onClick={() => void replaceAll(imported.data)}>
          {t.data.confirmRestore}
        </Button>
      ) : null}
      {!confirming ? (
        <Button block onClick={() => setConfirming(true)}>
          {t.recovery.startFresh}
        </Button>
      ) : (
        <Button variant="safety" block onClick={() => void replaceAll(createInitialAppData(makeCtx().now))}>
          {t.recovery.confirmFresh}
        </Button>
      )}
      <Button
        variant="quiet"
        block
        onClick={async () => {
          const items = await listQuarantine().catch(() => []);
          downloadText('a-little-stronger-damaged-data.json', JSON.stringify(items, null, 2), 'application/json');
        }}
      >
        {t.recovery.download}
      </Button>
    </Page>
  );
}
