import {
  Check,
  ChevronRight,
  CircleUserRound,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';
type UserStatus = 'ACTIVE' | 'SUSPENDED';
type Choice = { id: string; name: string; description?: string | null };
type ApplicationChoice = Choice & { type: string };
type AdminUser = {
  id: string;
  organizationRole: OrganizationRole;
  status: UserStatus;
  user: { id: string; name: string; email: string; image: string | null };
  roles: Choice[];
  groups: Choice[];
  applications: ApplicationChoice[];
};
type UsersData = {
  users: AdminUser[];
  roles: Choice[];
  groups: Choice[];
  applications: ApplicationChoice[];
};

const emptySelections = {
  roleIds: [] as string[],
  groupIds: [] as string[],
  applicationIds: [] as string[],
};

export default function AdminUsers() {
  const usersApi = useApi<UsersData>('/api/v1/admin/users');
  const me = useApi<{ id: string }>('/api/v1/me');
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'add' | 'manage' | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [email, setEmail] = useState('');
  const [organizationRole, setOrganizationRole] = useState<OrganizationRole>('MEMBER');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [selections, setSelections] = useState(emptySelections);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const selected = usersApi.data?.users.find((user) => user.id === selectedId);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredUsers = (usersApi.data?.users ?? []).filter((membership) => {
    const searchable = [
      membership.user.name,
      membership.user.email,
      membership.organizationRole,
      membership.status,
      ...membership.roles.map((role) => role.name),
      ...membership.groups.map((group) => group.name),
      ...membership.applications.map((application) => application.name),
    ]
      .join(' ')
      .toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });

  useEffect(() => {
    if (!selected || panel !== 'manage') return;
    setOrganizationRole(selected.organizationRole);
    setStatus(selected.status);
    setSelections({
      roleIds: selected.roles.map((role) => role.id),
      groupIds: selected.groups.map((group) => group.id),
      applicationIds: selected.applications.map((application) => application.id),
    });
  }, [panel, selected]);

  function openAdd() {
    setEmail('');
    setOrganizationRole('MEMBER');
    setStatus('ACTIVE');
    setSelections(emptySelections);
    setActionError('');
    setPanel('add');
  }

  function openManage(user: AdminUser) {
    setSelectedId(user.id);
    setActionError('');
    setPanel('manage');
  }

  function closePanel() {
    if (saving) return;
    setPanel(null);
    setSelectedId('');
    setActionError('');
  }

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      const created = await request<AdminUser>('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, organizationRole, ...selections }),
      });
      usersApi.setData((current) =>
        current && created
          ? { ...current, users: [...current.users, created].sort(compareUsers) }
          : current,
      );
      closePanel();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to add user');
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setActionError('');
    try {
      await request(`/api/v1/admin/users/${selected.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, organizationRole, ...selections }),
      });
      usersApi.setData((current) =>
        current
          ? {
              ...current,
              users: current.users.map((user) =>
                user.id === selected.id
                  ? {
                      ...user,
                      status,
                      organizationRole,
                      roles: selectedChoices(current.roles, selections.roleIds),
                      groups: selectedChoices(current.groups, selections.groupIds),
                      applications: selectedChoices(
                        current.applications,
                        selections.applicationIds,
                      ),
                    }
                  : user,
              ),
            }
          : current,
      );
      closePanel();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update user');
    } finally {
      setSaving(false);
    }
  }

  async function removeUser() {
    if (!selected || !window.confirm(`Remove ${selected.user.name} from this organization?`))
      return;
    setSaving(true);
    setActionError('');
    try {
      await request(`/api/v1/admin/users/${selected.id}`, { method: 'DELETE' });
      usersApi.setData((current) =>
        current
          ? { ...current, users: current.users.filter((user) => user.id !== selected.id) }
          : current,
      );
      closePanel();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to remove user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout admin>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">IDENTITY DIRECTORY</p>
          <h1 className="mt-2 text-3xl font-semibold">People and access</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Control organization standing, RBAC roles, team groups, and direct application access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin-groups" passHref>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className="button-secondary gap-2">
              <UsersRound size={17} /> Manage groups
            </a>
          </Link>
          <button className="button gap-2" onClick={openAdd} type="button">
            <UserPlus size={17} /> Add existing user
          </button>
        </div>
      </header>

      <section className="card mt-8 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Organization members</h2>
            <p className="mt-1 text-sm text-slate-500">
              {usersApi.data?.users.length ?? 0} identities in this workspace
            </p>
          </div>
          <label className="relative block sm:w-80">
            <span className="sr-only">Search users</span>
            <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
            <input
              className="input pl-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people or access..."
              value={query}
            />
          </label>
        </div>

        {usersApi.loading ? (
          <div className="space-y-3 p-6" aria-label="Loading users">
            {[1, 2, 3].map((item) => (
              <div className="h-16 animate-pulse rounded-xl bg-muted" key={item} />
            ))}
          </div>
        ) : usersApi.error ? (
          <p className="p-6 text-sm text-red-600" role="alert">
            {usersApi.error}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Person</th>
                  <th className="px-5 py-3 font-semibold">Standing</th>
                  <th className="px-5 py-3 font-semibold">RBAC roles</th>
                  <th className="px-5 py-3 font-semibold">Groups</th>
                  <th className="px-5 py-3 font-semibold">Direct apps</th>
                  <th className="px-5 py-3 text-right font-semibold">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((membership) => (
                  <tr className="transition hover:bg-muted/40" key={membership.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted font-semibold text-primary">
                          {membership.user.name.charAt(0).toUpperCase() || (
                            <CircleUserRound size={18} />
                          )}
                        </span>
                        <div>
                          <p className="font-medium">{membership.user.name}</p>
                          <p className="text-xs text-slate-500">{membership.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <RoleBadge role={membership.organizationRole} />
                        <span
                          className={`text-xs font-medium ${
                            membership.status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {membership.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      <CompactList values={membership.roles.map((role) => role.name)} />
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      <CompactList values={membership.groups.map((group) => group.name)} />
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      <CompactList values={membership.applications.map((app) => app.name)} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        aria-label={`Manage ${membership.user.name}`}
                        className="button-secondary !min-h-[36px] gap-1 !px-3"
                        onClick={() => openManage(membership)}
                        type="button"
                      >
                        Manage <ChevronRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredUsers.length && (
              <div className="p-12 text-center">
                <CircleUserRound className="mx-auto text-slate-300" size={32} />
                <p className="mt-3 font-medium">No people found</p>
                <p className="mt-1 text-sm text-slate-500">
                  Try a different search or add an account.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 p-0 backdrop-blur-sm sm:p-4">
          <section
            aria-labelledby="user-panel-title"
            aria-modal="true"
            className="h-full w-full overflow-y-auto bg-card shadow-2xl sm:max-w-xl sm:rounded-2xl sm:border sm:border-border"
            role="dialog"
          >
            <form onSubmit={panel === 'add' ? addUser : updateUser}>
              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card/95 p-6 backdrop-blur">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                    {panel === 'add' ? 'Directory enrollment' : 'Access profile'}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold" id="user-panel-title">
                    {panel === 'add' ? 'Add an existing account' : selected?.user.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {panel === 'add'
                      ? 'The email must already have an Authy account.'
                      : selected?.user.email}
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
                {panel === 'add' && (
                  <div>
                    <label className="text-sm font-medium" htmlFor="user-email">
                      Account email
                    </label>
                    <input
                      className="input mt-2"
                      id="user-email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="person@company.com"
                      required
                      type="email"
                      value={email}
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium" htmlFor="organization-role">
                      Organization role
                    </label>
                    <select
                      className="input mt-2"
                      id="organization-role"
                      onChange={(event) =>
                        setOrganizationRole(event.target.value as OrganizationRole)
                      }
                      value={organizationRole}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Administrator</option>
                      <option value="OWNER">Owner</option>
                    </select>
                  </div>
                  {panel === 'manage' && (
                    <div>
                      <label className="text-sm font-medium" htmlFor="account-status">
                        Account standing
                      </label>
                      <select
                        className="input mt-2"
                        id="account-status"
                        onChange={(event) => setStatus(event.target.value as UserStatus)}
                        value={status}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>
                    </div>
                  )}
                </div>

                <CheckboxList
                  empty="No RBAC roles have been created."
                  onChange={(roleIds) => setSelections((value) => ({ ...value, roleIds }))}
                  options={usersApi.data?.roles ?? []}
                  selected={selections.roleIds}
                  title="RBAC roles"
                />
                <CheckboxList
                  empty="No groups have been created."
                  onChange={(groupIds) => setSelections((value) => ({ ...value, groupIds }))}
                  options={usersApi.data?.groups ?? []}
                  selected={selections.groupIds}
                  title="Group membership"
                />
                <CheckboxList
                  empty="No applications are available."
                  onChange={(applicationIds) =>
                    setSelections((value) => ({ ...value, applicationIds }))
                  }
                  options={usersApi.data?.applications ?? []}
                  selected={selections.applicationIds}
                  title="Direct application access"
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
                {panel === 'manage' && selected?.user.id !== me.data?.id ? (
                  <button
                    className="button-secondary gap-2 !border-red-200 !text-red-600 hover:!bg-red-50 dark:!border-red-900 dark:hover:!bg-red-950"
                    disabled={saving}
                    onClick={removeUser}
                    type="button"
                  >
                    <Trash2 size={16} /> Remove
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
                    {saving ? 'Saving...' : panel === 'add' ? 'Add user' : 'Save access'}
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

function RoleBadge({ role }: { role: OrganizationRole }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
      <ShieldCheck size={12} /> {role.charAt(0) + role.slice(1).toLocaleLowerCase()}
    </span>
  );
}

function CompactList({ values }: { values: string[] }) {
  if (!values.length) return <span className="text-slate-400">None</span>;
  return (
    <span title={values.join(', ')}>
      {values.slice(0, 2).join(', ')}
      {values.length > 2 && <span className="text-slate-400"> +{values.length - 2}</span>}
    </span>
  );
}

function CheckboxList({
  title,
  options,
  selected,
  onChange,
  empty,
}: {
  title: string;
  options: Choice[];
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{title}</legend>
      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-lg p-3 transition hover:bg-muted"
              key={option.id}
            >
              <input
                checked={checked}
                className="mt-0.5 h-4 w-4 accent-primary"
                onChange={() => onChange(toggle(selected, option.id))}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-medium">{option.name}</span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
        {!options.length && <p className="p-3 text-sm text-slate-500">{empty}</p>}
      </div>
    </fieldset>
  );
}

function toggle(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}

function selectedChoices<T extends Choice>(choices: T[], ids: string[]): T[] {
  return choices.filter((choice) => ids.includes(choice.id));
}

function compareUsers(left: AdminUser, right: AdminUser): number {
  return left.user.name.localeCompare(right.user.name);
}

async function request<T = unknown>(url: string, init?: RequestInit): Promise<T | undefined> {
  const response = await fetch(url, init);
  if (response.status === 204) return undefined;
  const body = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data;
}
