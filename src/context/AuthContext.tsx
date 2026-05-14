import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
  userData: User | null;
  loading: boolean;
  setUserData: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  userData: null,
  loading: true,
  setUserData: () => {},
  logout: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userData, setUserDataState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('local_user');
    if (stored) {
      setUserDataState(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const setUserData = (user: User) => {
    localStorage.setItem('local_user', JSON.stringify(user));
    setUserDataState(user);
  };

  const logout = () => {
    localStorage.removeItem('local_user');
    setUserDataState(null);
  };

  return (
    <AuthContext.Provider value={{ userData, loading, setUserData, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
