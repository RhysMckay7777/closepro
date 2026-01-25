'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from '@/lib/auth-client';

interface UserProfile {
  name: string;
  email: string;
  avatar: string | null;
  id?: string;
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const CACHE_KEY = 'closepro_user_profile';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  data: UserProfile;
  timestamp: number;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (force = false): Promise<void> => {
    if (!session?.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // Check cache first
      if (!force) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const cacheData: CacheData = JSON.parse(cached);
            const now = Date.now();
            
            // Use cache if it's still valid
            if (now - cacheData.timestamp < CACHE_DURATION) {
              setUser(cacheData.data);
              setLoading(false);
              return;
            }
          } catch (e) {
            // Invalid cache, continue to fetch
          }
        }
      }

      // Fetch from API
      const response = await fetch('/api/profile');
      if (response.ok) {
        const data = await response.json();
        const profile: UserProfile = {
          name: data.name,
          email: data.email,
          avatar: data.profilePhoto,
          id: data.id,
        };

        // Cache the result
        const cacheData: CacheData = {
          data: profile,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

        setUser(profile);
      } else {
        // If API fails, try to use cached data even if expired
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const cacheData: CacheData = JSON.parse(cached);
            setUser(cacheData.data);
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      
      // Fallback to cache on error
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const cacheData: CacheData = JSON.parse(cached);
          setUser(cacheData.data);
        } catch (e) {
          // Ignore
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
    } else {
      setUser(null);
      setLoading(false);
      // Clear cache on logout
      localStorage.removeItem(CACHE_KEY);
    }
  }, [session?.user?.id]); // Only refetch if user ID changes

  const refetch = async () => {
    setLoading(true);
    await fetchUserProfile(true);
  };

  return (
    <UserContext.Provider value={{ user, loading, refetch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
