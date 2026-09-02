import {
  Boxes,
  Check,
  ChevronRight,
  FolderPlus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type UserStatus = 'ACTIVE' | 'SUSPENDED';
type ApplicationChoice = { id: string; name: string; type: string };
type UserChoice = {
  id: string;
  name: string;
  email: string;
  organizationRole: string;
  status: UserStatus;
};
type GroupMember = Pick<UserChoice, 'id' | 'name' | 'email' | 'status'>;
type Group = {
  id: string;
  name: string;
  description: string | null;
  members: GroupMember[];
  applications: ApplicationChoice[];
};
type GroupsData = { groups: Group[]; applications: ApplicationChoice[]; users: UserChoice[] };

export default function AdminGroups() {
  const groupsApi = useApi<GroupsData>('/api/v1/admin/groups');
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'create' | 'edit' | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [applicationIds, setApplicationIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const selected = groupsApi.data?.groups.find((group) => group.id === selectedId);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredGroups = (groupsApi.data?.groups ?? []).filter((group) =>
    [
      group.name,
      group.description ?? '',
      ...group.members.map((member) => `${member.name} ${member.email}`),
      ...group.applications.map((application) => application.name),
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );

  useEffect(() => {
    if (!selected || panel !== 'edit') return;
    setName(selected.name);
    setDescription(selected.description ?? '');
    setMemberIds(selected.members.map((member) => member.id));
    setApplicationIds(selected.applications.map((application) => application.id));
  }, [panel, selected]);

  function openCreate() {
    setName('');
    setDescription('');
    setMemberIds([]);
    setApplicationIds([]);
    setActionError('');
    setPanel('create');
  }

  function openEdit(group: Group) {
    setSelectedId(group.id);
    setActionError('');
    setPanel('edit');
  }

  function closePanel() {
    if (saving) return;
    setPanel(null);
    setSelectedId('');
    setActionError('');
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      const group = await request<Group>(
        panel === 'edit' && selected
          ? `/api/v1/admin/groups/${selected.id}`
          : '/api/v1/admin/groups',
        {
          method: panel === 'edit' ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name,
            description: description.trim() || null,
            memberIds,
            applicationIds,
          }),
        },
      );
      groupsApi.setData((current) => {
        if (!current || !group) return current;
        const groups =
          panel === 'edit'
            ? current.groups.map((value) => (value.id === group.id ? group : value))
            : [...current.groups, group];
        return {
          ...current,
          groups: groups.sort((left, right) => left.name.localeCompare(right.name)),
        };
      });
      closePanel();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save group');
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup() {
    if (
      !selected ||
      !window.confirm(`Delete ${selected.name}? Group-based access will be removed.`)
    )
      return;
    setSaving(true);
    setActionError('');
    try {
      await request(`/api/v1/admin/groups/${selected.id}`, { method: 'DELETE' });
      groupsApi.setData((current) =>
        current
          ? { ...current, groups: current.groups.filter((group) => group.id !== selected.id) }
          : current,
      );
      closePanel();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete group');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout admin>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">ACCESS GROUPS</p>
          <h1 className="mt-2 text-3xl font-semibold">Teams and permissions</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Bundle people and application access into groups that stay easy to understand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin-users" passHref>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className="button-secondary gap-2">
              <UserRound size={17} /> Manage users
            </a>
          </Link>
          <button className="button gap-2" onClick={openCreate} type="button">
            <FolderPlus size={17} /> Create group
          </button>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Groups" value={groupsApi.data?.groups.length ?? 0} />
        <SummaryCard
          label="Member links"
          value={sum(groupsApi.data?.groups.map((group) => group.members.length))}
        />
        <SummaryCard
          label="App permissions"
          value={sum(groupsApi.data?.groups.map((group) => group.applications.length))}
        />
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Group directory</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review membership and inherited app access.
            </p>
          </div>
          <label className="relative block sm:w-80">
            <span className="sr-only">Search groups</span>
            <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
            <input
              className="input pl-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search groups, members, apps..."
              value={query}
            />
          </label>
        </div>

        {groupsApi.loading ? (
          <div className="grid gap-4 p-5 lg:grid-cols-2" aria-label="Loading groups">
            {[1, 2, 3, 4].map((item) => (
              <div className="h-44 animate-pulse rounded-xl bg-muted" key={item} />
            ))}
          </div>
        ) : groupsApi.error ? (
          <p className="p-6 text-sm text-red-600" role="alert">
            {groupsApi.error}
          </p>
        ) : (
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {filteredGroups.map((group) => (
              <article
                className="rounded-2xl border border-border bg-background p-5 transition hover:border-primary/40 hover:shadow-sm"
                key={group.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <UsersRound size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{group.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {group.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>
                  <button
                    aria-label={`Edit ${group.name}`}
                    className="button-secondary !min-h-[36px] !px-2.5"
                    onClick={() => openEdit(group)}
                    type="button"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Members
                    </p>
                    <p className="mt-1 text-sm font-medium">{group.members.length}</p>
                    <p
                      className="mt-1 truncate text-xs text-slate-500"
                      title={group.members.map((member) => member.name).join(', ')}
                    >
                      {previewNames(group.members.map((member) => member.name))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Applications
                    </p>
                    <p className="mt-1 text-sm font-medium">{group.applications.length}</p>
                    <p
                      className="mt-1 truncate text-xs text-slate-500"
                      title={group.applications.map((app) => app.name).join(', ')}
                    >
                      {previewNames(group.applications.map((app) => app.name))}
                    </p>
                  </div>
                </div>
              </article>
            ))}
            {!filteredGroups.length && (
              <div className="py-14 text-center lg:col-span-2">
                <Boxes className="mx-auto text-slate-300" size={34} />
                <p className="mt-3 font-medium">No groups found</p>
                <p className="mt-1 text-sm text-slate-500">Create a group or adjust your search.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 p-0 backdrop-blur-sm sm:p-4">
          <section
            aria-labelledby="group-panel-title"
            aria-modal="true"
            className="h-full w-full overflow-y-auto bg-card shadow-2xl sm:max-w-xl sm:rounded-2xl sm:border sm:border-border"
            role="dialog"
          >
            <form onSubmit={submitGroup}>
              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card/95 p-6 backdrop-blur">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                    Permission bundle
                  </p>
                  <h2 className="mt-2 text-xl font-semibold" id="group-panel-title">
                    {panel === 'create' ? 'Create a group' : `Edit ${selected?.name ?? 'group'}`}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Members inherit every application selected here.
                  </p>
                </div>
                <button
                  aria-label="Close panel"
                  className="button-secondary !min-h-[36px] !px-2.5"
                  onClick={closePanel}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-7 p-6">
                <div>
                  <label className="text-sm font-medium" htmlFor="group-name">
                    Group name
                  </label>
                  <input
                    className="input mt-2"
                    id="group-name"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Engineering"
                    required
                    value={name}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="group-description">
                    Description <span className="font-normal text-slate-400">Optional</span>
                  </label>
                  <textarea
                    className="mt-2 min-h-[90px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-slate-400"
                    id="group-description"
                    maxLength={500}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Who belongs here and what access they need"
                    value={description}
                  />
                </div>

                <SelectionList
                  empty="No organization members are available."
                  onChange={setMemberIds}
                  options={(groupsApi.data?.users ?? []).map((user) => ({
                    id: user.id,
                    name: user.name,
                    detail: `${user.email} · ${titleCase(user.organizationRole)}${
                      user.status === 'SUSPENDED' ? ' · Suspended' : ''
                    }`,
                  }))}
                  selected={memberIds}
                  title="Members"
                />
                <SelectionList
                  empty="No applications are available."
                  onChange={setApplicationIds}
                  options={(groupsApi.data?.applications ?? []).map((application) => ({
                    id: application.id,
                    name: application.name,
                    detail: titleCase(application.type),
                  }))}
                  selected={applicationIds}
                  title="Application permissions"
                />

                {actionError && (
                  <p
                    className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950"
                    role="alert"
                  >
                    {actionError}
                  </p>
                )}
              </div>

              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card/95 p-6 backdrop-blur">
                {panel === 'edit' ? (
                  <button
                    className="button-secondary gap-2 !border-red-200 !text-red-600 hover:!bg-red-50 dark:!border-red-900 dark:hover:!bg-red-950"
                    disabled={saving}
                    onClick={removeGroup}
                    type="button"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button className="button-secondary" onClick={closePanel} type="button">
                    Cancel
                  </button>
                  <button className="button min-w-[130px] gap-2" disabled={saving} type="submit">
                    {!saving && <Check size={16} />}
                    {saving ? 'Saving...' : panel === 'create' ? 'Create group' : 'Save group'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </Layout>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SelectionList({
  title,
  options,
  selected,
  onChange,
  empty,
}: {
  title: string;
  options: { id: string; name: string; detail: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: string;
}) {
  return (
    <fieldset>
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium">{title}</legend>
        <span className="text-xs text-slate-500">{selected.length} selected</span>
      </div>
      <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
        {options.map((option) => (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-lg p-3 transition hover:bg-muted"
            key={option.id}
          >
            <input
              aria-label={`Select ${option.name}`}
              checked={selected.includes(option.id)}
              className="mt-0.5 h-4 w-4 accent-primary"
              onChange={() => onChange(toggle(selected, option.id))}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-medium">{option.name}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{option.detail}</span>
            </span>
          </label>
        ))}
        {!options.length && <p className="p-3 text-sm text-slate-500">{empty}</p>}
      </div>
    </fieldset>
  );
}

function toggle(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}

function sum(values: number[] | undefined): number {
  return values?.reduce((total, value) => total + value, 0) ?? 0;
}

function previewNames(values: string[]): string {
  return values.length ? values.slice(0, 3).join(', ') : 'None assigned';
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLocaleLowerCase();
}

async function request<T = unknown>(url: string, init?: RequestInit): Promise<T | undefined> {
  const response = await fetch(url, init);
  if (response.status === 204) return undefined;
  const body = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data;
}
