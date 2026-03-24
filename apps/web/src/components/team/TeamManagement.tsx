'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Users, Plus, Trash2, Crown, Shield, User, Mail, X } from 'lucide-react';
import type { Team, TeamMember } from '@apiforge/shared';

interface TeamManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

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
    if (!confirm('Are you sure you want to delete this team?')) return;
    
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
    if (!inviteEmail.trim() || !selectedTeam) return;
    
    try {
      const response = await apiClient.post<Team>(`/api/teams/${selectedTeam._id}/members`, {
        email: inviteEmail,
        role: inviteRole,
      });
      if (response.success && response.data) {
        setSelectedTeam(response.data);
        setTeams(teams.map((t) => t._id === response.data!._id ? response.data! : t));
        setInviteEmail('');
        setShowInviteModal(false);
      }
    } catch (error) {
      console.error('Failed to invite member:', error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam || !confirm('Remove this member from the team?')) return;
    
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Team Management" size="xl">
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
            <Button variant="danger" size="sm" onClick={() => handleDeleteTeam(selectedTeam._id)}>
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
                            onClick={() => handleRemoveMember(member.userId)}
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
                <Button variant="secondary" size="sm" onClick={() => setShowInviteModal(true)}>
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

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Team">
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

      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Team Member">
        <div className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
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
    </Modal>
  );
};
