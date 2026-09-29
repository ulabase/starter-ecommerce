import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@ulabase/kit-react';
import { Alert } from '../../ui/alert/Alert';
import './Profile.css';

export default function Profile() {
  const auth = useAuth();

  // Profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileDirty, setProfileDirty] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    auth.checkSession().then(user => {
      if (user) {
        setFirstName(user.profile?.name ?? '');
        setLastName(user.profile?.surname ?? '');
      }
      setProfileLoading(false);
    });
  }, [auth.checkSession]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (profileLoading || !firstName || !lastName) return;

    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await auth.updateProfile({ firstName, lastName });
      setProfileSaving(false);
      setProfileSaved(true);
      setProfileDirty(false);
    } catch (err: unknown) {
      setProfileSaving(false);
      const e = err as { message?: string };
      setProfileError(e?.message ?? 'Something went wrong. Please try again.');
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) return;

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await auth.changePassword(currentPassword, newPassword);
      setPasswordSaving(false);
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      setPasswordSaving(false);
      const e = err as { message?: string };
      setPasswordError(e?.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <>
      <section className="card">
        <h2>Profile</h2>

        {profileSaved && (
          <Alert type="success" onClose={() => setProfileSaved(false)}>Profile updated!</Alert>
        )}
        {profileError && (
          <Alert type="error" onClose={() => setProfileError(null)}>{profileError}</Alert>
        )}

        <form onSubmit={saveProfile} noValidate className="account-form">
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="first-name">First name</label>
              <input
                id="first-name"
                type="text"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setProfileDirty(true); setProfileSaved(false); }}
                disabled={profileLoading}
              />
            </div>
            <div className="form-field">
              <label htmlFor="last-name">Last name</label>
              <input
                id="last-name"
                type="text"
                value={lastName}
                onChange={e => { setLastName(e.target.value); setProfileDirty(true); setProfileSaved(false); }}
                disabled={profileLoading}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={auth.user?._id ?? ''} disabled />
          </div>
          <button type="submit" className="btn-primary" disabled={profileLoading || !profileDirty || profileSaving}>
            {profileSaving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Change password</h2>

        {passwordSaved && (
          <Alert type="success" onClose={() => setPasswordSaved(false)}>Password changed!</Alert>
        )}
        {passwordError && (
          <Alert type="error" onClose={() => setPasswordError(null)}>{passwordError}</Alert>
        )}

        <form onSubmit={changePassword} noValidate className="account-form">
          <div className="form-field">
            <label htmlFor="current-password">Current password</label>
            <div className="password-field">
              <input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setPasswordSaved(false); }}
                autoComplete="new-password"
              />
              <button type="button" className="btn-toggle-password" onClick={() => setShowCurrentPassword(v => !v)}>
                {showCurrentPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="new-password">New password</label>
            <div className="password-field">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordSaved(false); }}
                autoComplete="new-password"
              />
              <button type="button" className="btn-toggle-password" onClick={() => setShowNewPassword(v => !v)}>
                {showNewPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={!newPassword || newPassword.length < 8 || passwordSaving}>
            {passwordSaving ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </section>
    </>
  );
}
