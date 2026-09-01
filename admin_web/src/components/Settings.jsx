import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, Database, ChevronRight, Cloud, Clock, FileText, X } from 'lucide-react';
import { adminRequest } from '../lib/adminApi';

const Settings = ({ setCurrentPage, currentUser }) => {

  // State for Settings
  const [settings, setSettings] = useState({
    systemName: 'C2 Coffee Admin',
    timeZone: '(GMT +08:00) Kuala Lumpur',
    dateFormat: '31 May 2026 (DD MMM YYYY)',
    timeFormat: '12 Hours (10:30 AM)',
    language: 'English (US)',
    twoFactor: 'Enabled'
  });
  const [isLoading, setIsLoading] = useState(false);

  const translations = {
    'English (US)': {
      pageTitle: 'Settings',
      pageDesc: 'Manage system settings and preferences.',
      generalTitle: 'General Settings',
      generalDesc: 'Configure basic system settings.',
      systemName: 'System Name',
      timeZone: 'Time Zone',
      dateFormat: 'Date Format',
      timeFormat: 'Time Format',
      language: 'Language',
      securityTitle: 'Security Settings',
      securityDesc: 'Manage your security preferences.',
      changePassword: 'Change Password',
      twoFactor: 'Two-Factor Authentication (2FA)',
      loginSessions: 'Login Sessions',
      dbTitle: 'Data & Backup',
      dbDesc: 'Manage your data backup and system logs.',
      backupNow: 'Backup Now',
      viewHistory: 'View Backup History',
      systemLogs: 'System Logs',
      footer: '© 2024 C2 Coffee + Candle. All right reserved | Version 1.0.0',
      successSaved: 'Settings saved successfully.',
      successBackup: 'Backup process started. This may take a few minutes...',
      statusEnabled: 'Enabled',
      statusDisabled: 'Disabled'
    },
    'Bahasa Malaysia': {
      pageTitle: 'Tetapan',
      pageDesc: 'Urus tetapan dan pilihan sistem.',
      generalTitle: 'Tetapan Umum',
      generalDesc: 'Konfigurasi tetapan asas sistem.',
      systemName: 'Nama Sistem',
      timeZone: 'Zon Masa',
      dateFormat: 'Format Tarikh',
      timeFormat: 'Format Masa',
      language: 'Bahasa',
      securityTitle: 'Tetapan Keselamatan',
      securityDesc: 'Urus pilihan keselamatan anda.',
      changePassword: 'Tukar Kata Laluan',
      twoFactor: 'Pengesahan Dua Faktor (2FA)',
      loginSessions: 'Sesi Log Masuk',
      dbTitle: 'Data & Sandaran',
      dbDesc: 'Urus sandaran data dan log sistem anda.',
      backupNow: 'Sandarkan Sekarang',
      viewHistory: 'Lihat Sejarah Sandaran',
      systemLogs: 'Log Sistem',
      footer: '© 2024 C2 Coffee + Candle. Hak cipta terpelihara | Versi 1.0.0',
      successSaved: 'Tetapan berjaya disimpan.',
      successBackup: 'Proses sandaran bermula. Ini mungkin mengambil masa beberapa minit...',
      statusEnabled: 'Didayakan',
      statusDisabled: 'Dilumpuhkan'
    }
  };

  const t = translations[settings.language] || translations['English (US)'];;

  // Modal State
  const [activeModal, setActiveModal] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Fetch settings from API on mount
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const data = await adminRequest('/api/settings');
        setSettings(prev => ({ ...prev, ...data }));
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Uncomment this line when the API is ready
    // fetchSettings();
  }, []);

  const openModal = (modalName, currentValue) => {
    setTempValue(currentValue || '');
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
    setTempValue('');
  };

  const handleSave = async (key) => {
    const updatedSettings = { ...settings, [key]: tempValue };
    const previousSettings = settings;
    
    // Optimistic update for UI responsiveness
    setSettings(updatedSettings);
    closeModal();

    try {
      await adminRequest('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });
      showToast(t.successSaved);
    } catch (error) {
      console.error("Failed to save settings to API:", error);
      setSettings(previousSettings);
      showToast(error instanceof Error ? error.message : 'We could not save this change. Please try again.');
    }
  };

  const handleBackup = async () => {
    try {
      await adminRequest('/api/settings/backup', { method: 'POST' });
      showToast('Backup completed successfully.');
    } catch (error) {
      console.error("Backup process failed:", error);
      showToast(error instanceof Error ? error.message : 'We could not complete the backup. Please try again.');
    }
  };

  const SectionHeader = ({ icon: Icon, title, description }) => (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
        <Icon size={28} className="text-white" strokeWidth={2.2} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 leading-tight">{title}</h2>
        <p className="text-base font-medium text-gray-600 mt-1">{description}</p>
      </div>
    </div>
  );

  const ListItem = ({ label, value, onClick, hideChevron, isToggle, onToggle }) => (
    <div 
      onClick={isToggle ? undefined : onClick}
      className={`flex items-center justify-between py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors -mx-6 px-6 ${isToggle ? '' : 'cursor-pointer'}`}
    >
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <div className="flex items-center gap-4">
        {isToggle ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${value === 'Enabled' ? 'bg-[#1F3A34]' : 'bg-gray-200'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value === 'Enabled' ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        ) : (
          value && <span className="text-sm font-bold text-gray-900">{value}</span>
        )}
        {!hideChevron && !isToggle && <ChevronRight size={18} className="text-gray-400" />}
      </div>
    </div>
  );

  const ActionButton = ({ icon: Icon, label, onClick }) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0 -mx-6 px-6">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <button 
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 bg-[#1F3A34] text-white text-sm font-bold rounded-lg hover:bg-[#2E5E58] transition-colors shadow-sm cursor-pointer"
      >
        <Icon size={16} /> {label}
      </button>
    </div>
  );

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB] relative">
      <div className="p-6 lg:p-8 w-full h-full flex flex-col space-y-6">
        
        {/* Header */}
        <div className="shrink-0 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-1">{t.pageDesc}</p>
          </div>
        </div>

        {/* General Settings */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader icon={SettingsIcon} title={t.generalTitle} description={t.generalDesc} />
          <div className="mt-2">
            <ListItem label={t.systemName} value={settings.systemName} onClick={() => openModal('systemName', settings.systemName)} />
            <ListItem label={t.timeZone} value={settings.timeZone} onClick={() => openModal('timeZone', settings.timeZone)} />
            <ListItem label={t.dateFormat} value={settings.dateFormat} onClick={() => openModal('dateFormat', settings.dateFormat)} />
            <ListItem label={t.timeFormat} value={settings.timeFormat} onClick={() => openModal('timeFormat', settings.timeFormat)} />
            <ListItem label={t.language} value={settings.language} onClick={() => openModal('language', settings.language)} />
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader icon={Shield} title={t.securityTitle} description={t.securityDesc} />
          <div className="mt-2">
            <ListItem label={t.changePassword} onClick={() => openModal('password')} />
            <ListItem 
              label={t.twoFactor} 
              value={settings.twoFactor} 
              isToggle 
              onToggle={async () => {
                const newVal = settings.twoFactor === 'Enabled' ? 'Disabled' : 'Enabled';
                const updatedSettings = { ...settings, twoFactor: newVal };
                setSettings(updatedSettings);
                
                try {
                  await adminRequest('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedSettings)
                  });
                  showToast(`${t.twoFactor} ${newVal === 'Enabled' ? t.statusEnabled : t.statusDisabled}`);
                } catch (error) {
                  console.error("Failed to update 2FA setting:", error);
                  setSettings(prev => ({ ...prev, twoFactor: settings.twoFactor }));
                  showToast(error instanceof Error ? error.message : 'We could not update this setting. Please try again.');
                }
              }}
            />
            <ListItem label={t.loginSessions} onClick={() => openModal('sessions')} />
          </div>
        </div>

        {/* Data & Backup */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <SectionHeader icon={Database} title={t.dbTitle} description={t.dbDesc} />
          <div className="mt-2">
            <ActionButton icon={Cloud} label={t.backupNow} onClick={handleBackup} />
            <ActionButton icon={Clock} label={t.viewHistory} onClick={() => openModal('backupHistory')} />
            <ActionButton icon={FileText} label={t.systemLogs} onClick={() => { if(setCurrentPage) setCurrentPage('Audit Logs'); }} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-500 font-medium py-4">
          © 2024 C2 Coffee + Candle. All right reserved | Version 1.0.0
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm animate-in fade-in slide-in-from-bottom-4 z-50">
          {toastMessage}
        </div>
      )}

      {/* Dynamic Modals */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {activeModal === 'systemName' && 'Edit System Name'}
                {activeModal === 'timeZone' && 'Select Time Zone'}
                {activeModal === 'dateFormat' && 'Select Date Format'}
                {activeModal === 'timeFormat' && 'Select Time Format'}
                {activeModal === 'language' && 'Select Language'}
                {activeModal === 'password' && 'Change Password'}
                {activeModal === 'twoFactor' && 'Two-Factor Authentication'}
                {activeModal === 'sessions' && 'Active Sessions'}
                {activeModal === 'backupHistory' && 'Backup History'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {/* Text Input Modal */}
              {activeModal === 'systemName' && (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">System Name</label>
                  <input 
                    type="text" 
                    value={tempValue} 
                    onChange={e => setTempValue(e.target.value)} 
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#1F3A34] focus:ring-1 focus:ring-[#1F3A34]"
                  />
                  <div className="pt-2 flex justify-end gap-3">
                    <button onClick={closeModal} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">Cancel</button>
                    <button onClick={() => handleSave('systemName')} className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg">Save</button>
                  </div>
                </div>
              )}

              {/* Select Modals */}
              {['timeZone', 'dateFormat', 'timeFormat', 'language', 'twoFactor'].includes(activeModal) && (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">Select Option</label>
                  <select 
                    value={tempValue} 
                    onChange={e => setTempValue(e.target.value)} 
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#1F3A34] focus:ring-1 focus:ring-[#1F3A34] cursor-pointer"
                  >
                    {activeModal === 'timeZone' && (
                      <>
                        <option value="(GMT +08:00) Kuala Lumpur">(GMT +08:00) Kuala Lumpur</option>
                        <option value="(GMT +08:00) Singapore">(GMT +08:00) Singapore</option>
                        <option value="(GMT +00:00) London">(GMT +00:00) London</option>
                      </>
                    )}
                    {activeModal === 'dateFormat' && (
                      <>
                        <option value="31 May 2026 (DD MMM YYYY)">31 May 2026 (DD MMM YYYY)</option>
                        <option value="05/31/2026 (MM/DD/YYYY)">05/31/2026 (MM/DD/YYYY)</option>
                        <option value="2026-05-31 (YYYY-MM-DD)">2026-05-31 (YYYY-MM-DD)</option>
                      </>
                    )}
                    {activeModal === 'timeFormat' && (
                      <>
                        <option value="12 Hours (10:30 AM)">12 Hours (10:30 AM)</option>
                        <option value="24 Hours (10:30)">24 Hours (10:30)</option>
                      </>
                    )}
                    {activeModal === 'language' && (
                      <>
                        <option value="English (US)">English (US)</option>
                        <option value="Bahasa Malaysia">Bahasa Malaysia</option>
                      </>
                    )}
                    {activeModal === 'twoFactor' && (
                      <>
                        <option value="Enabled">Enabled</option>
                        <option value="Disabled">Disabled</option>
                      </>
                    )}
                  </select>
                  <div className="pt-2 flex justify-end gap-3">
                    <button onClick={closeModal} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">Cancel</button>
                    <button onClick={() => handleSave(activeModal)} className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg">Save</button>
                  </div>
                </div>
              )}

              {/* Password Modal */}
              {activeModal === 'password' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#1F3A34]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#1F3A34]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg px-4 py-2 outline-none focus:border-[#1F3A34]" />
                  </div>
                  <div className="pt-2 flex justify-end gap-3">
                    <button onClick={closeModal} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">Cancel</button>
                    <button onClick={() => { closeModal(); showToast('Password updated successfully'); }} className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg">Update Password</button>
                  </div>
                </div>
              )}

              {/* Sessions Modal */}
              {activeModal === 'sessions' && (
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                    <div className="p-4 flex justify-between items-center bg-gray-50 rounded-t-xl">
                      <div>
                        <p className="text-sm font-bold text-gray-900">MacBook Pro - Chrome</p>
                        <p className="text-xs text-gray-500">Kuala Lumpur • Active Now</p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">Current</span>
                    </div>
                    <div className="p-4 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-gray-900">iPhone 13 - Safari</p>
                        <p className="text-xs text-gray-500">Kuala Lumpur • Last active 2 hours ago</p>
                      </div>
                      <button className="text-xs font-bold text-red-600 hover:text-red-700">Revoke</button>
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button onClick={closeModal} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 w-full">Close</button>
                  </div>
                </div>
              )}

              {/* Backup History Modal */}
              {activeModal === 'backupHistory' && (
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                    <div className="p-4 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Manual Backup</p>
                        <p className="text-xs text-gray-500">Aug 18, 2026 - 4.2 MB</p>
                      </div>
                      <button className="text-xs font-bold text-[#1F3A34] hover:underline">Download</button>
                    </div>
                    <div className="p-4 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Auto Backup</p>
                        <p className="text-xs text-gray-500">Aug 17, 2026 - 4.1 MB</p>
                      </div>
                      <button className="text-xs font-bold text-[#1F3A34] hover:underline">Download</button>
                    </div>
                    <div className="p-4 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Auto Backup</p>
                        <p className="text-xs text-gray-500">Aug 16, 2026 - 4.0 MB</p>
                      </div>
                      <button className="text-xs font-bold text-[#1F3A34] hover:underline">Download</button>
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button onClick={closeModal} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 w-full">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
