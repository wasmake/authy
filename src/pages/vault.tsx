import {
  Braces,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileKey2,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Layout } from '@/components/layout';
import { useApi } from '@/hooks/use-api';

type VaultItemType = 'CREDENTIAL' | 'SECRET' | 'ENVIRONMENT';
type Principal = { id: string; name: string };
type VaultAssignment = {
  id: string;
  user: (Principal & { email: string }) | null;
  group: Principal | null;
};
type VaultItem = {
  id: string;
  name: string;
  type: VaultItemType;
  username: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  assignments: VaultAssignment[];
};
type VaultUser = Principal & { email: string; suspended: boolean };
type VaultData = {
  items: VaultItem[];
  isAdmin: boolean;
  users: VaultUser[];
  groups: Principal[];
};
type VaultForm = {
  name: string;
  type: VaultItemType;
  description: string;
  username: string;
  secret: string;
  userIds: string[];
  groupIds: string[];
};

const emptyForm: VaultForm = {
  name: '',
  type: 'CREDENTIAL',
  description: '',
  username: '',
  secret: '',
  userIds: [],
  groupIds: [],
};

const typeDetails = {
  CREDENTIAL: { label: 'Credential', icon: KeyRound, color: 'text-violet-600 bg-violet-500/10' },
  SECRET: { label: 'Secret', icon: FileKey2, color: 'text-amber-600 bg-amber-500/10' },
  ENVIRONMENT: { label: 'Environment', icon: Braces, color: 'text-emerald-600 bg-emerald-500/10' },
} as const;

