/**
 * useYjsSync - Hook para sincronización CRDT con Yjs + y-trystero + y-indexeddb
 * 
 * Provee un documento Yjs compartido entre peers via Trystero WebRTC,
 * con persistencia local en IndexedDB.
 * 
 * Usado por el sistema de batalla P2P para sincronizar estado de batalla
 * de forma determinística y conflict-free.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

// ============================================================================
// TYPES
// ============================================================================

export interface YjsSyncState {
  isReady: boolean;
  doc: Y.Doc | null;
  error: string | null;
}

interface UseYjsSyncOptions {
  /** Unique name for the IndexedDB database */
  dbName: string;
  /** Whether to enable persistence */
  enablePersistence?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook that creates and manages a Yjs document with IndexedDB persistence.
 * The document is used for CRDT-based state synchronization during P2P battles.
 * 
 * Trystero handles the WebRTC transport via the existing multiplayer provider.
 * This hook focuses on the Yjs document lifecycle and persistence.
 */
export const useYjsSync = ({ dbName, enablePersistence = true }: UseYjsSyncOptions): YjsSyncState & {
  getMap: <T>(name: string) => Y.Map<T>;
  getArray: <T>(name: string) => Y.Array<T>;
  transact: (fn: () => void) => void;
  destroy: () => void;
} => {
  const docRef = useRef<Y.Doc | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Yjs document
  useEffect(() => {
    try {
      const doc = new Y.Doc();
      docRef.current = doc;

      if (enablePersistence) {
        const persistence = new IndexeddbPersistence(dbName, doc);
        persistenceRef.current = persistence;

        persistence.on('synced', () => {
          console.log('[YjsSync] IndexedDB synced for:', dbName);
          setIsReady(true);
        });
      } else {
        setIsReady(true);
      }

      console.log('[YjsSync] Document created:', dbName);
    } catch (e) {
      console.error('[YjsSync] Error creating document:', e);
      setError(e instanceof Error ? e.message : 'Failed to create Yjs document');
    }

    return () => {
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
      if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
      }
      setIsReady(false);
      console.log('[YjsSync] Document destroyed:', dbName);
    };
  }, [dbName, enablePersistence]);

  const getMap = useCallback(<T,>(name: string): Y.Map<T> => {
    if (!docRef.current) throw new Error('Yjs document not initialized');
    return docRef.current.getMap(name) as Y.Map<T>;
  }, []);

  const getArray = useCallback(<T,>(name: string): Y.Array<T> => {
    if (!docRef.current) throw new Error('Yjs document not initialized');
    return docRef.current.getArray(name) as Y.Array<T>;
  }, []);

  const transact = useCallback((fn: () => void) => {
    if (!docRef.current) return;
    docRef.current.transact(fn);
  }, []);

  const destroy = useCallback(() => {
    if (persistenceRef.current) {
      persistenceRef.current.destroy();
      persistenceRef.current = null;
    }
    if (docRef.current) {
      docRef.current.destroy();
      docRef.current = null;
    }
    setIsReady(false);
  }, []);

  return {
    isReady,
    doc: docRef.current,
    error,
    getMap,
    getArray,
    transact,
    destroy,
  };
};

// ============================================================================
// BATTLE DOCUMENT HELPERS
// ============================================================================

/**
 * Initialize a battle document with the required structure
 */
export const initBattleDocument = (
  doc: Y.Doc,
  battleId: string,
  participants: string[]
) => {
  doc.transact(() => {
    const meta = doc.getMap('meta');
    meta.set('battleId', battleId);
    meta.set('phase', 'PREPARING');
    meta.set('createdAt', Date.now());
    meta.set('resolvedAt', null);

    const participantsArray = doc.getArray('participants');
    participants.forEach(p => participantsArray.push([p]));

    // armies: Map<peerId, Map<unitType, count>>
    const armies = doc.getMap('armies');
    participants.forEach(p => armies.set(p, new Y.Map()));

    // locks: Map<peerId, boolean>
    const locks = doc.getMap('locks');
    participants.forEach(p => locks.set(p, false));

    // result: stored as a map
    const result = doc.getMap('result');
    result.set('resolved', false);
  });
};

/**
 * Set army for a participant in the battle document
 */
export const setArmyInDocument = (
  doc: Y.Doc,
  peerId: string,
  army: Record<string, number>
) => {
  doc.transact(() => {
    const armies = doc.getMap('armies');
    const peerArmy = armies.get(peerId) as Y.Map<number> | undefined;
    if (peerArmy) {
      // Clear and set new army
      peerArmy.forEach((_: number, key: string) => peerArmy.delete(key));
      Object.entries(army).forEach(([unitType, count]) => {
        if (count > 0) peerArmy.set(unitType, count);
      });
    }
  });
};

/**
 * Lock army for a participant
 */
export const lockArmyInDocument = (doc: Y.Doc, peerId: string) => {
  doc.transact(() => {
    const locks = doc.getMap('locks');
    locks.set(peerId, true);
  });
};

/**
 * Store battle result in document
 */
export const setResultInDocument = (
  doc: Y.Doc,
  resultData: Record<string, unknown>
) => {
  doc.transact(() => {
    const result = doc.getMap('result');
    result.set('resolved', true);
    Object.entries(resultData).forEach(([key, value]) => {
      result.set(key, value);
    });

    const meta = doc.getMap('meta');
    meta.set('phase', 'RESULT');
    meta.set('resolvedAt', Date.now());
  });
};
