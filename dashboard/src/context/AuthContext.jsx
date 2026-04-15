import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(() => localStorage.getItem('behavr_token'));
  const [user, setUser]       = useState(() => { try { return JSON.parse(localStorage.getItem('behavr_user')); } catch { return null; } });
  const [company, setCompany] = useState(() => { try { return JSON.parse(localStorage.getItem('behavr_company')); } catch { return null; } });

  function login(tokenVal, userData, companyData) {
    localStorage.setItem('behavr_token',   tokenVal);
    localStorage.setItem('behavr_user',    JSON.stringify(userData));
    localStorage.setItem('behavr_company', JSON.stringify(companyData));
    setToken(tokenVal); setUser(userData); setCompany(companyData);
  }

  function logout() {
    ['behavr_token','behavr_user','behavr_company'].forEach(k => localStorage.removeItem(k));
    setToken(null); setUser(null); setCompany(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, company, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
