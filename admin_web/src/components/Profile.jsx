import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Camera, Mail, Edit3, Lock,
  Slash, ShieldCheck, Smartphone, Laptop,
  History, LogOut, Check, X, KeyRound
} from "lucide-react";

// Basket/terminal icon matching exact mockup style
const BasketActionIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const Profile = ({ onBack, currentUser, onUpdateUser }) => {
  // Form State
  const [profile, setProfile] = useState({
    username: currentUser?.full_name || currentUser?.username || "miraelys",
    email: currentUser?.email || "mira@gmail.com",
    phone: "+60 12-345 6789",
    dob: "15 May 1998",
    address: "No. 12, Jalan Eco Majestic 1/1, Semenyih, Selangor",
    userId: currentUser?.id ? `ADM${currentUser.id.toString().padStart(2, '0')}` : "ADM01",
    role: (currentUser?.roles && currentUser.roles.length > 0) ? currentUser.roles[0] : "Super Admin",
    joinedDate: "13 July 2026",
    lastLogin: currentUser?.last_login_at ? new Date(currentUser.last_login_at).toLocaleString() : "19 Aug 2026 – 8:30 AM"
  });

  const [formData, setFormData] = useState({ ...profile });
  
  useEffect(() => {
    if (currentUser) {
      const newProfile = {
        username: currentUser.full_name || currentUser.username,
        email: currentUser.email || "",
        phone: "+60 12-345 6789",
        dob: "15 May 1998",
        address: "No. 12, Jalan Eco Majestic 1/1, Semenyih, Selangor",
        userId: `ADM${currentUser.id.toString().padStart(2, '0')}`,
        role: (currentUser.roles && currentUser.roles.length > 0) ? currentUser.roles[0] : "Super Admin",
        joinedDate: "13 July 2026",
        lastLogin: currentUser.last_login_at ? new Date(currentUser.last_login_at).toLocaleString() : "Never"
      };
      setProfile(newProfile);
      setFormData(newProfile);
      if (currentUser.avatarUrl) {
        setAvatarUrl(currentUser.avatarUrl);
      }
    }
  }, [currentUser]);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      if (onUpdateUser) {
        onUpdateUser({ avatarUrl: url });
      }
    }
  };

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [passwordMsg, setPasswordMsg] = useState("");

  const [activeModal, setActiveModal] = useState(null); // 'sessions' | 'devices' | 'history'

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e?.preventDefault();
    setProfile({ ...formData });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCancel = () => {
    setFormData({ ...profile });
    setIsEditing(false);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordMsg("New passwords do not match!");
      return;
    }
    setPasswordMsg("Password changed successfully!");
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordForm({ current: "", newPass: "", confirm: "" });
      setPasswordMsg("");
    }, 1500);
  };

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft size={22} strokeWidth={2.5} />
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          </div>
          <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
            Manage your personal information and account settings.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-lg animate-in fade-in">
            <Check size={16} /> Profile updated successfully!
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left Column: Profile Card */}
        <div className="w-full lg:w-84 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between shrink-0 h-fit space-y-6">
          {/* Avatar and Basic info */}
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-3">
              <div className="w-24 h-24 rounded-full bg-[#1F3A34] flex items-center justify-center text-white text-3xl font-bold shadow-sm overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (profile.username.charAt(0) || 'A').toUpperCase()
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handlePhotoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-700 hover:text-black hover:bg-gray-50 flex items-center justify-center shadow-md transition-all cursor-pointer"
                title="Change Photo"
              >
                <Camera size={15} />
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-900">{profile.username}</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{profile.role}</p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600 font-medium mt-1">
              <Mail size={13} className="text-gray-400" />
              <span>{profile.email}</span>
            </div>
          </div>

          {/* Details list */}
          <div className="border-t border-gray-100 pt-5 space-y-3.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">User ID</span>
              <span className="font-bold text-gray-900">{profile.userId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Role</span>
              <span className="font-bold text-gray-900">{profile.role}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Joined Date</span>
              <span className="font-bold text-gray-900">{profile.joinedDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Last Login</span>
              <span className="font-bold text-gray-900">{profile.lastLogin}</span>
            </div>
          </div>

          {/* Change Password Button */}
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full py-2.5 px-4 border border-gray-800 rounded-xl text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound size={15} /> Change Password
            </button>
          </div>
        </div>

        {/* Right Column: Form Card + Account & Activity Card */}
        <div className="flex-1 flex flex-col min-w-0 space-y-6">
          {/* Top Form Card: Personal Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-800 rounded-lg text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Edit3 size={14} /> {isEditing ? "Editing Mode" : "Edit Profile"}
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">Username</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-800 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E5E58] disabled:bg-gray-50/60 disabled:border-gray-300 disabled:text-gray-700 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">Email address</label>
                <input
                  type="email"
                  disabled={!isEditing}
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-800 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E5E58] disabled:bg-gray-50/60 disabled:border-gray-300 disabled:text-gray-700 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  disabled={!isEditing}
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-800 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E5E58] disabled:bg-gray-50/60 disabled:border-gray-300 disabled:text-gray-700 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">Date of Birth</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.dob}
                  onChange={(e) => handleInputChange("dob", e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-800 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E5E58] disabled:bg-gray-50/60 disabled:border-gray-300 disabled:text-gray-700 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">Address</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-800 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E5E58] disabled:bg-gray-50/60 disabled:border-gray-300 disabled:text-gray-700 transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={!isEditing}
                  className="flex-1 py-2.5 border border-gray-800 rounded-xl text-xs font-bold text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Slash size={14} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isEditing}
                  className="flex-1 py-2.5 border border-gray-800 rounded-xl text-xs font-bold text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit3 size={14} /> Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Bottom Card: Account and Activity */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h3 className="text-base font-bold text-gray-900 mb-4">Account and Activity</h3>

            <div className="divide-y divide-gray-100">
              {/* Row 1: Login Sessions */}
              <div className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#1F3A34] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <BasketActionIcon size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Login Sessions</p>
                    <p className="text-[11px] text-gray-500">View and manage your login sessions.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal("sessions")}
                  className="border border-gray-800 rounded-lg px-4 py-1.5 text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  View Sessions &gt;
                </button>
              </div>

              {/* Row 2: Device Management */}
              <div className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#1F3A34] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <BasketActionIcon size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Device Management</p>
                    <p className="text-[11px] text-gray-500">Manage devices that have access to your account.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal("devices")}
                  className="border border-gray-800 rounded-lg px-4 py-1.5 text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Manage Devices &gt;
                </button>
              </div>

              {/* Row 3: Login History */}
              <div className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#1F3A34] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <BasketActionIcon size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Login History</p>
                    <p className="text-[11px] text-gray-500">View your recent login history.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal("history")}
                  className="border border-gray-800 rounded-lg px-4 py-1.5 text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  View History &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <KeyRound size={18} className="text-[#2E5E58]" /> Change Password
              </h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {passwordMsg && (
              <div className={`p-2.5 rounded-lg text-xs font-bold mb-4 ${passwordMsg.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {passwordMsg}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-900 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-900 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPass}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                  placeholder="Enter new password (min. 8 characters)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-900 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#2E5E58] text-white rounded-lg font-bold hover:bg-[#1F3A34] transition-colors cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Sessions Modal */}
      {activeModal === "sessions" && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900">Active Login Sessions</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Laptop size={20} className="text-[#2E5E58]" />
                  <div>
                    <p className="font-bold text-gray-900">Windows PC – Chrome 124 (Current)</p>
                    <p className="text-gray-500">Kuala Lumpur, MY</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-800">Active Now</span>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Smartphone size={20} className="text-gray-500" />
                  <div>
                    <p className="font-bold text-gray-900">iPhone 15 Pro – Safari</p>
                    <p className="text-gray-500">Semenyih, MY</p>
                  </div>
                </div>
                <button
                  onClick={() => alert("Revoked session on iPhone 15 Pro")}
                  className="text-red-600 font-bold hover:underline cursor-pointer"
                >
                  Revoke
                </button>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Management Modal */}
      {activeModal === "devices" && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900">Trusted Devices</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">Admin Desktop (Semenyih HQ)</p>
                  <p className="text-gray-500">Added on 13 July 2026</p>
                </div>
                <span className="text-xs font-bold text-green-700">Verified</span>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">Branch POS Terminal #1</p>
                  <p className="text-gray-500">Added on 20 July 2026</p>
                </div>
                <span className="text-xs font-bold text-green-700">Verified</span>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login History Modal */}
      {activeModal === "history" && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900">Recent Login History</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="divide-y divide-gray-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <div>
                  <p className="font-bold text-gray-900">Successful Login</p>
                  <p className="text-gray-500">19 Aug 2026 – 8:30 AM</p>
                </div>
                <span className="text-green-700 font-bold">Success</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <div>
                  <p className="font-bold text-gray-900">Successful Login</p>
                  <p className="text-gray-500">19 Aug 2026 – 9:02 AM</p>
                </div>
                <span className="text-green-700 font-bold">Success</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <div>
                  <p className="font-bold text-gray-900">Successful Login</p>
                  <p className="text-gray-500">19 Aug 2026 – 8:45 AM</p>
                </div>
                <span className="text-green-700 font-bold">Success</span>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
