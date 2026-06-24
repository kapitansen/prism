import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ComponentProps, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardActions } from '@/components/card-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteEntity,
  type Entity,
  fetchEntities,
  updateEntity,
  type UpdateEntityInput,
} from '@/lib/entities'

// Both tabs share one fetch of all the user's entities (also the @-mention
// picker's cache key), split client-side by type.
const entitiesKey = ['entities'] as const

export function ContextPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'people' | 'themes'>('people')
  const { data, isLoading, isError } = useQuery({
    queryKey: entitiesKey,
    queryFn: fetchEntities,
  })
  const entities = data ?? []
  const people = entities.filter((e) => e.type === 'person')
  const themes = entities.filter((e) => e.type !== 'person')
  const list = tab === 'people' ? people : themes

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={tab === 'people' ? 'default' : 'outline'}
          onClick={() => setTab('people')}
        >
          {t('context.people')} ({people.length})
        </Button>
        <Button
          size="sm"
          variant={tab === 'themes' ? 'default' : 'outline'}
          onClick={() => setTab('themes')}
        >
          {t('context.themes')} ({themes.length})
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t('people.loading')}</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{t('people.error')}</p>
      )}
      {!isLoading && !isError && list.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {tab === 'people' ? t('people.empty') : t('context.themesEmpty')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {list.map((e) =>
          e.type === 'person' ? (
            <PersonCard key={e.id} person={e} />
          ) : (
            <ThemeCard key={e.id} theme={e} />
          ),
        )}
      </div>
    </div>
  )
}

function PersonCard({ person }: { person: Entity }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [full, setFull] = useState(false)
  const [name, setName] = useState(person.name)
  const [handle, setHandle] = useState(person.handle ?? '')
  const [aliases, setAliases] = useState(person.aliases.join(', '))
  const [description, setDescription] = useState(person.description ?? '')
  const [digest, setDigest] = useState(person.digest ?? '')
  const [status, setStatus] = useState(person.status)
  const [periodStart, setPeriodStart] = useState(
    person.periodStart?.slice(0, 10) ?? '',
  )
  const [periodEnd, setPeriodEnd] = useState(
    person.periodEnd?.slice(0, 10) ?? '',
  )

  const save = useMutation({
    mutationFn: () => {
      const patch: UpdateEntityInput = {
        name,
        aliases: splitAliases(aliases),
        description,
      }
      if (handle.trim()) patch.handle = handle.trim()
      if (full) {
        patch.digest = digest
        patch.status = status
        if (periodStart) patch.periodStart = periodStart
        if (periodEnd) patch.periodEnd = periodEnd
      }
      return updateEntity(person.id, patch)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entitiesKey })
      setEditing(false)
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteEntity(person.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entitiesKey }),
  })

  if (!editing) {
    return (
      <article className="group relative rounded-lg border p-4">
        <CardActions
          onEdit={() => setEditing(true)}
          onDelete={() => remove.mutate()}
        />
        <h2 className="pr-16 font-medium">
          {person.name}
          {person.handle && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              @{person.handle}
            </span>
          )}
        </h2>
        {person.aliases.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {person.aliases.join(', ')}
          </p>
        )}
        {person.description && (
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {person.description}
          </p>
        )}
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {person.digest || t('people.summaryEmpty')}
        </p>
      </article>
    )
  }

  return (
    <EditForm onSubmit={() => save.mutate()} onCancel={() => setEditing(false)}>
      <ModeToggle full={full} setFull={setFull} />
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label={t('people.name')}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="flex-1">
          <Field label={t('people.handle')}>
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="nickname"
            />
          </Field>
        </div>
      </div>
      <Field label={t('people.aliases')} hint={t('people.aliasesHint')}>
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} />
      </Field>
      <Field label={t('people.description')}>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </Field>
      {full && (
        <FullFields
          digest={digest}
          setDigest={setDigest}
          status={status}
          setStatus={setStatus}
          periodStart={periodStart}
          setPeriodStart={setPeriodStart}
          periodEnd={periodEnd}
          setPeriodEnd={setPeriodEnd}
        />
      )}
    </EditForm>
  )
}

