import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

export default function Login({ setAuthStatus }) {

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/auth/google`, {
        token: credentialResponse.credential
      });
      
      const { token, admin } = res.data;
      
      if (admin.role === 'pending') {
        toast.error("Your account is pending admin approval.");
        return; // Don't log them in yet
      }

      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(admin));
      toast.success(`Welcome, ${admin.name || admin.email}`);
      setAuthStatus({ token, user: admin });
      
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Login failed.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="max-w-md w-full p-8 bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center text-center">
        <ShieldCheck className="w-16 h-16 text-indigo-600 mb-6" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Sign in to Facely</h2>
        <p className="text-slate-500 mb-8">Sign in with your authorized Google workspace account to access the dashboard and kiosk.</p>
        
        <GoogleLogin
          onSuccess={handleLoginSuccess}
          onError={() => toast.error("Google login failed")}
          useOneTap
        />
        
        <div className="mt-8 text-xs text-slate-400">
          First time? Sign in above and ask an administrator to approve your access.
        </div>
      </div>
    </div>
  );
}
