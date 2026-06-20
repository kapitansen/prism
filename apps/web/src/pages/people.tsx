import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ComponentProps, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type Entity, fetchPeople, updateEntity } from '@/lib/entities'

const peopleKey = ['entities', 'person'] as const

export function PeoplePage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: peopleKey,
    queryFn: fetchPeople,
  })
  const people = data ?? []

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{t('nav.people')}</h1>

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
  const [name, setName] = useState(person.name)
  const [aliases, setAliases] = useState(person.aliases.join(', '))
  const [description, setDescription] = useState(person.description ?? '')
  const [digest, setDigest] = useState(person.digest ?? '')

  const save = useMutation({
    mutationFn: () =>
      updateEntity(person.id, {
        name,
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        description,
        digest,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: peopleKey })
      setEditing(false)
    },
  })

  if (!editing) {
    return (
      <article className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{person.name}</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {t('people.edit')}
          </Button>
        </div>
        {person.aliases.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {person.aliases.join(', ')}
          </p>
        )}
        {person.description && (
          <p className="mt-1 text-sm">{person.description}</p>
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
        <Field label={t('people.summary')}>
          <Textarea
            value={digest}
            onChange={(e) => setDigest(e.target.value)}
            rows={3}
          />
        </Field>
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