function ThemeCard({ theme }: { theme: Entity }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [full, setFull] = useState(false)
  const [name, setName] = useState(theme.name)
  const [type, setType] = useState(theme.type)
  const [aliases, setAliases] = useState(theme.aliases.join(', '))
  const [description, setDescription] = useState(theme.description ?? '')
  const [digest, setDigest] = useState(theme.digest ?? '')
  const [status, setStatus] = useState(theme.status)
  const [periodStart, setPeriodStart] = useState(
    theme.periodStart?.slice(0, 10) ?? '',
  )
  const [periodEnd, setPeriodEnd] = useState(
    theme.periodEnd?.slice(0, 10) ?? '',
  )

  const save = useMutation({
    mutationFn: () => {
      const patch: UpdateEntityInput = {
        name,
        type, // themes have an editable type; no @handle
        aliases: splitAliases(aliases),
        description,
      }
      if (full) {
        patch.digest = digest
        patch.status = status
        if (periodStart) patch.periodStart = periodStart
        if (periodEnd) patch.periodEnd = periodEnd
      }
      return updateEntity(theme.id, patch)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entitiesKey })
      setEditing(false)
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteEntity(theme.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entitiesKey }),
  })

  if (!editing) {
    return (
      <article className="group relative rounded-lg border p-4">
        <CardActions
          onEdit={() => setEditing(true)}
          onDelete={() => remove.mutate()}
        />
        <h2 className="flex items-center gap-2 pr-16 font-medium">
          {theme.name}
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {t(`context.type.${theme.type}`)}
          </span>
        </h2>
        {theme.aliases.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {theme.aliases.join(', ')}
          </p>
        )}
        {theme.description && (
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {theme.description}
          </p>
        )}
        {theme.digest && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {theme.digest}
          </p>
        )}
      </article>
    )
  }

  return (
    <EditForm onSubmit={() => save.mutate()} onCancel={() => setEditing(false)}>
      <ModeToggle full={full} setFull={setFull} />
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label={t('people.name')}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="flex-1">
          <Field label={t('context.typeLabel')}>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="project">{t('context.type.project')}</option>
              <option value="habit">{t('context.type.habit')}</option>
              <option value="event">{t('context.type.event')}</option>
            </Select>
          </Field>
        </div>
      </div>
      <Field label={t('people.aliases')} hint={t('people.aliasesHint')}>
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} />
      </Field>
      <Field label={t('people.description')}>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </Field>
      {full && (
        <FullFields
          digest={digest}
          setDigest={setDigest}
          status={status}
          setStatus={setStatus}
          periodStart={periodStart}
          setPeriodStart={setPeriodStart}
          periodEnd={periodEnd}
          setPeriodEnd={setPeriodEnd}
        />
      )}
    </EditForm>
  )
}

// ── shared bits ──

function splitAliases(raw: string): string[] {
  return raw
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
}

function EditForm({
  onSubmit,
  onCancel,
  children,
}: {
  onSubmit: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <article className="rounded-lg border p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="flex flex-col gap-3"
      >
        {children}
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            {t('people.save')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t('people.cancel')}
          </Button>
        </div>
      </form>
    </article>
  )
}

function ModeToggle({
  full,
  setFull,
}: {
  full: boolean
  setFull: (v: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        size="xs"
        variant={full ? 'outline' : 'default'}
        onClick={() => setFull(false)}
      >
        {t('common.simpleMode')}
      </Button>
      <Button
        type="button"
        size="xs"
        variant={full ? 'default' : 'outline'}
        onClick={() => setFull(true)}
      >
        {t('common.fullMode')}
      </Button>
    </div>
  )
}

function FullFields({
  digest,
  setDigest,
  status,
  setStatus,
  periodStart,
  setPeriodStart,
  periodEnd,
  setPeriodEnd,
}: {
  digest: string
  setDigest: (v: string) => void
  status: string
  setStatus: (v: string) => void
  periodStart: string
  setPeriodStart: (v: string) => void
  periodEnd: string
  setPeriodEnd: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Field label={t('people.summary')} hint={t('people.summaryAiHint')}>
        <Textarea
          value={digest}
          onChange={(e) => setDigest(e.target.value)}
          rows={6}
        />
      </Field>
      <Field label={t('people.status')}>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">{t('people.statusActive')}</option>
          <option value="archived">{t('people.statusArchived')}</option>
        </Select>
      </Field>
      <div className="flex gap-3">
        <Field label={t('people.periodStart')}>
          <Input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </Field>
        <Field label={t('people.periodEnd')}>
          <Input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </Field>
      </div>
    </>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {children}
    </label>
  )
}

function Textarea(props: ComponentProps<'textarea'>) {
  return (
    <textarea
      className="focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
      {...props}
    />
  )
}

function Select(props: ComponentProps<'select'>) {
  return (
    <select
      className="focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
      {...props}
    />
  )
}
