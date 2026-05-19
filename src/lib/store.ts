import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Entity {
  id: string;
  name: string;
  type: 'supplier' | 'customer';
  email?: string;
  phone?: string;
  createdAt: string;
}

export interface TransactionItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  entityId: string;
  entityName: string;
  type: 'purchase' | 'sale';
  items: TransactionItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  costBasis: number; // For sales, what it cost us. For purchases, same as totalAmount
  gain: number; // For sales, totalAmount - costBasis
}

interface LedgerStore {
  entities: Entity[];
  transactions: Transaction[];
  addEntity: (entity: Omit<Entity, 'id' | 'createdAt'>) => void;
  deleteEntity: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
}

export const useLedgerStore = create<LedgerStore>()(
  persist(
    (set) => ({
      entities: [],
      transactions: [],
      addEntity: (entity) => set((state) => ({
        entities: [
          ...state.entities,
          {
            ...entity,
            id: Math.random().toString(36).substring(2, 9),
            createdAt: new Date().toISOString()
          }
        ]
      })),
      deleteEntity: (id) => set((state) => ({
        entities: state.entities.filter((e) => e.id !== id)
      })),
      addTransaction: (transaction) => set((state) => ({
        transactions: [
          ...state.transactions,
          {
            ...transaction,
            id: Math.random().toString(36).substring(2, 9),
          }
        ]
      })),
      deleteTransaction: (id) => set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id)
      })),
    }),
    {
      name: 'vantage-ledger-store',
    }
  )
);
