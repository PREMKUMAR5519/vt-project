import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Common/Avatar';
import Button from '../components/Common/Button';
import Modal from '../components/Common/Modal';
import {
  getFriends, getPendingRequests, respondFriendRequest,
  getBlockedUsers, unblockUser,
} from '../services/supabase';
import { INTERESTS_LIST, getAvatarUrl } from '../utils/helpers';
import './ProfilePage.scss';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [editName, setEditName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    if (user.is_guest) return;
    loadFriends();
    loadBlocked();
  }, [user, navigate]);

  async function loadFriends() {
    const friendsList = await getFriends(user.id);
    setFriends(friendsList);
    const pending = await getPendingRequests(user.id);
    setPendingRequests(pending);
  }

  async function loadBlocked() {
    const blocked = await getBlockedUsers(user.id);
    setBlockedUsers(blocked);
  }

  function toggleInterest(interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  async function handleAcceptFriend(id) {
    await respondFriendRequest(id, 'accepted');
    loadFriends();
  }

  async function handleRejectFriend(id) {
    await respondFriendRequest(id, 'rejected');
    loadFriends();
  }

  async function handleUnblock(blockedId) {
    await unblockUser(user.id, blockedId);
    loadBlocked();
  }

  function handleSaveName() {
    if (editName.trim()) {
      updateUser({ name: editName.trim() });
    }
    setShowEditModal(false);
  }

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="profile-page__content">
        {/* Profile Card */}
        <div className="profile-page__card">
          <div className="profile-page__avatar-section">
            <Avatar src={user.avatar_url} name={user.name} size="xl" />
            <div className="profile-page__user-info">
              <h2>{user.name}</h2>
              {user.email && <p className="profile-page__email">{user.email}</p>}
              {user.is_guest && <span className="profile-page__badge">Guest</span>}
              <Button variant="ghost" size="sm" onClick={() => { setEditName(user.name); setShowEditModal(true); }}>
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="profile-page__tabs">
          {[
            { id: 'profile', label: 'Interests' },
            { id: 'friends', label: `Friends (${friends.length})` },
            { id: 'requests', label: `Requests (${pendingRequests.length})` },
            { id: 'blocked', label: 'Blocked' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`profile-page__tab ${activeTab === tab.id ? 'profile-page__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="profile-page__tab-content">
          {activeTab === 'profile' && (
            <div className="profile-page__interests fade-in">
              <h3>Your Interests</h3>
              <p>Select interests to find better matches</p>
              <div className="profile-page__interests-grid">
                {INTERESTS_LIST.map((interest) => (
                  <button
                    key={interest}
                    className={`profile-page__interest-tag ${
                      selectedInterests.includes(interest) ? 'profile-page__interest-tag--active' : ''
                    }`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
              <Button onClick={() => {}}>Save Interests</Button>
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="profile-page__friends fade-in">
              {user.is_guest ? (
                <p className="profile-page__empty">Sign in to add friends</p>
              ) : friends.length === 0 ? (
                <p className="profile-page__empty">No friends yet. Start chatting to make connections!</p>
              ) : (
                <div className="profile-page__list">
                  {friends.map((f) => {
                    const friendUser = f.user_id === user.id ? f.friend : f.user;
                    return (
                      <div key={f.id} className="profile-page__list-item">
                        <Avatar src={friendUser?.avatar_url} name={friendUser?.name} size="md" />
                        <div className="profile-page__list-info">
                          <span className="profile-page__list-name">{friendUser?.name}</span>
                          <span className="profile-page__list-sub">Friend</span>
                        </div>
                        <Button variant="ghost" size="sm">Chat</Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="profile-page__requests fade-in">
              {pendingRequests.length === 0 ? (
                <p className="profile-page__empty">No pending requests</p>
              ) : (
                <div className="profile-page__list">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="profile-page__list-item">
                      <Avatar src={req.user?.avatar_url} name={req.user?.name} size="md" />
                      <div className="profile-page__list-info">
                        <span className="profile-page__list-name">{req.user?.name}</span>
                        <span className="profile-page__list-sub">Wants to be friends</span>
                      </div>
                      <div className="profile-page__list-actions">
                        <Button variant="success" size="sm" onClick={() => handleAcceptFriend(req.id)}>Accept</Button>
                        <Button variant="danger" size="sm" onClick={() => handleRejectFriend(req.id)}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'blocked' && (
            <div className="profile-page__blocked fade-in">
              {blockedUsers.length === 0 ? (
                <p className="profile-page__empty">No blocked users</p>
              ) : (
                <div className="profile-page__list">
                  {blockedUsers.map((id) => (
                    <div key={id} className="profile-page__list-item">
                      <Avatar name={id} size="md" />
                      <div className="profile-page__list-info">
                        <span className="profile-page__list-name">User {id.slice(0, 8)}...</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleUnblock(id)}>Unblock</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Profile">
        <div className="profile-page__edit">
          <label>Display Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Your name"
          />
          <Button onClick={handleSaveName}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
