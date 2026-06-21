import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  activateCoachPackVersion,
  coachPackKey,
  type CoachPackVersion,
  coachPackVersionsKey,
  createCoachPackVersion,
  fetchActiveCoachPack,
  fetchCoachPackVersions,
} from '@/lib/coach-pack'

// Editable AI config (spec §5.2). Saving creates a new version and activates
// it; older versions stay for rollback.
export function CoachPackSettings() {
  const { t } = useTranslation()
  const active = useQuery({
    queryKey: coachPackKey,
    queryFn: fetchActiveCoachPack,
  })

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{t('settings.ai.title')}</span>
        <span className="text-xs text-muted-foreground">
          {t('settings.ai.hint')}
        </span>
      </div>
      {active.isLoading && (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      )}
      {/* keyed by id → re-inits the form when the active version changes */}
      {active.data && (
        <CoachPackEditor key={active.data.id} active={active.data} />
      )}
      <CoachPackHistory />
    </section>
  )
}

function CoachPackEditor({ active }: { active: CoachPackVersion }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [voiceMd, setVoiceMd] = useState(active.voiceMd)
  const [analysisMd, setAnalysisMd] = useState(active.analysisMd)
  const [thresholds, setThresholds] = useState(
    JSON.stringify(active.thresholdsJson, null, 2),
  )
  const [jsonError, setJsonError] = useState(false)

  const save = useMutation({
    mutationFn: (thresholdsJson: Record<string, unknown>) =>
      createCoachPackVersion({
        voiceMd,
        analysisMd,
        thresholdsJson,
        sourceNote: 'manual edit',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: coachPackKey })
      void queryClient.invalidateQueries({ queryKey: coachPackVersionsKey })
    },
  })

  function onSave() {
    let parsed: Record<string, unknown>
    try {
      parsed = thresholds.trim() ? JSON.parse(thresholds) : {}
    } catch {
      setJsonError(true)
      return
    }
    setJsonError(false)
    save.mutate(parsed)
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label={t('settings.ai.voice')}>
        <Textarea
          value={voiceMd}
          onChange={(e) => setVoiceMd(e.target.value)}
          rows={10}
        />
      </Field>
      <Field label={t('settings.ai.analysis')}>
        <Textarea
          value={analysisMd}
          onChange={(e) => setAnalysisMd(e.target.value)}
          rows={10}
        />
      </Field>
      <Field label={t('settings.ai.thresholds')}>
        <Textarea
          value={thresholds}
          onChange={(e) => setThresholds(e.target.value)}
          rows={3}
          className="font-mono"
        />
        {jsonError && (
          <span className="text-xs text-destructive">
            {t('settings.ai.thresholdsInvalid')}
          </span>
        )}
      </Field>
      <Button size="sm" className="self-start" onClick={onSave}>
        {t('common.save')}
      </Button>
    </div>
  )
}

function CoachPackHistory() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const versions = useQuery({
    queryKey: coachPackVersionsKey,
    queryFn: fetchCoachPackVersions,
  })
  const activate = useMutation({
    mutationFn: activateCoachPackVersion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: coachPackKey })
      void queryClient.invalidateQueries({ queryKey: coachPackVersionsKey })
    },
  })

  // Nothing to roll back to with a single version.
  if (!versions.data || versions.data.length <= 1) return null

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">{t('settings.ai.history')}</span>
      <ul className="flex flex-col gap-1">
        {versions.data.map((v) => (
          <li
            key={v.id}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-muted-foreground">
              {`${new Date(v.createdAt).toLocaleString()} · ${v.sourceNote}`}
            </span>
            {v.isActive ? (
              <span className="text-muted-foreground">
                {t('settings.ai.active')}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => activate.mutate(v.id)}
              >
                {t('settings.ai.activate')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function Textarea({
  className = '',
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={`focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] ${className}`}
      {...props}
    />
  )
}
