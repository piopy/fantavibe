const STORAGE_KEY_LAST_FILE = 'fantavibe_last_file_info';
const STORAGE_KEY_FILE_CONTENT = 'fantavibe_cached_content';
const STORAGE_KEY_CACHE_TIMESTAMP = 'fantavibe_cache_timestamp';

// Configurazione cache
const CACHE_EXPIRY_HOURS = 24; // Cache valida per 24 ore
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB limite per localStorage

/**
 * Ottiene l'ETag o altre info di cache del file
 */
export const getFileInfo = async () => {
  try {
    console.log('Getting file info via Netlify function...');
    
    const response = await fetch("/.netlify/functions/get-file-info", {
      method: "GET",
      credentials: 'omit',
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      if (response.status === 0) {
        throw new Error('Network error or function not accessible');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`File check error: ${response.status} - ${errorData.error || response.statusText}`);
    }
    
    const fileInfo = await response.json();
    console.log('✅ File info retrieved via Netlify function:', fileInfo);
    
    return fileInfo;
  } catch (error) {
    console.error('Errore nel controllo del file via Netlify function:', error);
    throw error;
  }
};

/**
 * Carica l'informazione sul file salvata localmente
 */
export const getStoredFileInfo = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LAST_FILE);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Errore nel caricamento delle info file salvate:', error);
    return null;
  }
};

/**
 * Salva l'informazione sul file localmente
 */
export const saveFileInfo = (fileInfo) => {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_FILE, JSON.stringify({
      ...fileInfo,
      lastChecked: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Errore nel salvataggio delle info file:', error);
  }
};

/**
 * Controlla se il file è cambiato rispetto a quello salvato
 */
export const hasFileChanged = (currentFileInfo, storedFileInfo) => {
  if (!storedFileInfo) return true;
  
  // Controlla prima l'ETag (più affidabile)
  if (currentFileInfo.etag && storedFileInfo.etag) {
    console.log('Confronto ETag: ', currentFileInfo.etag !== storedFileInfo.etag);
    return currentFileInfo.etag !== storedFileInfo.etag;
  }
  
  // Fallback su Last-Modified
  if (currentFileInfo.lastModified && storedFileInfo.lastModified) {
    console.log('Confronto Last-Modified: ', currentFileInfo.lastModified !== storedFileInfo.lastModified);
    return currentFileInfo.lastModified !== storedFileInfo.lastModified;
  }
  
  // Fallback su Content-Length
  if (currentFileInfo.contentLength && storedFileInfo.contentLength) {
    console.log('Confronto Content-Length: ', currentFileInfo.contentLength !== storedFileInfo.contentLength);
    return currentFileInfo.contentLength !== storedFileInfo.contentLength;
  }
  
  // Se non abbiamo metadati sufficienti, assumiamo che sia cambiato
  return true;
};

/**
 * Controlla se la cache è ancora valida
 */
const isCacheValid = () => {
  try {
    const timestamp = localStorage.getItem(STORAGE_KEY_CACHE_TIMESTAMP);
    if (!timestamp) return false;
    
    const cacheDate = new Date(timestamp);
    const now = new Date();
    const hoursDiff = (now - cacheDate) / (1000 * 60 * 60);
    
    const isValid = hoursDiff < CACHE_EXPIRY_HOURS;
    console.log(`Cache age: ${hoursDiff.toFixed(1)} hours, valid: ${isValid}`);
    return isValid;
  } catch (error) {
    console.error('Errore nel controllo validità cache:', error);
    return false;
  }
};

/**
 * Salva i dati del file nella cache
 */
const saveCachedContent = (data, fileInfo) => {
  const cacheData = {
    data: data,
    fileInfo: fileInfo,
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
  
  try {
   
    const serialized = JSON.stringify(cacheData);
    
    // Controlla dimensione
    if (serialized.length > MAX_CACHE_SIZE) {
      console.warn('⚠️ Contenuto troppo grande per la cache, skip salvataggio');
      return false;
    }
    
    localStorage.setItem(STORAGE_KEY_FILE_CONTENT, serialized);
    localStorage.setItem(STORAGE_KEY_CACHE_TIMESTAMP, cacheData.timestamp);
    
    console.log('✅ Contenuto salvato nella cache, dimensione:', (serialized.length / 1024).toFixed(1), 'KB');
    return true;
  } catch (error) {
    console.error('Errore nel salvataggio della cache:', error);
    
    // Se è un errore di quota, prova a pulire cache vecchia
    if (error.name === 'QuotaExceededError') {
      console.log('🧹 Tentativo di pulizia cache per spazio...');
      clearCachedContent();
      
      // Riprova una volta
      try {
        localStorage.setItem(STORAGE_KEY_FILE_CONTENT, JSON.stringify(cacheData));
        localStorage.setItem(STORAGE_KEY_CACHE_TIMESTAMP, cacheData.timestamp);
        console.log('✅ Contenuto salvato nella cache dopo pulizia');
        return true;
      } catch (retryError) {
        console.error('❌ Impossibile salvare nella cache anche dopo pulizia:', retryError);
      }
    }
    
    return false;
  }
};

/**
 * Carica i dati del file dalla cache
 */
const loadCachedContent = () => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY_FILE_CONTENT);
    if (!cached) {
      console.log('📦 Nessun contenuto nella cache');
      return null;
    }
    
    const cacheData = JSON.parse(cached);
    
    // Verifica struttura
    if (!cacheData.data || !cacheData.timestamp) {
      console.warn('⚠️ Struttura cache corrotta, rimozione...');
      clearCachedContent();
      return null;
    }
    
    console.log('📦 Contenuto caricato dalla cache, timestamp:', cacheData.timestamp);
    return cacheData;
  } catch (error) {
    console.error('Errore nel caricamento della cache:', error);
    clearCachedContent(); // Pulisce cache corrotta
    return null;
  }
};

