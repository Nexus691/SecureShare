import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function FriendsView() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [friendsRes, reqRes] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      setFriends(friendsRes.friends || []);
      setRequests(reqRes || { incoming: [], outgoing: [] });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sendRequest = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    try {
      setError(null);
      setSuccessMsg(null);
      await api.sendFriendRequest(emailInput.trim());
      setSuccessMsg(`Friend request sent to ${emailInput}`);
      setEmailInput('');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await api.acceptFriendRequest(requestId);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDecline = async (requestId) => {
    try {
      await api.declineFriendRequest(requestId);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      await api.removeFriend(friendId);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="text-center p-8 text-gray-500">Loading friends...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      {/* Add Friend Form */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Friend</h3>
        <form onSubmit={sendRequest} className="flex gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Friend's email address"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            required
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Send Request
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {successMsg && <p className="mt-3 text-sm text-green-600">{successMsg}</p>}
      </section>

      {/* Pending Requests */}
      {requests.incoming.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            Incoming Requests
            <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-xs">{requests.incoming.length}</span>
          </h3>
          <div className="space-y-3">
            {requests.incoming.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div>
                  <div className="font-medium text-gray-900">{req.from.displayName}</div>
                  <div className="text-sm text-gray-500">{req.from.email}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req.id)}
                    className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(req.id)}
                    className="px-4 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends List */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Friends</h3>
        {friends.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-500">You don't have any friends added yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold shadow-inner">
                    {friend.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{friend.displayName}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[150px]" title={friend.email}>{friend.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFriend(friend.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Remove friend"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}