import React, { useEffect, useState } from 'react';
import { adminRequest, loadAdminTenants } from '../lib/adminApi';
import { Eye, EyeOff } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState('login');
  const [tenantCode, setTenantCode] = useState('c2coffee');
  const [tenants, setTenants] = useState([]);
  const [identifier, setIdentifier] = useState('Boss');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingSession, setPendingSession] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const loadTenants = async () => {
      try {
        const tenantList = await loadAdminTenants();
        setTenants(tenantList);
        if (tenantList.length > 0 && !tenantList.some((tenant) => tenant.code === tenantCode)) {
          setTenantCode(tenantList[0].code);
        }
      } catch {
        setTenants([]);
      }
    };

    void loadTenants();
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await adminRequest('/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          tenant_code: tenantCode,
          identifier,
          password
        })
      });

      if (response.setup_required) {
        setPendingSession({
          accessToken: response.access_token,
          refreshToken: response.refresh_token
        });
        setMode('setup');
        setEmail(response.user?.email || '');
        return;
      }

      onLoginSuccess({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        tenant: response.tenant,
        user: response.user
      });
    } catch (error) {
      setErrorMessage(error.message || 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupComplete = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      if (newPassword !== confirmPassword) {
        throw new Error('Password confirmation does not match.');
      }

      if (!pendingSession) {
        throw new Error('Setup session is missing. Please sign in again.');
      }

      const response = await adminRequest('/v1/admin/auth/complete-setup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pendingSession.accessToken}`
        },
        body: JSON.stringify({
          email,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      onLoginSuccess({
        ...pendingSession,
        user: response.user,
        tenant: {
          code: response.user?.tenant_code || tenantCode,
          name: response.user?.tenant_name || tenantCode,
          display_name: response.user?.tenant_display_name || tenants.find((tenant) => tenant.code === tenantCode)?.display_name || tenantCode
        }
      });
    } catch (error) {
      setErrorMessage(error.message || 'Unable to complete setup.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black font-sans">
      {/* Background Image with subtle scale */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-90 scale-105"
        style={{ backgroundImage: 'url(/FKP01925.jpg)' }}
      />
      
      {/* Premium Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#0f211d]/50 to-[#0f211d]/90 z-0" />

      {/* Glassmorphic Login Box */}
      <form
        onSubmit={mode === 'login' ? handleLogin : handleSetupComplete}
        className="relative z-10 bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-500"
      >
        
        {/* Logo */}
        <img src="/c2_logo.png" alt="C2 Logo" className="w-28 h-28 object-contain drop-shadow-2xl mb-6" />
        
        <h2 className="text-4xl font-medium text-white mb-2 drop-shadow-sm text-center" style={{ fontFamily: 'Recoleta, serif' }}>
          {mode === 'login' ? 'Welcome Back' : 'Complete Setup'}
        </h2>

        <p className="text-white/70 text-sm mb-10 text-center font-medium">
          {mode === 'login'
            ? 'Sign in with your tenant code, admin username, and password.'
            : 'Add your email and change your password before continuing.'}
        </p>

        {errorMessage && (
          <div className="w-full mb-4 rounded-2xl bg-red-500/15 border border-red-300/30 px-4 py-3 text-red-50 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="w-full space-y-4">
          {mode === 'login' ? (
            <>
              <label className="block">
                <span className="block text-white/80 text-sm font-medium mb-2">Tenant</span>
                <select
                  value={tenantCode}
                  onChange={(event) => setTenantCode(event.target.value)}
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none focus:border-white/50"
                >
                  {tenants.length > 0 ? (
                    tenants.map((tenant) => (
                      <option key={tenant.code} value={tenant.code}>
                        {tenant.display_name}
                      </option>
                    ))
                  ) : (
                    <option value="c2coffee">C2 Coffee & Candle</option>
                  )}
                </select>
              </label>
              <label className="block">
                <span className="block text-white/80 text-sm font-medium mb-2">Username</span>
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-white/50"
                  placeholder="Boss"
                  autoComplete="username"
                />
              </label>
              <label className="block">
                <span className="block text-white/80 text-sm font-medium mb-2">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 pr-12 text-white placeholder-white/40 outline-none focus:border-white/50"
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-200 transition-colors cursor-pointer z-10 p-2"
                  >
                    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="block text-white/80 text-sm font-medium mb-2">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-white/50"
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="block text-white/80 text-sm font-medium mb-2">New Password</span>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 pr-12 text-white placeholder-white/40 outline-none focus:border-white/50"
                    placeholder="Create password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-200 transition-colors cursor-pointer z-10 p-2"
                  >
                    {showNewPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="block text-white/80 text-sm font-medium mb-2">Confirm Password</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 pr-12 text-white placeholder-white/40 outline-none focus:border-white/50"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-200 transition-colors cursor-pointer z-10 p-2"
                  >
                    {showConfirmPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </label>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-6 bg-white text-[#0f211d] font-semibold text-lg py-3.5 px-4 rounded-2xl transition-all shadow-lg hover:shadow-2xl hover:-translate-y-1 hover:bg-gray-50 flex items-center justify-center space-x-2 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <span>{isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Finish Setup'}</span>
          <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>

    </div>
  );
};

export default Login;
