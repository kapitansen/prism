import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ComponentProps, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardActions } from '@/components/card-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteEntity,
  type Entity,
  fetchPeople,
  updateEntity,
  type UpdateEntityInput,
} from '@/lib/entities'

const peopleKey = ['entities', 'person'] as const

export function PeoplePage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: peopleKey,
    queryFn: fetchPeople,
  })
  const people = data ?? []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      {isLoading && (
        <p className="text-sm text-muted-foreground">{t('people.loading')}</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{t('people.error')}</p>
      )}
      {!isLoading && !isError && people.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('people.empty')}</p>
      )}

      <div className="flex flex-col gap-3">
        {people.map((person) => (
          <PersonCard key={person.id} person={person} />
        ))}
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
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        description,
      }
      // AI/meta fields are only touched in full mode, so simple edits never
      // accidentally overwrite the AI digest or status.
      if (full) {
        patch.digest = digest
        patch.status = status
        if (periodStart) patch.periodStart = periodStart
        if (periodEnd) patch.periodEnd = periodEnd
      }
      return updateEntity(person.id, patch)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: peopleKey })
      setEditing(false)
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteEntity(person.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKey }),
  })

  if (!editing) {
    return (
      <article className="group relative rounded-lg border p-4">
        <CardActions
          onEdit={() => setEditing(true)}
          onDelete={() => remove.mutate()}
        />
        <h2 className="pr-16 font-medium">{person.name}</h2>
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
    <article className="rounded-lg border p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
        className="flex flex-col gap-3"
      >
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
        <Field label={t('people.name')}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
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
          <>
            <Field label={t('people.summary')} hint={t('people.summaryAiHint')}>
              <Textarea
                value={digest}
                onChange={(e) => setDigest(e.target.value)}
                rows={6}
              />
            </Field>
            <Field label={t('people.status')}>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                <option value="active">{t('people.statusActive')}</option>
                <option value="archived">{t('people.statusArchived')}</option>
              </select>
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
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {t('people.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            {t('people.cancel')}
          </Button>
        </div>
      </form>
    </article>
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
    <label className="flex flex-col gap-1">
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
