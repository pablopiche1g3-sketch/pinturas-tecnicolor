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

export interface ProjectProduct {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InventoryItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sourceInvoice: string;
  dateAdded: string;
}

export interface Project {
  id: string;
  name: string;
  purchaseOrder: string;
  targetSaleAmount: number;
  customerId: string;
  customerName: string;
  expectedProducts: ProjectProduct[];
  createdAt: string;
  status: 'active' | 'completed';
}

export interface TransactionItem {
  code?: string;
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
  projectId?: string;
  type: 'purchase' | 'sale';
  documentType: '01' | '03' | '07' | string; // 01: Factura, 03: CCF, 07: Nota Crédito
  items: TransactionItem[];
  subtotal: number;
  taxAmount: number;
  retentionAmount?: number;
  perceptionAmount?: number;
  totalAmount: number;
  costBasis: number;
  gain: number;
  isVoided?: boolean;
  voidReason?: string;
  relatedDocumentNumber?: string;
}

interface LedgerStore {
  entities: Entity[];
  projects: Project[];
  transactions: Transaction[];
  inventory: InventoryItem[];
  addEntity: (entity: Omit<Entity, 'id' | 'createdAt'>) => void;
  deleteEntity: (id: string) => void;
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  deleteProject: (id: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  voidTransaction: (id: string, reason: string, relatedDoc?: string) => void;
  deleteTransaction: (id: string) => void;
  addToInventory: (items: Omit<InventoryItem, 'id' | 'dateAdded'>[]) => void;
  removeFromInventory: (id: string) => void;
}

export const useLedgerStore = create<LedgerStore>()(
  persist(
    (set) => ({
      entities: [],
      projects: [],
      transactions: [],
      inventory: [],
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
      addProject: (project) => set((state) => ({
        projects: [
          ...state.projects,
          {
            ...project,
            id: Math.random().toString(36).substring(2, 9),
            createdAt: new Date().toISOString()
          }
        ]
      })),
      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        transactions: state.transactions.filter((t) => t.projectId !== id)
      })),
      addTransaction: (transaction) => set((state) => ({
        transactions: [
          ...state.transactions,
          {
            ...transaction,
            id: Math.random().toString(36).substring(2, 9),
            isVoided: false
          }
        ]
      })),
      voidTransaction: (id, reason, relatedDoc) => set((state) => ({
        transactions: state.transactions.map((t) => 
          t.id === id ? { ...t, isVoided: true, voidReason: reason, relatedDocumentNumber: relatedDoc } : t
        )
      })),
      deleteTransaction: (id) => set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id)
      })),
      addToInventory: (items) => set((state) => ({
        inventory: [
          ...state.inventory,
          ...items.map(i => ({
            ...i,
            id: Math.random().toString(36).substring(2, 9),
            dateAdded: new Date().toISOString()
          }))
        ]
      })),
      removeFromInventory: (id) => set((state) => ({
        inventory: state.inventory.filter(i => i.id !== id)
      })),
    }),
    {
      name: 'tecnicolor-ledger-store-v5',
    }
  )
);
