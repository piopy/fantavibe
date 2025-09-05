// utils/githubReleaseManager.js

const GITHUB_API_URL = 'https://api.github.com/repos/informagico/fantavibe-dataset/releases/latest';
const STORAGE_KEY_LAST_RELEASE = 'fantavibe_last_release_info';

/**
 * Ottiene informazioni sull'ultima release dal repository GitHub
 */
export const getLatestReleaseInfo = async () => {
  try {
    const response = await fetch(GITHUB_API_URL);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const releaseData = await response.json();
    
    return {
      tagName: releaseData.tag_name,
      publishedAt: releaseData.published_at,
      id: releaseData.id,
      // Usa sempre jsDelivr CDN - bypassa CORS
      downloadUrl: `https://cdn.jsdelivr.net/gh/informagico/fantavibe-dataset@${releaseData.tag_name}/fpedia_analysis.xlsx`
    };
  } catch (error) {
    console.error('Errore nel recupero delle informazioni sulla release:', error);
    throw error;
  }
};

/**
 * Carica l'informazione sulla release salvata localmente
 */
export const getStoredReleaseInfo = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LAST_RELEASE);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Errore nel caricamento delle info release salvate:', error);
    return null;
  }
};

/**
 * Salva l'informazione sulla release localmente
 */
export const saveReleaseInfo = (releaseInfo) => {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_RELEASE, JSON.stringify({
      ...releaseInfo,
      lastChecked: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Errore nel salvataggio delle info release:', error);
  }
};

/**
 * Controlla se c'è una nuova release disponibile
 */
export const hasNewRelease = (currentRelease, storedRelease) => {
  if (!storedRelease) return true;
  return currentRelease.id !== storedRelease.id;
};

/**
 * Scarica il dataset usando jsDelivr CDN (no CORS)
 */
export const downloadDatasetFromCDN = async (cdnUrl) => {
  try {
    console.log('Scaricando da CDN:', cdnUrl);
    
    const response = await fetch(cdnUrl);
    if (!response.ok) {
      throw new Error(`CDN download failed: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('✅ Download CDN riuscito:', arrayBuffer.byteLength, 'bytes');
    return arrayBuffer;
  } catch (error) {
    console.error('Errore download CDN:', error);
    throw error;
  }
};

/**
 * Funzione principale semplificata
 */
export const checkAndUpdateDataset = async () => {
  try {
    console.log('Controllo aggiornamenti...');
    
    // 1. Ottieni info release
    const latestRelease = await getLatestReleaseInfo();
    
    // 2. Controlla se serve aggiornare
    const storedRelease = getStoredReleaseInfo();
    const needsUpdate = hasNewRelease(latestRelease, storedRelease);
    
    console.log('Release corrente:', latestRelease.tagName);
    console.log('Release salvata:', storedRelease?.tagName || 'Nessuna');
    console.log('Aggiornamento necessario:', needsUpdate);
    
    if (needsUpdate) {
      // Scarica da CDN
      const datasetBuffer = await downloadDatasetFromCDN(latestRelease.downloadUrl);
      
      // Salva info release
      saveReleaseInfo(latestRelease);
      
      return {
        datasetBuffer,
        wasUpdated: true,
        releaseInfo: latestRelease
      };
    } else {
      return {
        datasetBuffer: null,
        wasUpdated: false,
        releaseInfo: latestRelease
      };
    }
    
  } catch (error) {
    console.error('Errore controllo aggiornamenti:', error);
    throw error;
  }
};
