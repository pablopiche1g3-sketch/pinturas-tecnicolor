
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
  isGranContribuyente?: boolean;
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
  warrantyStartDate?: string | null;
  warrantyMonths?: number | null;
}

export interface Reminder {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  description: string;
  date: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
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
  type: 'purchase' | 'sale' | 'remission';
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
  reminders: Reminder[];
  notes: Note[];
  loading: boolean;
}

interface LedgerActions {
  initListeners: (db: Firestore) => () => void;
  addEntity: (db: Firestore, entity: Omit<Entity, 'id' | 'createdAt'>) => void;
  deleteEntity: (db: Firestore, id: string) => void;
  addProject: (db: Firestore, project: Omit<Project, 'id' | 'createdAt' | 'documents'>) => void;
  updateProject: (db: Firestore, id: string, updates: Partial<Project>) => void;
  deleteProject: (db: Firestore, id: string) => void;
  mergeProjects: (db: Firestore, sourceProjectId: string, targetProjectId: string, sourceProject: Project, targetProject: Project, transactions: Transaction[]) => Promise<void>;
  addTransaction: (db: Firestore, transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (db: Firestore, id: string, updates: Partial<Transaction>) => void;
  voidTransaction: (db: Firestore, id: string, reason: string, relatedDoc?: string) => void;
  deleteTransaction: (db: Firestore, id: string) => void;
  addToInventory: (db: Firestore, items: Omit<InventoryItem, 'id' | 'dateAdded'>[]) => void;
  removeFromInventory: (db: Firestore, id: string) => void;
  updateInventoryQuantity: (db: Firestore, id: string, newQuantity: number) => void;
  addDocumentToProject: (db: Firestore, projectId: string, document: Omit<ProjectDocument, 'id' | 'createdAt'>) => void;
  deleteDocumentFromProject: (db: Firestore, projectId: string, documentId: string) => void;
  addReminder: (db: Firestore, reminder: Omit<Reminder, 'id' | 'createdAt' | 'isCompleted'>) => void;
  updateReminder: (db: Firestore, id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (db: Firestore, id: string) => void;
  addNote: (db: Firestore, content: string) => void;
  deleteNote: (db: Firestore, id: string) => void;
}

export const useLedgerStore = create<LedgerState & LedgerActions>((set, get) => ({
  entities: [],
  projects: [],
  transactions: [],
  inventory: [],
  reminders: [],
  notes: [],
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

    const unsubReminders = onSnapshot(collection(db, 'reminders'), (snapshot) => {
      const reminders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Reminder));
      set({ reminders });
    });

    const unsubNotes = onSnapshot(collection(db, 'notes'), (snapshot) => {
      const notes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Note));
      // Sort notes descending by default
      notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      set({ notes });
    });

    return () => {
      unsubEntities();
      unsubProjects();
      unsubTransactions();
      unsubInventory();
      unsubReminders();
      unsubNotes();
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

  mergeProjects: async (db, sourceProjectId, targetProjectId, sourceProject, targetProject, transactions) => {
    // 1. Update all transactions from source project to target project
    const sourceTxs = transactions.filter(t => t.projectId === sourceProjectId);
    for (const tx of sourceTxs) {
      await updateDoc(doc(db, 'transactions', tx.id), { projectId: targetProjectId });
    }

    // 2. Combine expected products
    const combinedProducts = [...(targetProject.expectedProducts || [])];
    for (const sourceProd of (sourceProject.expectedProducts || [])) {
      const existingIdx = combinedProducts.findIndex(p => 
        (p.code && sourceProd.code && p.code.trim().toLowerCase() === sourceProd.code.trim().toLowerCase()) ||
        (p.description && sourceProd.description && p.description.trim().toLowerCase() === sourceProd.description.trim().toLowerCase())
      );
      if (existingIdx >= 0) {
        combinedProducts[existingIdx] = {
          ...combinedProducts[existingIdx],
          quantity: combinedProducts[existingIdx].quantity + sourceProd.quantity,
          unitPrice: sourceProd.unitPrice || combinedProducts[existingIdx].unitPrice
        };
      } else {
        combinedProducts.push({ ...sourceProd });
      }
    }

    // 3. Combine documents
    const combinedDocs = [...(targetProject.documents || []), ...(sourceProject.documents || [])];

    // 4. Update target project with aggregated values
    const newPO = targetProject.purchaseOrder && sourceProject.purchaseOrder && !targetProject.purchaseOrder.includes(sourceProject.purchaseOrder)
      ? `${targetProject.purchaseOrder} / ${sourceProject.purchaseOrder}`
      : targetProject.purchaseOrder || sourceProject.purchaseOrder;

    await updateDoc(doc(db, 'projects', targetProjectId), {
      targetSaleAmount: (targetProject.targetSaleAmount || 0) + (sourceProject.targetSaleAmount || 0),
      expectedProducts: combinedProducts,
      documents: combinedDocs,
      purchaseOrder: newPO
    });

    // 5. Delete source project
    await deleteDoc(doc(db, 'projects', sourceProjectId));
  },

  addTransaction: (db, transaction) => {
    addDoc(collection(db, 'transactions'), {
      ...transaction,
      isVoided: false
    });
  },

  updateTransaction: (db, id, updates) => {
    // filter undefined fields to prevent firestore errors
    const validUpdates = Object.entries(updates).reduce((acc, [k, v]) => {
      if (v !== undefined) acc[k] = v;
      else acc[k] = null;
      return acc;
    }, {} as any);
    updateDoc(doc(db, 'transactions', id), validUpdates);
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

  updateInventoryQuantity: (db, id, newQuantity) => {
    if (newQuantity <= 0) {
      deleteDoc(doc(db, 'inventory', id));
    } else {
      updateDoc(doc(db, 'inventory', id), { quantity: newQuantity });
    }
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

  addReminder: (db, reminder) => {
    addDoc(collection(db, 'reminders'), {
      ...reminder,
      isCompleted: false,
      createdAt: new Date().toISOString()
    });
  },

  updateReminder: (db, id, updates) => {
    updateDoc(doc(db, 'reminders', id), updates);
  },

  deleteReminder: (db, id) => {
    deleteDoc(doc(db, 'reminders', id));
  },

  addNote: (db, content) => {
    addDoc(collection(db, 'notes'), {
      content,
      createdAt: new Date().toISOString()
    });
  },

  deleteNote: (db, id) => {
    deleteDoc(doc(db, 'notes', id));
  },
}));
