import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../services/adminService';
import { toast } from 'react-hot-toast';
import {
  HiOutlineSearch,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlinePause,
  HiOutlinePlay,
  HiOutlineTrash,
  HiOutlineShieldCheck,
  HiOutlineUser,
} from 'react-icons/hi';
import { format } from 'date-fns';

const LIMIT = 10;

const Users = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, statusFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-users', page, debouncedSearch, roleFilter, statusFilter],
    queryFn: async () => {
      const res = await adminAPI.getUsers(page, LIMIT, debouncedSearch, roleFilter, statusFilter);
      if (!res.success) throw new Error('Failed to fetch users');
      return res;
    },
    keepPreviousData: true,
    staleTime: 60 * 1000,
  });

  const users = data?.data || [];
  const totalUsers = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / LIMIT));

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, nextStatus }) =>
      nextStatus === 'active' ? adminAPI.unbanUser(userId) : adminAPI.banUser(userId),
    onSuccess: (_res, variables) => {
      toast.success(
        variables.nextStatus === 'active' ? 'User resumed' : 'User paused'
      );
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || 'Failed to update status'),
  });

  const roleChangeMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => adminAPI.updateUserRole(userId, newRole),
    onSuccess: (_res, variables) => {
      toast.success(`Role updated to ${variables.newRole}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || 'Failed to update role'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => adminAPI.deleteUser(userId),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || 'Failed to delete user'),
  });

  const stats = {
    total: totalUsers,
    verified: users.filter((u) => u.isVerified).length,
    paused: users.filter((u) => u.status === 'suspended' || u.status === 'banned').length,
    admins: users.filter((u) => u.role === 'admin').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-white">User Management</h2>
          <p className="text-slate-400 mt-1">
            Manage accounts, roles, and access. Pause or delete accounts, and review email verification.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total users" value={stats.total} tone="indigo" />
        <StatCard label="Verified (page)" value={stats.verified} tone="green" />
        <StatCard label="Paused (page)" value={stats.paused} tone="yellow" />
        <StatCard label="Admins (page)" value={stats.admins} tone="pink" />
      </div>

      <div className="glass p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-indigo-500 transition-all w-full text-white placeholder:text-slate-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-white text-sm min-w-[140px]"
        >
          <option value="" className="bg-bgDark">All roles</option>
          <option value="user" className="bg-bgDark">User</option>
          <option value="admin" className="bg-bgDark">Admin</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-white text-sm min-w-[140px]"
        >
          <option value="" className="bg-bgDark">All status</option>
          <option value="active" className="bg-bgDark">Active</option>
          <option value="suspended" className="bg-bgDark">Paused</option>
          <option value="banned" className="bg-bgDark">Banned</option>
        </select>
      </div>

      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <Th>User</Th>
                <Th>Email verified</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                      <div className="h-4 bg-white/5 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="p-16 text-center text-slate-500">
                      No users found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user._id}
                    user={user}
                    onToggleStatus={(nextStatus) =>
                      toggleStatusMutation.mutate({ userId: user._id, nextStatus })
                    }
                    onRoleChange={(newRole) => {
                      if (newRole === user.role) return;
                      const confirmMsg =
                        newRole === 'admin'
                          ? `Grant ADMIN access to ${user.email || user.displayName}?`
                          : `Remove admin access from ${user.email || user.displayName}?`;
                      if (window.confirm(confirmMsg)) {
                        roleChangeMutation.mutate({ userId: user._id, newRole });
                      }
                    }}
                    onDelete={() => {
                      if (
                        window.confirm(
                          `Delete ${user.email || user.displayName}? This removes them from the database and Firebase Auth. This cannot be undone.`
                        )
                      ) {
                        deleteUserMutation.mutate(user._id);
                      }
                    }}
                    busy={
                      toggleStatusMutation.isLoading ||
                      roleChangeMutation.isLoading ||
                      deleteUserMutation.isLoading
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="text-slate-400">
            Showing{' '}
            <span className="text-white font-bold">
              {users.length > 0 ? (page - 1) * LIMIT + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="text-white font-bold">
              {Math.min(page * LIMIT, totalUsers)}
            </span>{' '}
            of <span className="text-white font-bold">{totalUsers}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1 || isFetching}
              className="p-2 rounded-lg bg-white/5 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <HiOutlineChevronLeft />
            </button>
            <span className="px-4 font-bold text-indigo-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
              disabled={page >= totalPages || isFetching}
              className="p-2 rounded-lg bg-white/5 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <HiOutlineChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Th = ({ children, className = '' }) => (
  <th
    className={`px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest ${className}`}
  >
    {children}
  </th>
);

const StatCard = ({ label, value, tone }) => {
  const tones = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    pink: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  };
  return (
    <div className={`glass p-4 border ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
};

const UserRow = ({ user, onToggleStatus, onRoleChange, onDelete, busy }) => {
  const isPaused = user.status === 'suspended' || user.status === 'banned';
  const isAdmin = user.role === 'admin';

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">
              {user.displayName || 'Unnamed user'}
            </p>
            <p className="text-slate-500 text-xs truncate">{user.email || '—'}</p>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        {user.isVerified ? (
          <span className="inline-flex items-center gap-1.5 text-green-400 text-xs font-bold">
            <HiOutlineCheckCircle className="text-base" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <HiOutlineXCircle className="text-base" />
            Not verified
          </span>
        )}
      </td>

      <td className="px-6 py-4">
        <select
          value={user.role || 'user'}
          onChange={(e) => onRoleChange(e.target.value)}
          disabled={busy}
          className={`bg-transparent outline-none border rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 ${
            isAdmin
              ? 'text-pink-400 border-pink-500/30'
              : 'text-slate-300 border-white/10'
          }`}
        >
          <option value="user" className="bg-bgDark">User</option>
          <option value="admin" className="bg-bgDark">Admin</option>
        </select>
      </td>

      <td className="px-6 py-4">
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
            isPaused
              ? 'bg-yellow-500/10 text-yellow-400'
              : 'bg-green-500/10 text-green-400'
          }`}
        >
          {isPaused ? user.status : 'active'}
        </span>
      </td>

      <td className="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">
        {user.createdAt ? format(new Date(user.createdAt), 'MMM dd, yyyy') : '—'}
      </td>

      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onToggleStatus(isPaused ? 'active' : 'suspended')}
            disabled={busy}
            title={isPaused ? 'Resume user' : 'Pause user'}
            className={`p-2 rounded-lg text-xs font-bold transition-all ${
              isPaused
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isPaused ? <HiOutlinePlay /> : <HiOutlinePause />}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            title="Delete user"
            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <HiOutlineTrash />
          </button>
        </div>
      </td>
    </tr>
  );
};

const Avatar = ({ user }) => {
  const [broken, setBroken] = React.useState(false);
  const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
  const showImage = user.avatar && !broken;

  return showImage ? (
    <img
      src={user.avatar}
      alt=""
      onError={() => setBroken(true)}
      className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 object-cover"
    />
  ) : (
    <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm">
      {user.role === 'admin' ? <HiOutlineShieldCheck /> : initial || <HiOutlineUser />}
    </div>
  );
};

export default Users;
