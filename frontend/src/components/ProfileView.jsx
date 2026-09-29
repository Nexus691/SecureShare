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
    <div className="profile-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Profile</h2>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--on-surface-variant)',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background 0.15s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-container-low)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
        >
          ×
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="displayName">Display Name</label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={80}
          />
        </div>
        <div className="form-group">
          <label>Profile Photo</label>
          <div className="photo-container">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="profile-photo"
              />
            ) : (
              <div className="photo-placeholder">No photo</div>
            )}
            <button
              type="button"
              onClick={triggerFileInput}
              className="upload-button"
            >
              {photoUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>
        </div>
        <button type="submit" disabled={isLoading} className="submit-button">
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default ProfileView;