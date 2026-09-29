import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { updateProfile } from '../lib/api';

const ProfileView = () => {
  const { user, setUser } = useContext(AuthContext);
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
      const updatedUser = await updateProfile({ displayName, photoUrl });
      setUser(updatedUser);
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // In a real app, you would upload the file to a storage service
      // and get a URL back. For this example, we'll just use a placeholder.
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="profile-view">
      <h2>Profile</h2>
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