import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';
import type { TeamMembership, TeamMember, PendingInvitation } from '@ulabase/kit-react';
import { Alert } from '../../../ui/alert/Alert';
import './BillingAccount.css';

const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export default function BillingAccount() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { id: teamId } = useParams<{ id: string }>();

  const [team, setTeam] = useState<TeamMembership | undefined>(undefined);
  const isOwner = team?.role === 'owner';

  // Members
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [memberActionPending, setMemberActionPending] = useState<string | null>(null);
  const [removingMemberEmail, setRemovingMemberEmail] = useState<string | null>(null);

  // Invitations
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [resendSuccessEmail, setResendSuccessEmail] = useState<string | null>(null);
  const resendCooldownsRef = useRef<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'member'>('member');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  // Team settings
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamSaved, setTeamSaved] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamDirty, setTeamDirty] = useState(false);

  // Delete
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!teamId) return;
    auth.loadTeams().then(() => {
      const found = auth.teams.find(t => t.id.$oid === teamId);
      setTeam(found);
      if (found) {
        setTeamName(found.name ?? '');
        setTeamDescription(found.description ?? '');
      }
    });
    setMembersLoading(true);
    auth.listTeamMembers().then(
      m => { setMembers(m); setMembersLoading(false); },
      () => setMembersLoading(false)
    );
    setInvitationsLoading(true);
    auth.listInvitations().then(
      inv => { setInvitations(inv); setInvitationsLoading(false); },
      () => setInvitationsLoading(false)
    );
  }, [teamId, auth.loadTeams, auth.listTeamMembers, auth.listInvitations]);

  const canResend = (email: string): boolean => {
    const since = resendCooldownsRef.current[email];
    if (!since) return true;
    return now - since >= RESEND_COOLDOWN_MS;
  };

  const resendCooldownLeft = (email: string): string => {
    const since = resendCooldownsRef.current[email];
    if (!since) return '';
    const remaining = RESEND_COOLDOWN_MS - (now - since);
    if (remaining <= 0) return '';
    const minutes = Math.ceil(remaining / 60000);
    return `${minutes}m`;
  };

  const sendInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) return;

    setInviteSending(true);
    setInviteError(null);
    try {
      await auth.invite(inviteEmail, inviteRole);
      setInviteSending(false);
      setInviteSent(true);
      setInviteEmail('');
      setInviteRole('member');
    } catch (err: unknown) {
      setInviteSending(false);
      const e = err as { status?: number; message?: string };
      setInviteError(
        e?.status === 409
          ? 'This person can already charge to this billing account.'
          : (e?.message ?? 'Something went wrong. Please try again.')
      );
    }
  };

  const removeMember = async (member: TeamMember) => {
    setMemberActionPending(member.email);
    setRemovingMemberEmail(null);
    try {
      await auth.removeMember(member.email);
      setMembers(list => list.filter(m => m.email !== member.email));
    } catch {
      // ignore
    }
    setMemberActionPending(null);
  };

  const resendInvite = async (invite: PendingInvitation) => {
    setResendingEmail(invite.email);
    setResendSuccessEmail(null);
    try {
      await auth.resendInvite(invite.email);
      const at = Date.now();
      setResendingEmail(null);
      setResendSuccessEmail(invite.email);
      resendCooldownsRef.current = { ...resendCooldownsRef.current, [invite.email]: at };
      setNow(at);
    } catch {
      setResendingEmail(null);
    }
  };

  const changeRole = async (member: TeamMember, role: 'owner' | 'member') => {
    if (member.role === role) return;
    setMemberActionPending(member.email);
    try {
      await auth.updateMemberRole(member.email, role);
      setMembers(list => list.map(m => (m.email === member.email ? { ...m, role } : m)));
    } catch {
      // ignore
    }
    setMemberActionPending(null);
  };

  const saveTeam = async (e: FormEvent) => {
    e.preventDefault();
    if (!team) return;
    setTeamSaving(true);
    setTeamError(null);
    setTeamSaved(false);
    try {
      await auth.updateTeam({ name: teamName, description: teamDescription });
      setTeamSaving(false);
      setTeamSaved(true);
      setTeamDirty(false);
    } catch (err: unknown) {
      setTeamSaving(false);
      const e = err as { message?: string };
      setTeamError(e?.message ?? 'Something went wrong. Please try again.');
    }
  };

  const deleteTeam = async () => {
    if (!team) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await auth.deleteTeam();
      const remaining = await auth.loadTeams();
      if (remaining.length > 0 && !remaining.some(t => t.active)) {
        await auth.switchTeam(remaining[0].id);
      }
      navigate('/billing');
    } catch (err: unknown) {
      setDeleting(false);
      const e = err as { message?: string };
      setDeleteError(e?.message ?? 'Could not delete the billing account.');
    }
  };

  const formatDate = (date: string | undefined): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <>
      <section className="card">
        <Link to="/billing" className="back-link">&larr; Back to billing accounts</Link>
        <h2>{team?.name || team?.id?.$oid}</h2>
        {team?.description && <p className="muted">{team.description}</p>}
      </section>

      <section className="card">
        <h2>Members</h2>
        {membersLoading ? (
          <p className="muted">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="muted">No members yet.</p>
        ) : (
          <ul className="member-list">
            {members.map(member => (
              <li key={member.email} className="member-row">
                <div className="member-info">
                  <span className="member-name">{member.name || member.email}</span>
                  <span className="member-email">{member.email}</span>
                </div>
                {isOwner ? (
                  <div className="member-actions">
                    {member.email !== auth.user?._id ? (
                      <>
                        <select
                          className="role-select"
                          value={member.role}
                          disabled={memberActionPending === member.email}
                          onChange={e => changeRole(member, e.target.value as 'owner' | 'member')}
                        >
                          <option value="member">Member</option>
                          <option value="owner">Owner</option>
                        </select>
                        {removingMemberEmail === member.email ? (
                          <>
                            <span className="muted">Remove?</span>
                            <button type="button" className="btn-danger-text" disabled={memberActionPending === member.email} onClick={() => removeMember(member)}>Yes</button>
                            <button type="button" className="btn-secondary" onClick={() => setRemovingMemberEmail(null)}>No</button>
                          </>
                        ) : (
                          <button type="button" className="btn-danger-text" disabled={memberActionPending === member.email} onClick={() => setRemovingMemberEmail(member.email)}>Remove</button>
                        )}
                      </>
                    ) : (
                      <span className="team-role">{member.role}</span>
                    )}
                  </div>
                ) : (
                  <span className="team-role">{member.role}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <>
          <section className="card">
            <h2>Invite someone to share purchases</h2>
            {inviteSent && (
              <Alert type="success" onClose={() => setInviteSent(false)}>Invitation sent!</Alert>
            )}
            {inviteError && (
              <Alert type="error" onClose={() => setInviteError(null)}>{inviteError}</Alert>
            )}
            <form onSubmit={sendInvite} noValidate className="invite-form">
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="invite-email">Email</label>
                  <input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteSent(false); }}
                    placeholder="colleague@example.com"
                  />
                </div>
                <div className="form-field form-field-sm">
                  <label htmlFor="invite-role">Role</label>
                  <select id="invite-role" value={inviteRole} onChange={e => { setInviteRole(e.target.value as 'owner' | 'member'); setInviteSent(false); }}>
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={inviteSending || !inviteEmail || !inviteEmail.includes('@')}>
                {inviteSending ? 'Sending…' : 'Send invite'}
              </button>
            </form>
          </section>

          {invitationsLoading ? (
            <section className="card">
              <h2>Pending invitations</h2>
              <p className="muted">Loading invitations…</p>
            </section>
          ) : invitations.length > 0 ? (
            <section className="card">
              <h2>Pending invitations</h2>
              {resendSuccessEmail && (
                <Alert type="success" onClose={() => setResendSuccessEmail(null)}>Invitation resent to {resendSuccessEmail}!</Alert>
              )}
              <ul className="member-list">
                {invitations.map(invite => (
                  <li key={invite.email} className={`member-row${invite.expired ? ' expired' : ''}`}>
                    <div className="member-info">
                      <span className="member-name">{invite.email}</span>
                      <span className="member-email">
                        {invite.role}
                        {invite.createdAt && ` \u00B7 invited ${formatDate(invite.createdAt)}`}
                        {invite.expired && ' \u00B7 expired'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={resendingEmail === invite.email || !canResend(invite.email)}
                      onClick={() => resendInvite(invite)}
                    >
                      {resendingEmail === invite.email
                        ? 'Sending…'
                        : !canResend(invite.email)
                          ? `Wait ${resendCooldownLeft(invite.email)}`
                          : 'Resend'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card">
            <h2>Billing account settings</h2>
            {teamSaved && (
              <Alert type="success" onClose={() => setTeamSaved(false)}>Billing account updated!</Alert>
            )}
            {teamError && (
              <Alert type="error" onClose={() => setTeamError(null)}>{teamError}</Alert>
            )}
            <form onSubmit={saveTeam} noValidate className="invite-form">
              <div className="form-field">
                <label htmlFor="team-name">Account name</label>
                <input
                  id="team-name"
                  type="text"
                  value={teamName}
                  onChange={e => { setTeamName(e.target.value); setTeamDirty(true); setTeamSaved(false); }}
                  autoComplete="off"
                />
              </div>
              <div className="form-field">
                <label htmlFor="team-description">Description</label>
                <textarea
                  id="team-description"
                  rows={3}
                  value={teamDescription}
                  onChange={e => { setTeamDescription(e.target.value); setTeamDirty(true); setTeamSaved(false); }}
                  placeholder="Optional"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={teamSaving || !teamDirty}>
                {teamSaving ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            <div className="danger-zone">
              <div className="danger-zone-text">
                <strong>Delete this billing account</strong>
                <p className="muted">Only possible while no other members remain.</p>
              </div>
              {!deleteConfirming ? (
                <button type="button" className="btn-danger" onClick={() => setDeleteConfirming(true)}>Delete account</button>
              ) : (
                <div className="delete-confirm" role="alertdialog" aria-label="Confirm delete team">
                  <span>Are you sure?</span>
                  <button type="button" className="btn-danger" disabled={deleting} onClick={deleteTeam}>
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => { setDeleteConfirming(false); setDeleteError(null); }}>Cancel</button>
                </div>
              )}
              {deleteError && (
                <Alert type="error" onClose={() => setDeleteError(null)}>{deleteError}</Alert>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
