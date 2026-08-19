import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email && password) {
      onLogin();
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
      <div className="relative z-10 bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo */}
        <img src="/c2_logo.png" alt="C2 Logo" className="w-28 h-28 object-contain drop-shadow-2xl mb-6" />
        
        <h2 className="text-4xl font-medium text-white mb-2 drop-shadow-sm" style={{ fontFamily: 'Recoleta, serif' }}>
          Welcome Back
        </h2>
        <p className="text-white/70 text-sm mb-8 text-center font-medium">
          Sign in to access your admin dashboard.
        </p>
        
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              required
              className="w-full bg-white/20 border border-white/30 text-white placeholder-white/60 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full bg-white/20 border border-white/30 text-white placeholder-white/60 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-white text-[#0f211d] font-bold text-lg py-3.5 px-4 rounded-2xl transition-all shadow-lg hover:shadow-2xl hover:-translate-y-1 hover:bg-gray-50 flex items-center justify-center space-x-2 mt-4"
          >
            <span>Sign In</span>
            <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
