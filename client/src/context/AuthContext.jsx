import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '../services/api.js';

const AuthContext = createContext(null);

function persistSession(user, token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  useEffect(() => {
    let active = true;
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      setLoading(false);
      return () => { active = false; };
    }

    api.get('/api/auth/me')
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user);
        setToken(storedToken);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      })
      .catch(() => {
        if (!active) return;
        clearSession();
        setUser(null);
        setToken(null);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    persistSession(data.user, data.token);
    setUser(data.user);
    setToken(data.token);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password, businessName = '') => {
    const { data } = await api.post('/api/auth/register', { name, email, password, businessName });
    persistSession(data.user, data.token);
    setUser(data.user);
    setToken(data.token);
    return data.user;
  }, []);

  const updateProfile = useCallback(async (profile) => {
    const { data } = await api.patch('/api/auth/me', profile);
    setUser(data.user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(() => ({ user, token, loading, login, register, updateProfile, logout }), [
    user, token, loading, login, register, updateProfile, logout,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
