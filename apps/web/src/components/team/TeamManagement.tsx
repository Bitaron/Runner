'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Users, Plus, Trash2, Crown, Shield, User, Mail, X } from 'lucide-react';
import { isAxiosError } from 'axios';
import type { Team, TeamMember } from '@apiforge/shared';

interface TeamManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

type PendingConfirm =
  | { type: 'delete-team'; teamId: string }
  | { type: 'remove-member'; userId: string };

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, message, confirmLabel, onConfirm, onCancel }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm bg-[#262627] border border-[#3d3d3d] rounded-lg shadow-xl p-5"
      >
        <h3 className="text-base font-semibold text-gray-200">{title}</h3>
        <p className="mt-2 text-sm text-gray-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1e1e1e] bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TeamManagement: React.FC<TeamManagementProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTeams();
    }
  }, [isOpen]);

  const loadTeams = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<Team[]>('/api/teams');
      if (response.success && response.data) {
        setTeams(response.data);
        if (response.data.length > 0 && !selectedTeam) {
          setSelectedTeam(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    
    try {
      const response = await apiClient.post<Team>('/api/teams', { name: newTeamName });
      if (response.success && response.data) {
        setTeams([...teams, response.data]);
        setSelectedTeam(response.data);
        setNewTeamName('');
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Failed to create team:', error);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await apiClient.delete(`/api/teams/${teamId}`);
      const newTeams = teams.filter((t) => t._id !== teamId);
      setTeams(newTeams);
      if (selectedTeam?._id === teamId) {
        setSelectedTeam(newTeams[0] || null);
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
    }
  };

  const handleInviteMember = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !selectedTeam) return;

    if (selectedTeam.members.some((m) => m.email.toLowerCase() === email)) {
      setInviteError('This user is already a member of the team');
      return;
    }

    try {
      const response = await apiClient.post<Team>(`/api/teams/${selectedTeam._id}/members`, {
        email,
        role: inviteRole,
      });
      if (response.success && response.data) {
        setSelectedTeam(response.data);
        setTeams(teams.map((t) => t._id === response.data!._id ? response.data! : t));
        setInviteEmail('');
        setInviteError(null);
        setShowInviteModal(false);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        setInviteError(error.response?.data?.error || 'Failed to invite member');
      } else {
        setInviteError('Failed to invite member');
      }
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return;

    try {
      const response = await apiClient.delete<Team>(`/api/teams/${selectedTeam._id}/members/${userId}`);
      if (response.success && response.data) {
        setSelectedTeam(response.data);
        setTeams(teams.map((t) => t._id === response.data!._id ? response.data! : t));
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'member') => {
    if (!selectedTeam) return;
    
    try {
      const response = await apiClient.patch<Team>(`/api/teams/${selectedTeam._id}/members/${userId}`, { role });
      if (response.success && response.data) {
        setSelectedTeam(response.data);
        setTeams(teams.map((t) => t._id === response.data!._id ? response.data! : t));
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const isOwner = selectedTeam?.ownerId === user?._id;
  const isMember = selectedTeam?.members.some((m) => m.userId === user?._id);

  const closeAll = () => {
    setShowCreateModal(false);
    setShowInviteModal(false);
    setPendingConfirm(null);
    onClose();
  };

  const handleConfirmPending = () => {
    const pending = pendingConfirm;
    setPendingConfirm(null);
    if (!pending) return;
    if (pending.type === 'delete-team') {
      void handleDeleteTeam(pending.teamId);
    } else {
      void handleRemoveMember(pending.userId);
    }
  };

  const memberToRemove =
    pendingConfirm?.type === 'remove-member'
      ? selectedTeam?.members.find((m) => m.userId === pendingConfirm.userId)
      : null;

  return (
    <>
      <Modal
        isOpen={isOpen && !showCreateModal && !showInviteModal}
        onClose={() => {
          if (!pendingConfirm) closeAll();
        }}
        title="Team Management"
        size="xl"
      >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select
              value={selectedTeam?._id || ''}
              onChange={(e) => {
                const team = teams.find((t) => t._id === e.target.value);
                setSelectedTeam(team || null);
              }}
              options={teams.map((t) => ({ value: t._id, label: t.name }))}
              className="w-48"
            />
            <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Team
            </Button>
          </div>
          
          {selectedTeam && isOwner && (
            <Button variant="danger" size="sm" onClick={() => setPendingConfirm({ type: 'delete-team', teamId: selectedTeam._id })}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Team
            </Button>
          )}
        </div>

        {selectedTeam ? (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members ({selectedTeam.members.length})
              </h3>
              
              <div className="space-y-2">
                {selectedTeam.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 bg-[#2d2d2d] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#3d3d3d] rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">{member.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {member.role === 'owner' ? (
                        <span className="flex items-center gap-1 text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                          <Crown className="w-3 h-3" />
                          Owner
                        </span>
                      ) : isOwner ? (
                        <>
                          <Select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.userId, e.target.value as 'admin' | 'member')}
                            options={[
                              { value: 'admin', label: 'Admin' },
                              { value: 'member', label: 'Member' },
                            ]}
                            className="w-24 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingConfirm({ type: 'remove-member', userId: member.userId })}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-500/10 px-2 py-1 rounded">
                          <Shield className="w-3 h-3" />
                          {member.role === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {(isOwner || selectedTeam.members.find((m) => m.userId === user?._id && m.role === 'admin')) && (
                <Button variant="secondary" size="sm" onClick={() => { setInviteError(null); setShowInviteModal(true); }}>
                  <Plus className="w-4 h-4 mr-1" />
                  Invite Member
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Team Settings</h3>
              <div className="p-4 bg-[#2d2d2d] rounded-lg space-y-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase">Team Name</label>
                  <p className="text-gray-200">{selectedTeam.name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Created</label>
                  <p className="text-gray-200">{new Date(selectedTeam.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Your Role</label>
                  <p className="text-gray-200 capitalize">{isOwner ? 'Owner' : 'Member'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No teams yet</p>
            <Button variant="primary" className="mt-4" onClick={() => setShowCreateModal(true)}>
              Create Your First Team
            </Button>
          </div>
        )}
      </div>
      </Modal>

      <Modal isOpen={isOpen && showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Team">
        <div className="space-y-4">
          <Input
            label="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Engineering Team"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isOpen && showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Team Member">
        <div className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value);
              setInviteError(null);
            }}
            placeholder="colleague@example.com"
            error={inviteError || undefined}
            autoFocus
          />
          <Select
            label="Role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
            options={[
              { value: 'member', label: 'Member - Can view and edit team resources' },
              { value: 'admin', label: 'Admin - Can manage members and settings' },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button onClick={handleInviteMember} disabled={!inviteEmail.trim()}>Send Invite</Button>
          </div>
        </div>
      </Modal>

      {pendingConfirm?.type === 'delete-team' && selectedTeam && (
        <ConfirmDialog
          title="Delete Team"
          message={`Are you sure you want to delete "${selectedTeam.name}"? All members will lose access. This cannot be undone.`}
          confirmLabel="Delete Team"
          onConfirm={handleConfirmPending}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {pendingConfirm?.type === 'remove-member' && memberToRemove && selectedTeam && (
        <ConfirmDialog
          title="Remove Member"
          message={`Are you sure you want to remove ${memberToRemove.name} (${memberToRemove.email}) from "${selectedTeam.name}"?`}
          confirmLabel="Remove Member"
          onConfirm={handleConfirmPending}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </>
  );
};