/**
 * Rimuove il contenuto dalla cache
 */
const clearCachedContent = () => {
  try {
    localStorage.removeItem(STORAGE_KEY_FILE_CONTENT);
    localStorage.removeItem(STORAGE_KEY_CACHE_TIMESTAMP);
    console.log('🧹 Cache contenuto pulita');
  } catch (error) {
    console.error('Errore nella pulizia cache:', error);
  }
};

/**
 * Scarica il file da GitHub
 */
const downloadFileContent = async () => {
  console.log('⬇️ Downloading file content from GitHub...');
  
  const response = await fetch("/.netlify/functions/download-data", {
    method: "GET",
    credentials: 'omit',
    cache: 'no-cache'
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Download failed: ${response.status} - ${errorData.error || response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  console.log('✅ File downloaded, size:', (arrayBuffer.byteLength / 1024).toFixed(1), 'KB');
  
  return arrayBuffer;
};

/**
 * Funzione principale per gestire il download e la cache
 */
export const checkAndUpdateDataset = async () => {
  try {
    console.log('🔍 Controllo aggiornamenti dataset...');
    
    // 1. Controlla info file remoto
    let currentFileInfo;
    try {
      currentFileInfo = await getFileInfo();
    } catch (error) {
      console.warn('⚠️ Impossibile controllare info file remoto:', error.message);
      
      // Prova a usare cache se disponibile
      const cachedData = loadCachedContent();
      if (cachedData && isCacheValid()) {
        console.log('📦 Usando dati dalla cache (remoto non disponibile)');
        return {
          datasetBuffer: cachedData.data, // Ora è già un ArrayBuffer
          fromCache: true,
          cacheAge: cachedData.timestamp
        };
      }
      
      throw new Error('Remoto non disponibile e nessuna cache valida');
    }
    
    // 2. Controlla cache locale
    const storedFileInfo = getStoredFileInfo();
    const cachedData = loadCachedContent();
    
    // 3. Determina se serve download
    const fileChanged = hasFileChanged(currentFileInfo, storedFileInfo);
    const cacheValid = isCacheValid();
    const hasCachedData = cachedData && cachedData.data;
    
    console.log('📊 Status check:', {
      fileChanged,
      cacheValid,
      hasCachedData,
      cacheTimestamp: cachedData?.timestamp,
      cacheSize: cachedData?.data ? (cachedData.data.byteLength / 1024).toFixed(1) + 'KB' : 'N/A'
    });
    
    // 4. Usa cache se file non cambiato e cache valida
    if (!fileChanged && cacheValid && hasCachedData) {
      console.log('✅ File non cambiato, usando cache');
      return {
        datasetBuffer: cachedData.data, // ArrayBuffer pronto all'uso
        fromCache: true,
        cacheAge: cachedData.timestamp
      };
    }
    
    // 5. Download necessario
    console.log('⬇️ Download necessario:', {
      reason: fileChanged ? 'File cambiato' : !cacheValid ? 'Cache scaduta' : 'Cache non disponibile'
    });
    
    const arrayBuffer = await downloadFileContent();
    
    // 6. Salva nella cache (ora gestisce correttamente l'ArrayBuffer)
    const cacheSuccess = saveCachedContent(arrayBuffer, currentFileInfo);
    
    // 7. Aggiorna metadati file
    saveFileInfo(currentFileInfo);
    
    console.log('✅ Dataset aggiornato con successo', {
      size: (arrayBuffer.byteLength / 1024).toFixed(1) + 'KB',
      cached: cacheSuccess
    });
    
    return {
      datasetBuffer: arrayBuffer,
      fromCache: false,
      downloadedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Errore nel controllo/aggiornamento dataset:', error);
    
    // Ultimo tentativo: usa cache anche se scaduta
    const cachedData = loadCachedContent();
    if (cachedData && cachedData.data) {
      console.log('📦 Usando cache scaduta come fallback');
      return {
        datasetBuffer: cachedData.data, // ArrayBuffer ripristinato dalla cache
        fromCache: true,
        cacheAge: cachedData.timestamp,
        expired: true
      };
    }
    
    throw error;
  }
};

/**
 * Ottiene informazioni sulla cache
 */
export const getCacheInfo = () => {
  try {
    const cached = loadCachedContent();
    const timestamp = localStorage.getItem(STORAGE_KEY_CACHE_TIMESTAMP);
    const fileInfo = getStoredFileInfo();
    
    if (!cached || !timestamp) {
      return { hasCache: false };
    }
    
    const cacheDate = new Date(timestamp);
    const now = new Date();
    const ageHours = (now - cacheDate) / (1000 * 60 * 60);
    
    return {
      hasCache: true,
      timestamp: timestamp,
      ageHours: ageHours,
      isValid: ageHours < CACHE_EXPIRY_HOURS,
      size: JSON.stringify(cached).length,
      fileInfo: fileInfo
    };
  } catch (error) {
    console.error('Errore nel recupero info cache:', error);
    return { hasCache: false, error: error.message };
  }
};

/**
 * Forza la pulizia completa della cache
 */
export const clearAllCache = () => {
  try {
    clearCachedContent();
    localStorage.removeItem(STORAGE_KEY_LAST_FILE);
    console.log('🧹 Tutta la cache è stata pulita');
    return true;
  } catch (error) {
    console.error('Errore nella pulizia completa cache:', error);
    return false;
  }
};

/**
 * Forza il re-download ignorando la cache
 */
export const forceRefresh = async () => {
  console.log('🔄 Forzando refresh del dataset...');
  clearAllCache();
  return await checkAndUpdateDataset();
};
