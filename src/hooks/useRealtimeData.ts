import { useState, useEffect } from 'react';
import { db } from '../services/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Helper to reduce boilerplate
function useRealtimeResource<T>(
  fetcher: (arg?: string) => Promise<T[]>, 
  subscriber: (cb: (data: T[]) => void, arg?: string) => RealtimeChannel,
  arg?: string
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetcher(arg);
        setData(res || []);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    load();
    if (subscriber) {
      // @ts-ignore - dynamic subscription mapping
      channel = subscriber((updated) => setData(updated || []), arg);
    }
    return () => { if (channel) channel.unsubscribe(); };
  }, [arg]);

  return { data, loading, refresh: () => fetcher(arg).then(setData) };
}

export function useProducts(storeId?: string) {
  return useRealtimeResource(db.products.getAll, db.products.subscribe, storeId);
}
export function useCategories() {
  return useRealtimeResource(db.categories.getAll, db.categories.subscribe);
}
export function useCustomers(storeId?: string) {
  return useRealtimeResource(db.customers.getAll, db.customers.subscribe, storeId);
}
export function useInventoryTransfers() {
  return useRealtimeResource(db.inventoryTransfers.getAll, db.inventoryTransfers.subscribe);
}
export function useEmployeePerformance(storeId?: string) {
  return useRealtimeResource(db.employeePerformance.getAll, db.employeePerformance.subscribe, storeId);
}
export function useSuppliers() {
  return useRealtimeResource(db.suppliers.getAll, db.suppliers.subscribe);
}