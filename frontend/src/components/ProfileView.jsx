import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const ProfileView = ({ onClose }) => {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const updatedUser = await api.updateProfile({ displayName, photoUrl });
      setUser(updatedUser.user || updatedUser);
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }

    if (file.size > 1024 * 1024) {
      setError('Profile photo must be 1MB or smaller');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError('');
      setPhotoUrl(reader.result);
    };
    reader.onerror = () => setError('Could not read the selected image');
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <section className="profile-view" aria-labelledby="profile-title">
      <div className="profile-heading">
        <div>
          <span className="profile-kicker">Account settings</span>
          <h1 id="profile-title">Your profile</h1>
          <p>Manage how your name and photo appear to your friends.</p>
        </div>
        <button type="button" onClick={onClose} className="profile-close" aria-label="Close profile">×</button>
      </div>

      <div className="profile-card">
        <div className="profile-identity">
          <button type="button" className="profile-photo-button" onClick={triggerFileInput} aria-label="Choose profile photo">
            {photoUrl ? (
              <img src={photoUrl} alt="Profile preview" className="profile-photo" />
            ) : (
              <span className="profile-initial">{(displayName || user?.email || 'U').charAt(0).toUpperCase()}</span>
            )}
            <span className="photo-edit-badge">✎</span>
          </button>
          <div>
            <strong>{displayName || 'SecureShare user'}</strong>
            <span>{user?.email}</span>
            <button type="button" onClick={triggerFileInput} className="upload-button">
              {photoUrl ? 'Change photo' : 'Upload photo'}
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" hidden />
        </div>

        {error && <div className="error" role="alert">{error}</div>}
        {success && <div className="success" role="status">{success}</div>}

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="displayName">Display name</label>
            <input type="text" id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={80} />
            <small>This is the name other SecureShare users will see.</small>
          </div>
          <div className="form-group">
            <label htmlFor="profileEmail">Email address</label>
            <input type="email" id="profileEmail" value={user?.email || ''} readOnly />
            <small>Your sign-in email cannot be changed here.</small>
          </div>
          <div className="profile-actions">
            <button type="button" onClick={onClose} className="profile-cancel">Cancel</button>
            <button type="submit" disabled={isLoading} className="submit-button">
              {isLoading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default ProfileView;
