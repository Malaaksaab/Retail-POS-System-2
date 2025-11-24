import { supabase } from '../lib/supabase';
import { db } from './database';
import type { User } from '../types';

export const auth = {
  async signUp(email: string, password: string, userData: { name: string; role: string; storeId?: string }) {
    // 1. Create auth user. The SQL Trigger will automatically create the public.users record.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userData.name,
          role: userData.role,
          storeId: userData.storeId
        }
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    // Return the user structure immediately
    return { authUser: authData.user };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Failed to sign in');

    // Update last login timestamp
    await db.users.update(data.user.id, {
      lastLogin: new Date().toISOString(),
    });

    const user = await db.users.getByEmail(email);
    return { authUser: data.user, user, session: data.session };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !authUser.email) return null;
    return await db.users.getByEmail(authUser.email);
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        const user = await db.users.getByEmail(session.user.email);
        callback(user);
      } else {
        callback(null);
      }
    });
  }
};