import { supabase } from '../lib/supabase';
import type {
  User, Store, Product, Customer, Transaction, 
  Supplier, Category, InventoryTransfer, 
  EmployeePerformance, HeldOrder, Promotion, 
  EmployeeGoal, EmployeeBonus, RotaSchedule, WageManagement
} from '../types';

// Helper for offline support (Simple Queue)
const offlineQueue: any[] = JSON.parse(localStorage.getItem('offlineQueue') || '[]');

const processOfflineQueue = async () => {
  if (navigator.onLine && offlineQueue.length > 0) {
    console.log('Processing offline queue...');
    // In a real app, you would loop through and retry these actions
    // For now, we just clear it to prevent infinite loops
    localStorage.setItem('offlineQueue', '[]');
  }
};
window.addEventListener('online', processOfflineQueue);

// Generic Helper for Type-Safe DB Calls
async function fetchTable<T>(table: string, storeId?: string, queryConfig?: { order?: string, limit?: number, eq?: {col: string, val: any} }) {
  let query = supabase.from(table).select('*');
  
  if (storeId && table !== 'users' && table !== 'stores') query = query.eq('store_id', storeId);
  if (queryConfig?.eq) query = query.eq(queryConfig.eq.col, queryConfig.eq.val);
  if (queryConfig?.order) query = query.order(queryConfig.order, { ascending: false });
  if (queryConfig?.limit) query = query.limit(queryConfig.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data as T[];
}

export const db = {
  users: {
    async getAll() { return fetchTable<User>('users'); },
    async getByEmail(email: string) {
      const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      if (error) throw error;
      return data as User;
    },
    async update(id: string, updates: Partial<User>) {
      const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
  },

  stores: {
    async getAll() { 
      // We select everything. Note: store_settings and hardware_config are joined
      const { data, error } = await supabase.from('stores').select('*, store_settings(*), hardware_config(*)');
      if (error) throw error;
      return data as Store[]; 
    },
    async getById(id: string) {
      const { data, error } = await supabase.from('stores').select('*, store_settings(*), hardware_config(*)').eq('id', id).single();
      if (error) throw error;
      return data as Store;
    },
    async create(store: Partial<Store> & { settings?: any, hardware?: any }) {
      const { settings, hardware, ...storeData } = store;
      // 1. Create Store
      const { data: newStore, error: storeError } = await supabase.from('stores').insert(storeData).select().single();
      if (storeError) throw storeError;

      // 2. Create Settings
      if (settings) {
        await supabase.from('store_settings').insert({ store_id: newStore.id, ...settings });
      }
      // 3. Create Hardware Config
      if (hardware) {
        await supabase.from('hardware_config').insert({ store_id: newStore.id, ...hardware });
      }
      return newStore;
    },
    async update(id: string, updates: Partial<Store>) {
      const { data, error } = await supabase.from('stores').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id: string) {
      const { error } = await supabase.from('stores').delete().eq('id', id);
      if (error) throw error;
    },
    subscribe(callback: (data: Store[]) => void) {
      return supabase
        .channel('stores_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, 
          async () => {
            const data = await this.getAll(); // Refresh list on any change
            callback(data);
          }
        )
        .subscribe();
    }
  },

  products: {
    async getAll(storeId?: string) { 
      return fetchTable<Product>('products', storeId, { order: 'created_at' }); 
    },
    async create(product: Partial<Product>) {
      if (!navigator.onLine) {
        offlineQueue.push({ type: 'create_product', data: product });
        localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
        return product as Product; // Optimistic
      }
      const { data, error } = await supabase.from('products').insert(product).select().single();
      if (error) throw error;
      return data as Product;
    },
    async update(id: string, updates: Partial<Product>) {
      const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id: string) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    subscribe(callback: (data: Product[]) => void, storeId?: string) {
        return supabase.channel('products_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, 
          async () => callback(await this.getAll(storeId)))
          .subscribe();
      }
  },

  // --- Supporting Services ---

  employeePerformance: {
    async getAll(storeId?: string) {
      return fetchTable<EmployeePerformance>('employee_performance', storeId);
    },
    subscribe(callback: (data: EmployeePerformance[]) => void, storeId?: string) {
      return supabase.channel('employee_perf_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_performance' }, 
        async () => callback(await this.getAll(storeId)))
        .subscribe();
    }
  },

  inventoryTransfers: {
    async getAll() {
      const { data, error } = await supabase.from('inventory_transfers')
        .select('*, items:transfer_items(*)')
        .order('created_at', { ascending: false });
      if(error) throw error;
      return data as InventoryTransfer[];
    },
    subscribe(callback: (data: InventoryTransfer[]) => void) {
      return supabase.channel('transfers_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transfers' }, 
        async () => callback(await this.getAll()))
        .subscribe();
    }
  },

  transactions: {
    async create(transaction: any) {
       const { items, ...tData } = transaction;
       const { data: newTxn, error } = await supabase.from('transactions').insert(tData).select().single();
       if(error) throw error;

       const itemsData = items.map((i: any) => ({ ...i, transaction_id: newTxn.id }));
       await supabase.from('transaction_items').insert(itemsData);
       return newTxn;
    },
    async getAll(storeId?: string) {
      return fetchTable<Transaction>('transactions', storeId, { order: 'created_at', limit: 50 });
    },
    subscribe(callback: (data: Transaction[]) => void, storeId?: string) {
        return supabase.channel('transactions_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, 
          async () => callback(await this.getAll(storeId)))
          .subscribe();
      }
  },

  categories: {
    async getAll() { return fetchTable<Category>('categories'); },
    async create(cat: any) { const {data, error} = await supabase.from('categories').insert(cat).select().single(); if(error) throw error; return data; },
    async delete(id: string) { await supabase.from('categories').delete().eq('id', id); },
    subscribe(callback: (data: Category[]) => void) {
        return supabase.channel('categories_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, 
          async () => callback(await this.getAll()))
          .subscribe();
      }
  },

  customers: {
    async getAll(storeId?: string) { return fetchTable<Customer>('customers', storeId); },
    async create(cust: any) { const {data, error} = await supabase.from('customers').insert(cust).select().single(); if(error) throw error; return data; },
    async update(id: string, updates: any) { await supabase.from('customers').update(updates).eq('id', id); },
    async delete(id: string) { await supabase.from('customers').delete().eq('id', id); },
    subscribe(callback: (data: Customer[]) => void, storeId?: string) {
        return supabase.channel('customers_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, 
          async () => callback(await this.getAll(storeId)))
          .subscribe();
      }
  },

  suppliers: {
    async getAll() { return fetchTable<Supplier>('suppliers'); },
    async create(sup: any) { const {data, error} = await supabase.from('suppliers').insert(sup).select().single(); if(error) throw error; return data; },
    async delete(id: string) { await supabase.from('suppliers').delete().eq('id', id); },
    subscribe(callback: (data: Supplier[]) => void) {
        return supabase.channel('suppliers_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, 
          async () => callback(await this.getAll()))
          .subscribe();
      }
  },
  
  // Add stubs for other services to prevent errors if referenced
  heldOrders: { getAll: async () => [], subscribe: () => ({ unsubscribe: () => {} }) },
  promotions: { getAll: async () => [], subscribe: () => ({ unsubscribe: () => {} }) },
  alerts: { getAll: async () => [], subscribe: () => ({ unsubscribe: () => {} }) },
  salesManagement: { getAll: async () => [] },
  autoInventoryRules: { getAll: async () => [] }
};