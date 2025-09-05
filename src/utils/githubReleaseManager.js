// utils/githubReleaseManager.js

const DIRECT_FILE_URL = 'https://github.com/informagico/fantavibe-dataset/blob/release/latest_fpedia_analysis.xlsx?raw=true';
const STORAGE_KEY_LAST_FILE = 'fantavibe_last_file_info';

/**
 * Ottiene l'ETag o altre info di cache del file diretto
 */
export const getFileInfo = async () => {
  try {
    // Facciamo una richiesta HEAD per ottenere solo gli headers
    const response = await fetch(DIRECT_FILE_URL, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'FantaVibe-App'
      }
    });
    
    if (!response.ok) {
      throw new Error(`File check error: ${response.status}`);
    }
    
    return {
      etag: response.headers.get('etag') || response.headers.get('ETag'),
      lastModified: response.headers.get('last-modified') || response.headers.get('Last-Modified'),
      contentLength: response.headers.get('content-length') || response.headers.get('Content-Length'),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Errore nel controllo del file:', error);
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
    return currentFileInfo.etag !== storedFileInfo.etag;
  }
  
  // Fallback su Last-Modified
  if (currentFileInfo.lastModified && storedFileInfo.lastModified) {
    return currentFileInfo.lastModified !== storedFileInfo.lastModified;
  }
  
  // Fallback su Content-Length
  if (currentFileInfo.contentLength && storedFileInfo.contentLength) {
    return currentFileInfo.contentLength !== storedFileInfo.contentLength;
  }
  
  // Se non abbiamo info sufficienti, considera cambiato
  return true;
};

/**
 * Scarica il dataset direttamente dall'URL specificato
 */
export const downloadDatasetFromGitHub = async () => {
  try {
    console.log('Scaricando direttamente da:', DIRECT_FILE_URL);
    
    const response = await fetch(DIRECT_FILE_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'User-Agent': 'FantaVibe-App'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('✅ Download riuscito:', arrayBuffer.byteLength, 'bytes');
    
    // Ottieni anche le info del file dalla risposta
    const fileInfo = {
      etag: response.headers.get('etag') || response.headers.get('ETag'),
      lastModified: response.headers.get('last-modified') || response.headers.get('Last-Modified'),
      contentLength: response.headers.get('content-length') || response.headers.get('Content-Length'),
      timestamp: new Date().toISOString()
    };
    
    return { arrayBuffer, fileInfo };
  } catch (error) {
    console.error('Errore download diretto:', error);
    throw error;
  }
};

/**
 * Funzione principale per controllo e aggiornamento dataset
 */
export const checkAndUpdateDataset = async () => {
  try {
    console.log('Controllo se il file è cambiato...');
    
    // 1. Ottieni info file corrente
    const currentFileInfo = await getFileInfo();
    
    // 2. Controlla se serve aggiornare
    const storedFileInfo = getStoredFileInfo();
    const needsUpdate = hasFileChanged(currentFileInfo, storedFileInfo);
    
    console.log('Info file corrente:', currentFileInfo);
    console.log('Info file salvato:', storedFileInfo);
    console.log('Aggiornamento necessario:', needsUpdate);
    
    if (needsUpdate) {
      console.log('File cambiato, scarico la nuova versione...');
      
      // Scarica direttamente
      const { arrayBuffer, fileInfo } = await downloadDatasetFromGitHub();
      
      // Salva info file
      saveFileInfo(fileInfo);
      
      return {
        datasetBuffer: arrayBuffer,
        wasUpdated: true,
        fileInfo: fileInfo
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
    console.error('Errore controllo aggiornamenti:', error);
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
    downloadUrl: DIRECT_FILE_URL
  };
};

export const getStoredReleaseInfo = getStoredFileInfo;
export const saveReleaseInfo = saveFileInfo;
export const hasNewRelease = hasFileChanged;