export default function VaultPage() {
  const vault = useApi<VaultData>('/api/v1/vault');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | VaultItemType>('ALL');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [form, setForm] = useState<VaultForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const revealTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const timers = revealTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const visibleItems = (vault.data?.items ?? []).filter((item) => {
    const search = query.trim().toLowerCase();
    return (
      (filter === 'ALL' || item.type === filter) &&
      (!search ||
        item.name.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        item.username?.toLowerCase().includes(search))
    );
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setActionError('');
    setEditorOpen(true);
  }

  function openEdit(item: VaultItem) {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      description: item.description ?? '',
      username: item.username ?? '',
      secret: '',
      userIds: item.assignments.flatMap((assignment) =>
        assignment.user ? [assignment.user.id] : [],
      ),
      groupIds: item.assignments.flatMap((assignment) =>
        assignment.group ? [assignment.group.id] : [],
      ),
    });
    setActionError('');
    setEditorOpen(true);
  }

  function closeEditor() {
    if (submitting) return;
    setEditorOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setActionError('');
  }

  function toggleAssignment(field: 'userIds' | 'groupIds', id: string) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((value) => value !== id)
        : [...current[field], id],
    }));
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setActionError('');
    try {
      const shared = {
        name: form.name,
        type: form.type,
        description: form.description || null,
        userIds: form.userIds,
        groupIds: form.groupIds,
      };
      const secret = form.secret || undefined;
      const payload =
        form.type === 'CREDENTIAL'
          ? { ...shared, username: form.username, password: secret }
          : form.type === 'SECRET'
            ? { ...shared, value: secret }
            : { ...shared, content: secret };
      const response = await fetch(editing ? `/api/v1/vault/${editing.id}` : '/api/v1/vault', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        data?: VaultItem;
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to save the vault item.');
      }
      vault.setData((current) => {
        if (!current) return current;
        const items = editing
          ? current.items.map((item) => (item.id === body.data?.id ? body.data : item))
          : [...current.items, body.data as VaultItem];
        return {
          ...current,
          items: items.sort((left, right) => left.name.localeCompare(right.name)),
        };
      });
      closeEditor();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save the vault item.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem(item: VaultItem) {
    if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
    setActionError('');
    try {
      const response = await fetch(`/api/v1/vault/${item.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? 'Unable to delete the vault item.');
      }
      hideValue(item.id);
      vault.setData((current) =>
        current ? { ...current, items: current.items.filter(({ id }) => id !== item.id) } : current,
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete the vault item.');
    }
  }

  async function revealValue(item: VaultItem) {
    setRevealingId(item.id);
    setActionError('');
    try {
      const response = await fetch(`/api/v1/vault/${item.id}/reveal`, { method: 'POST' });
      const body = (await response.json()) as {
        data?: { value: string };
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to reveal the protected value.');
      }
      setRevealed((current) => ({ ...current, [item.id]: body.data?.value ?? '' }));
      if (revealTimers.current[item.id]) clearTimeout(revealTimers.current[item.id]);
      revealTimers.current[item.id] = setTimeout(() => hideValue(item.id), 30_000);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to reveal the protected value.',
      );
    } finally {
      setRevealingId('');
    }
  }

  function hideValue(id: string) {
    if (revealTimers.current[id]) clearTimeout(revealTimers.current[id]);
    delete revealTimers.current[id];
    setRevealed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function copyValue(item: VaultItem) {
    const value = revealed[item.id];
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(item.id);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedId(''), 2_000);
    } catch {
      setActionError('Clipboard access was denied by your browser.');
    }
  }

  return (
    <Layout admin={vault.data?.isAdmin}>
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-8 sm:px-9">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.16em] text-primary">
              <ShieldCheck size={17} /> Tenant vault
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Protected access, when you need it
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              Sensitive values stay encrypted at rest and every reveal is recorded in the audit log.
            </p>
          </div>
          {vault.data?.isAdmin && (
            <button className="button shrink-0 gap-2" type="button" onClick={openCreate}>
              <Plus size={17} /> Add vault item
            </button>
          )}
        </div>
      </header>

      <section className="mt-7" aria-labelledby="vault-items-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="vault-items-title" className="text-xl font-semibold">
              Available items
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Values automatically hide again after 30 seconds.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-[240px]">
              <span className="sr-only">Search vault</span>
              <Search className="absolute left-3 top-3 text-slate-400" size={17} />
              <input
                className="input pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search metadata"
              />
            </label>
            <select
              className="input sm:w-44"
              aria-label="Filter by item type"
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
            >
              <option value="ALL">All types</option>
              <option value="CREDENTIAL">Credentials</option>
              <option value="SECRET">Secrets</option>
              <option value="ENVIRONMENT">Environments</option>
            </select>
          </div>
        </div>

        {actionError && !editorOpen && (
          <div
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            role="alert"
          >
            {actionError}
          </div>
        )}

        {vault.loading ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading vault">
            {[1, 2, 3].map((item) => (
              <div className="card h-72 animate-pulse bg-muted" key={item} />
            ))}
          </div>
        ) : vault.error ? (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            role="alert"
          >
            {vault.error}
          </div>
        ) : visibleItems.length ? (
          <div className="mt-6 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <VaultCard
                item={item}
                isAdmin={Boolean(vault.data?.isAdmin)}
                revealedValue={revealed[item.id]}
                revealing={revealingId === item.id}
                copied={copiedId === item.id}
                onReveal={() => revealValue(item)}
                onHide={() => hideValue(item.id)}
                onCopy={() => copyValue(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => deleteItem(item)}
                key={item.id}
              />
            ))}
          </div>
        ) : (
          <div className="card mt-6 border-dashed px-6 py-14 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound size={24} />
            </span>
            <h3 className="mt-4 font-semibold">
              {query || filter !== 'ALL' ? 'No matching vault items' : 'No vault access yet'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {vault.data?.isAdmin
                ? 'Create an encrypted item and assign it directly to people or groups.'
                : 'An administrator can grant access directly or through one of your groups.'}
            </p>
            {vault.data?.isAdmin && !query && filter === 'ALL' && (
              <button className="button-secondary mt-5 gap-2" type="button" onClick={openCreate}>
                <Plus size={16} /> Create first item
              </button>
            )}
          </div>
        )}
      </section>

      {editorOpen && vault.data?.isAdmin && (
        <VaultEditor
          editing={editing}
          form={form}
          users={vault.data.users}
          groups={vault.data.groups}
          submitting={submitting}
          error={actionError}
          setForm={setForm}
          toggleAssignment={toggleAssignment}
          onClose={closeEditor}
          onSubmit={saveItem}
        />
      )}
    </Layout>
  );
}

function VaultCard({
  item,
  isAdmin,
  revealedValue,
  revealing,
  copied,
  onReveal,
  onHide,
  onCopy,
  onEdit,
  onDelete,
}: {
  item: VaultItem;
  isAdmin: boolean;
  revealedValue?: string;
  revealing: boolean;
  copied: boolean;
  onReveal: () => void;
  onHide: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const details = typeDetails[item.type];
  const Icon = details.icon;
  return (
    <article className="card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${details.color}`}>
            <Icon size={20} />
          </span>
          <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {details.label}
          </span>
        </div>
        <h3 className="mt-5 text-lg font-semibold">{item.name}</h3>
        <p className="mt-1 min-h-[40px] text-sm leading-5 text-slate-500">
          {item.description || 'No description provided.'}
        </p>
        {item.type === 'CREDENTIAL' && (
          <div className="mt-4 rounded-lg bg-muted/70 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Username
            </p>
            <p className="mt-0.5 truncate font-mono text-sm">{item.username}</p>
          </div>
        )}
        {isAdmin && item.assignments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Assignments">
            {item.assignments.slice(0, 3).map((assignment) => (
              <span
                className="rounded-md bg-muted px-2 py-1 text-xs text-slate-500"
                key={assignment.id}
              >
                {assignment.user?.name ?? assignment.group?.name}
              </span>
            ))}
            {item.assignments.length > 3 && (
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-slate-500">
                +{item.assignments.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-border bg-background p-3">
          {revealedValue !== undefined ? (
            <pre
              className="max-h-32 min-h-[24px] overflow-auto whitespace-pre-wrap break-all font-mono text-sm"
              aria-live="polite"
            >
              {revealedValue}
            </pre>
          ) : (
            <div className="flex h-6 items-center gap-1.5" aria-label="Protected value hidden">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((dot) => (
                <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" key={dot} />
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            {revealedValue !== undefined ? (
              <>
                <button
                  className="button-secondary flex-1 gap-2 !min-h-[36px] !px-3"
                  type="button"
                  onClick={onHide}
                >
                  <EyeOff size={15} /> Hide
                </button>
                <button
                  className="button-secondary flex-1 gap-2 !min-h-[36px] !px-3"
                  type="button"
                  onClick={onCopy}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </>
            ) : (
              <button
                className="button-secondary w-full gap-2 !min-h-[36px]"
                type="button"
                disabled={revealing}
                onClick={onReveal}
              >
                <Eye size={15} /> {revealing ? 'Decrypting...' : 'Reveal value'}
              </button>
            )}
          </div>
        </div>
      </div>
      {isAdmin && (
        <div className="flex border-t border-border bg-muted/30">
          <button
            className="flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-muted hover:text-foreground"
            type="button"
            onClick={onEdit}
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 border-l border-border px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-500/10"
            type="button"
            onClick={onDelete}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </article>
  );
}

function VaultEditor({
  editing,
  form,
  users,
  groups,
  submitting,
  error,
  setForm,
  toggleAssignment,
  onClose,
  onSubmit,
}: {
  editing: VaultItem | null;
  form: VaultForm;
  users: VaultUser[];
  groups: Principal[];
  submitting: boolean;
  error: string;
  setForm: (value: VaultForm | ((current: VaultForm) => VaultForm)) => void;
  toggleAssignment: (field: 'userIds' | 'groupIds', id: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const secretLabel =
    form.type === 'CREDENTIAL'
      ? 'Password'
      : form.type === 'SECRET'
        ? 'Secret value'
        : 'Environment content';
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="h-full w-full max-w-2xl overflow-y-auto bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-editor-title"
      >
        <form onSubmit={onSubmit}>
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card/95 px-5 py-5 backdrop-blur sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
                {editing ? 'Manage vault item' : 'Encrypted storage'}
              </p>
              <h2 id="vault-editor-title" className="mt-1 text-2xl font-semibold">
                {editing ? `Edit ${editing.name}` : 'Add a vault item'}
              </h2>
            </div>
            <button
              className="button-secondary !min-h-[38px] !px-2.5"
              type="button"
              aria-label="Close editor"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </header>

          <div className="space-y-8 px-5 py-7 sm:px-8">
            {error && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                role="alert"
              >
                {error}
              </div>
            )}
            <fieldset>
              <legend className="font-semibold">Item details</legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Name</span>
                  <input
                    className="input"
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium">Type</span>
                  <select
                    className="input"
                    value={form.type}
                    disabled={Boolean(editing)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as VaultItemType,
                        username: '',
                        secret: '',
                      }))
                    }
                  >
                    <option value="CREDENTIAL">Credential</option>
                    <option value="SECRET">Secret</option>
                    <option value="ENVIRONMENT">Environment</option>
                  </select>
                </label>
                {form.type === 'CREDENTIAL' && (
                  <label>
                    <span className="mb-1.5 block text-sm font-medium">Username</span>
                    <input
                      className="input"
                      required
                      maxLength={320}
                      autoComplete="off"
                      value={form.username}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, username: event.target.value }))
                      }
                    />
                  </label>
                )}
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Description</span>
                  <textarea
                    className="input min-h-[86px] py-3"
                    maxLength={500}
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={17} className="text-primary" /> Protected value
              </legend>
              <p className="mt-1 text-sm text-slate-500">
                {editing
                  ? 'Leave this empty to keep the currently encrypted value.'
                  : 'This value is encrypted before it is stored.'}
              </p>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium">{secretLabel}</span>
                {form.type === 'ENVIRONMENT' ? (
                  <textarea
                    className="input min-h-[150px] py-3 font-mono"
                    required={!editing}
                    spellCheck={false}
                    value={form.secret}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, secret: event.target.value }))
                    }
                    placeholder="API_URL=https://example.com"
                  />
                ) : (
                  <input
                    className="input font-mono"
                    type={form.type === 'CREDENTIAL' ? 'password' : 'text'}
                    required={!editing}
                    autoComplete="new-password"
                    value={form.secret}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, secret: event.target.value }))
                    }
                  />
                )}
              </label>
            </fieldset>

            <fieldset>
              <legend className="flex items-center gap-2 font-semibold">
                <UsersRound size={17} className="text-primary" /> Assign access
              </legend>
              <p className="mt-1 text-sm text-slate-500">
                People receive access directly or through a selected group.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AssignmentList
                  title="People"
                  empty="No organization members"
                  items={users.map((user) => ({
                    id: user.id,
                    name: user.name,
                    detail: `${user.email}${user.suspended ? ' · Suspended' : ''}`,
                    disabled: user.suspended,
                  }))}
                  selected={form.userIds}
                  onToggle={(id) => toggleAssignment('userIds', id)}
                />
                <AssignmentList
                  title="Groups"
                  empty="No groups available"
                  items={groups.map((group) => ({ id: group.id, name: group.name }))}
                  selected={form.groupIds}
                  onToggle={(id) => toggleAssignment('groupIds', id)}
                />
              </div>
            </fieldset>
          </div>

          <footer className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-8">
            <button
              className="button-secondary"
              type="button"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button min-w-[140px]" type="submit" disabled={submitting}>
              {submitting ? 'Encrypting...' : editing ? 'Save changes' : 'Create item'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function AssignmentList({
  title,
  empty,
  items,
  selected,
  onToggle,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; name: string; detail?: string; disabled?: boolean }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border">
      <p className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <div className="max-h-56 overflow-y-auto p-2">
        {items.length ? (
          items.map((item) => (
            <label
              className={`flex items-start gap-3 rounded-lg p-2.5 ${item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted'}`}
              key={item.id}
            >
              <input
                className="mt-0.5 h-4 w-4 accent-primary"
                type="checkbox"
                disabled={item.disabled}
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                {item.detail && (
                  <span className="block truncate text-xs text-slate-500">{item.detail}</span>
                )}
              </span>
            </label>
          ))
        ) : (
          <p className="px-2 py-5 text-center text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </div>
  );
}
