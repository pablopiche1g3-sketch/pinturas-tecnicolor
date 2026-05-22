
import { create } from 'zustand';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  Timestamp,
  Firestore,
  addDoc
} from 'firebase/firestore';

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

export interface ProjectDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
  createdAt: string;
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
  documents: ProjectDocument[];
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
  numeroControl?: string;
  issueDate: string;
  entityId: string;
  entityName: string;
  projectId?: string;
  type: 'purchase' | 'sale';
  documentType: '01' | '03' | '07' | string;
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

interface LedgerState {
  entities: Entity[];
  projects: Project[];
  transactions: Transaction[];
  inventory: InventoryItem[];
  loading: boolean;
}

interface LedgerActions {
  initListeners: (db: Firestore) => () => void;
  addEntity: (db: Firestore, entity: Omit<Entity, 'id' | 'createdAt'>) => void;
  deleteEntity: (db: Firestore, id: string) => void;
  addProject: (db: Firestore, project: Omit<Project, 'id' | 'createdAt' | 'documents'>) => void;
  updateProject: (db: Firestore, id: string, updates: Partial<Project>) => void;
  deleteProject: (db: Firestore, id: string) => void;
  addTransaction: (db: Firestore, transaction: Omit<Transaction, 'id'>) => void;
  voidTransaction: (db: Firestore, id: string, reason: string, relatedDoc?: string) => void;
  deleteTransaction: (db: Firestore, id: string) => void;
  addToInventory: (db: Firestore, items: Omit<InventoryItem, 'id' | 'dateAdded'>[]) => void;
  removeFromInventory: (db: Firestore, id: string) => void;
  addDocumentToProject: (db: Firestore, projectId: string, document: Omit<ProjectDocument, 'id' | 'createdAt'>) => void;
  deleteDocumentFromProject: (db: Firestore, projectId: string, documentId: string) => void;
}

export const useLedgerStore = create<LedgerState & LedgerActions>((set, get) => ({
  entities: [],
  projects: [],
  transactions: [],
  inventory: [],
  loading: true,

  initListeners: (db: Firestore) => {
    const unsubEntities = onSnapshot(collection(db, 'entities'), (snapshot) => {
      const entities = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Entity));
      set({ entities });
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
      set({ projects });
    });

    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      set({ transactions });
    });

    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const inventory = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InventoryItem));
      set({ inventory, loading: false });
    });

    return () => {
      unsubEntities();
      unsubProjects();
      unsubTransactions();
      unsubInventory();
    };
  },

  addEntity: (db, entity) => {
    addDoc(collection(db, 'entities'), {
      ...entity,
      createdAt: new Date().toISOString()
    });
  },

  deleteEntity: (db, id) => {
    deleteDoc(doc(db, 'entities', id));
  },

  addProject: (db, project) => {
    addDoc(collection(db, 'projects'), {
      ...project,
      documents: [],
      createdAt: new Date().toISOString()
    });
  },

  updateProject: (db, id, updates) => {
    updateDoc(doc(db, 'projects', id), updates);
  },

  deleteProject: (db, id) => {
    deleteDoc(doc(db, 'projects', id));
    // Note: In production you might want to delete sub-transactions too
  },

  addTransaction: (db, transaction) => {
    addDoc(collection(db, 'transactions'), {
      ...transaction,
      isVoided: false
    });
  },

  voidTransaction: (db, id, reason, relatedDoc) => {
    updateDoc(doc(db, 'transactions', id), {
      isVoided: true,
      voidReason: reason,
      relatedDocumentNumber: relatedDoc
    });
  },

  deleteTransaction: (db, id) => {
    deleteDoc(doc(db, 'transactions', id));
  },

  addToInventory: (db, items) => {
    items.forEach(item => {
      addDoc(collection(db, 'inventory'), {
        ...item,
        dateAdded: new Date().toISOString()
      });
    });
  },

  removeFromInventory: (db, id) => {
    deleteDoc(doc(db, 'inventory', id));
  },

  addDocumentToProject: (db, projectId, document) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;

    const newDoc = {
      ...document,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString()
    };

    updateDoc(doc(db, 'projects', projectId), {
      documents: [...project.documents, newDoc]
    });
  },

  deleteDocumentFromProject: (db, projectId, documentId) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;

    updateDoc(doc(db, 'projects', projectId), {
      documents: project.documents.filter(d => d.id !== documentId)
    });
  },
}));
