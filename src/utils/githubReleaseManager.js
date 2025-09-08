const STORAGE_KEY_LAST_FILE = 'fantavibe_last_file_info';
const STORAGE_KEY_FILE_CONTENT = 'fantavibe_file_content'; // NUOVO: per salvare il contenuto

/**
 * Ottiene l'ETag o altre info di cache del file
 */
export const getFileInfo = async () => {
  try {
    console.log('Getting file info via Netlify function...');
    
    // Chiamata alla Netlify function invece del fetch diretto
    const response = await fetch("/.netlify/functions/get-file-info", {
      method: "GET",
      credentials: 'omit', // Explicitly omit credentials
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
 * NUOVO: Salva il contenuto del file nel localStorage
 */
export const saveFileContent = (arrayBuffer) => {
  try {
    // Converte ArrayBuffer in Base64 per salvarlo nel localStorage
    const bytes = new Uint8Array(arrayBuffer);
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binary);
    
    const cacheData = {
      content: base64,
      savedAt: new Date().toISOString(),
      size: arrayBuffer.byteLength
    };
    
    localStorage.setItem(STORAGE_KEY_FILE_CONTENT, JSON.stringify(cacheData));
    console.log(`💾 Contenuto file salvato in cache (${arrayBuffer.byteLength} bytes)`);
  } catch (error) {
    console.error('Errore nel salvataggio del contenuto file:', error);
    // Se il file è troppo grande per localStorage, rimuovi la cache esistente
    if (error.name === 'QuotaExceededError') {
      console.warn('File troppo grande per localStorage, rimuovo cache esistente');
      localStorage.removeItem(STORAGE_KEY_FILE_CONTENT);
    }
  }
};

/**
 * NUOVO: Carica il contenuto del file dal localStorage
 */
export const getStoredFileContent = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FILE_CONTENT);
    if (!stored) return null;
    
    const cacheData = JSON.parse(stored);
    
    // Controlla se la cache non è troppo vecchia (es. massimo 7 giorni)
    const savedAt = new Date(cacheData.savedAt);
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 giorni in millisecondi
    const isExpired = Date.now() - savedAt.getTime() > maxAge;
    
    if (isExpired) {
      console.log('🕒 Cache contenuto file scaduta, rimuovo');
      localStorage.removeItem(STORAGE_KEY_FILE_CONTENT);
      return null;
    }
    
    // Converte Base64 back ad ArrayBuffer
    const binary = atob(cacheData.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    console.log(`📁 Contenuto file caricato dalla cache (${bytes.buffer.byteLength} bytes)`);
    return bytes.buffer;
  } catch (error) {
    console.error('Errore nel caricamento del contenuto file dalla cache:', error);
    // Se c'è un errore, rimuovi la cache corrotta
    localStorage.removeItem(STORAGE_KEY_FILE_CONTENT);
    return null;
  }
};

/**
 * NUOVO: Controlla se la cache del contenuto è valida
 */
export const isCacheValid = (storedFileInfo) => {
  if (!storedFileInfo) return false;
  
  // Controlla se abbiamo anche il contenuto salvato
  const hasContent = localStorage.getItem(STORAGE_KEY_FILE_CONTENT) !== null;
  if (!hasContent) return false;
  
  // Controlla se la cache non è troppo vecchia
  const lastChecked = new Date(storedFileInfo.lastChecked || 0);
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 giorni
  const isExpired = Date.now() - lastChecked.getTime() > maxAge;
  
  return !isExpired;
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
  
  // Se non abbiamo info sufficienti, considera cambiato
  return true;
};

/**
 * Scarica il dataset direttamente dall'URL specificato
 * Versione ottimizzata per compatibilità CORS con Firefox
 * Continua ad usare la funzione download-data esistente
 */
export const downloadDatasetFromGitHub = async () => {
  try {
    console.log('Scaricando direttamente via Netlify function...');
    
    // Usa la funzione Netlify esistente per il download
    const response = await fetch("/.netlify/functions/download-data", {
      method: "GET",
      credentials: 'omit',
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      if (response.status === 0) {
        throw new Error('Network error or CORS blocked the request');
      }
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    // Directly get arrayBuffer since Netlify will decode base64 for us
    const arrayBuffer = await response.arrayBuffer();
    console.log('✅ Download riuscito via Netlify function:', arrayBuffer.byteLength, 'bytes');
    
    // Ottieni anche le info del file dalla risposta
    const fileInfo = {
      etag: response.headers.get('etag') || response.headers.get('ETag'),
      lastModified: response.headers.get('last-modified') || response.headers.get('Last-Modified'),
      contentLength: response.headers.get('content-length') || response.headers.get('Content-Length'),
      timestamp: new Date().toISOString()
    };
    
    return { arrayBuffer, fileInfo };
  } catch (error) {
    console.error('Errore download via Netlify function:', error);
    
    // More detailed error reporting for debugging
    if (error.message.includes('CORS') || error.message.includes('Network error')) {
      console.error('Network Error Details:', {
        userAgent: navigator.userAgent,
        origin: window.location.origin,
        url: "/.netlify/functions/download-data"
      });
    }
    
    throw error;
  }
};

/**
 * NUOVO: Carica il file da public come fallback finale
 */
export const loadFromPublicFallback = async () => {
  try {
    console.log('📁 Caricando file di fallback da public...');
    const response = await fetch('/fpedia_analysis.xlsx');
    
    if (!response.ok) {
      throw new Error(`File pubblico non trovato: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('✅ File caricato da public:', arrayBuffer.byteLength, 'bytes');
    
    return arrayBuffer;
  } catch (error) {
    console.error('Errore caricamento file da public:', error);
    throw error;
  }
};

/**
 * AGGIORNATA: Funzione principale per controllo e aggiornamento dataset
 * Ora con logica di cache del contenuto e fallback multipli
 */
export const checkAndUpdateDataset = async () => {
  try {
    console.log('🔄 Avvio controllo dataset con cache avanzata...');
    
    // 1. Prova a ottenere info file corrente da GitHub
    let currentFileInfo = null;
    let canCheckGitHub = true;
    
    try {
      currentFileInfo = await getFileInfo();
    } catch (error) {
      console.warn('⚠️ Non riesco a controllare GitHub:', error.message);
      canCheckGitHub = false;
    }
    
    // 2. Carica info file salvato e controlla cache
    const storedFileInfo = getStoredFileInfo();
    console.log('Info file corrente:', currentFileInfo);
    console.log('Info file salvato:', storedFileInfo);
    
    // 3. Determina se serve scaricare
    let needsDownload = true;
    
    if (canCheckGitHub && currentFileInfo && storedFileInfo) {
      needsDownload = hasFileChanged(currentFileInfo, storedFileInfo);
      console.log('File cambiato:', needsDownload);
    } else if (!canCheckGitHub && storedFileInfo) {
      // Se non posso controllare GitHub, uso la cache se valida
      const cacheIsValid = isCacheValid(storedFileInfo);
      needsDownload = !cacheIsValid;
      console.log('Cache valida (GitHub non raggiungibile):', cacheIsValid);
    }
    
    // 4. Se non serve scaricare, prova a usare la cache
    if (!needsDownload) {
      console.log('📦 Uso contenuto dalla cache...');
      const cachedContent = getStoredFileContent();
      
      if (cachedContent) {
        return {
          datasetBuffer: cachedContent,
          wasUpdated: false,
          source: 'cache',
          fileInfo: storedFileInfo
        };
      } else {
        console.log('⚠️ Cache info presente ma contenuto mancante, forzo download');
        needsDownload = true;
      }
    }
    
    // 5. Prova a scaricare da GitHub
    if (needsDownload && canCheckGitHub) {
      try {
        console.log('⬇️ Scarico nuova versione da GitHub...');
        const { arrayBuffer, fileInfo } = await downloadDatasetFromGitHub();
        
        // Salva sia le info che il contenuto
        const finalFileInfo = {
          ...currentFileInfo,
          ...fileInfo
        };
        saveFileInfo(finalFileInfo);
        saveFileContent(arrayBuffer);
        
        return {
          datasetBuffer: arrayBuffer,
          wasUpdated: true,
          source: 'github',
          fileInfo: finalFileInfo
        };
      } catch (downloadError) {
        console.warn('⚠️ Download da GitHub fallito:', downloadError.message);
        // Continua con i fallback...
      }
    }
    
    // 6. FALLBACK 1: Prova a usare cache esistente (anche se "scaduta")
    if (storedFileInfo) {
      console.log('🔄 Tentativo fallback: uso cache esistente...');
      const cachedContent = getStoredFileContent();
      
      if (cachedContent) {
        console.log('✅ Usando cache esistente come fallback');
        return {
          datasetBuffer: cachedContent,
          wasUpdated: false,
          source: 'cache_fallback',
          fileInfo: storedFileInfo
        };
      }
    }
    
    // 7. FALLBACK 2: Carica da public
    console.log('🚨 Ultimo tentativo: carico da cartella public...');
    const publicArrayBuffer = await loadFromPublicFallback();
    
    // Non salviamo la cache per il file da public perché è un fallback
    return {
      datasetBuffer: publicArrayBuffer,
      wasUpdated: false,
      source: 'public_fallback',
      fileInfo: null
    };
    
  } catch (error) {
    console.error('❌ Tutti i tentativi di caricamento falliti:', error);
    throw new Error(`Impossibile caricare il dataset: ${error.message}`);
  }
};

// Manteniamo compatibilità con le funzioni esistenti per non rompere il codice
export const getLatestReleaseInfo = async () => {
  const fileInfo = await getFileInfo();
  return {
    tagName: `File diretto ${fileInfo.timestamp}`,
    publishedAt: fileInfo.lastModified || fileInfo.timestamp,
    id: fileInfo.etag || fileInfo.contentLength || Date.now(),
    downloadUrl: process.env.REACT_APP_DIRECT_FILE_URL
  };
};

export const getStoredReleaseInfo = getStoredFileInfo;
export const saveReleaseInfo = saveFileInfo;
export const hasNewRelease = hasFileChanged;
