const STORAGE_KEY_LAST_FILE = 'fantavibe_last_file_info';

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
 * Funzione principale per controllo e aggiornamento dataset
 */
export const checkAndUpdateDataset = async () => {
  try {
    console.log('Controllo se il file è cambiato via Netlify functions...');
    
    // 1. Ottieni info file corrente via Netlify function
    const currentFileInfo = await getFileInfo();
    
    // 2. Controlla se serve aggiornare
    const storedFileInfo = getStoredFileInfo();
    const needsUpdate = hasFileChanged(currentFileInfo, storedFileInfo);
    
    console.log('Info file corrente:', currentFileInfo);
    console.log('Info file salvato:', storedFileInfo);
    console.log('Aggiornamento necessario:', needsUpdate);
    
    if (needsUpdate) {
      console.log('File cambiato, scarico la nuova versione via Netlify function...');
      
      // Scarica via Netlify function
      const { arrayBuffer, fileInfo } = await downloadDatasetFromGitHub();
      
      // Salva info file (aggiorna con quelle del download se disponibili)
      const finalFileInfo = {
        ...currentFileInfo,
        ...fileInfo // Sovrascrive con le info dal download se presenti
      };
      saveFileInfo(finalFileInfo);
      
      return {
        datasetBuffer: arrayBuffer,
        wasUpdated: true,
        fileInfo: finalFileInfo
      };
    } else {
      console.log('File non cambiato, uso quello in cache locale');
      return {
        datasetBuffer: null,
        wasUpdated: false,
        fileInfo: currentFileInfo
      };
    }
    
  } catch (error) {
    console.error('Errore controllo aggiornamenti via Netlify functions:', error);
    throw error;
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
