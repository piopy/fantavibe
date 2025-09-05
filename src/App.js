// App.js
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import FantamilioniModal from './components/FantamilioniModal';
import Header from './components/Header';
import PlayersTab from './components/PlayersTab';
import RosaAcquistata from './components/RosaAcquistata';
import { normalizePlayerData } from './utils/dataUtils';
import { checkAndUpdateDataset, downloadDatasetFromGitHub } from './utils/githubReleaseManager';
import { getTotalFantamilioni, loadBudget, loadPlayerStatus, saveBudget, savePlayerStatus, updatePlayerStatus } from './utils/storage';

const App = () => {
  // Stati principali
  const [fpediaData, setFpediaData] = useState([]);
  const [playerStatus, setPlayerStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('giocatori');

  // Stato del budget
  const [budget, setBudget] = useState(500);

  // Flag per evitare salvataggi durante l'inizializzazione
  const [isInitialized, setIsInitialized] = useState(false);

  // Stati per la modal fantamilioni
  const [showFantamilioniModal, setShowFantamilioniModal] = useState(false);
  const [playerToAcquire, setPlayerToAcquire] = useState(null);

  // Stati per il monitoraggio aggiornamenti
  const [updateStatus, setUpdateStatus] = useState({
    isChecking: false,
    lastUpdate: null,
    currentVersion: null,
    error: null
  });

  // Carica status giocatori all'avvio
  useEffect(() => {
    const status = loadPlayerStatus();
    const savedBudget = loadBudget();
    
    console.log('Caricamento status iniziale:', Object.keys(status).length, 'giocatori');
    console.log('Budget salvato:', savedBudget);
    
    setPlayerStatus(status);
    setBudget(savedBudget);
    setIsInitialized(true);
  }, []);

  // Carica i dati all'avvio e quando cambia isInitialized
  useEffect(() => {
    if (isInitialized) {
      loadData();
    }
  }, [isInitialized]);

  // Salva il budget quando cambia (solo dopo l'inizializzazione)
  useEffect(() => {
    if (isInitialized) {
      saveBudget(budget);
      console.log('Budget salvato:', budget);
    }
  }, [budget, isInitialized]);

  // Salva status giocatori quando cambia (solo dopo l'inizializzazione)
  useEffect(() => {
    if (isInitialized) {
      savePlayerStatus(playerStatus);
      console.log('Status giocatori salvato:', Object.keys(playerStatus).length, 'giocatori');
    }
  }, [playerStatus, isInitialized]);

  // Funzione per caricare i dati con il nuovo sistema di download diretto
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    setUpdateStatus(prev => ({
      ...prev,
      isChecking: true,
      error: null
    }));

    try {
      console.log('🔄 Inizio controllo aggiornamenti...');
      
      // Controlla se il file è cambiato e scarica se necessario
      const updateResult = await checkAndUpdateDataset();
      
      if (updateResult.wasUpdated) {
        console.log('📦 File aggiornato, carico nuovi dati...');
        
        // Usa i nuovi dati scaricati
        const workbook = XLSX.read(updateResult.datasetBuffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        setFpediaData(jsonData);
        setUpdateStatus({
          isChecking: false,
          lastUpdate: new Date().toISOString(),
          currentVersion: `Aggiornato ${new Date().toLocaleString()}`,
          error: null
        });
        
        console.log('✅ Dataset aggiornato con successo');
        return;
        
      } else {
        console.log('📋 File non cambiato, carico da cache locale...');
        
        // Prova a caricare da public come fallback
        try {
          const response = await fetch('/fpedia_analysis.xlsx');
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const workbook = XLSX.read(buffer);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            
            setFpediaData(jsonData);
            setUpdateStatus({
              isChecking: false,
              lastUpdate: new Date().toISOString(),
              currentVersion: 'File locale (nessun aggiornamento necessario)',
              error: null
            });
            
            console.log('✅ Caricato da file locale');
          } else {
            throw new Error('File locale non trovato');
          }
        } catch (localError) {
          // Se anche il file locale fallisce, forza il download
          console.log('🔄 File locale non disponibile, forzo download...');
          
          const { arrayBuffer } = await downloadDatasetFromGitHub();
          const workbook = XLSX.read(arrayBuffer);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          
          setFpediaData(jsonData);
          setUpdateStatus({
            isChecking: false,
            lastUpdate: new Date().toISOString(),
            currentVersion: `Download forzato ${new Date().toLocaleString()}`,
            error: null
          });
          
          console.log('✅ Download forzato completato');
        }
      }
      
    } catch (error) {
      console.error('❌ Errore nel caricamento dati:', error);
      setError(`Errore nel caricamento: ${error.message}`);
      setUpdateStatus(prev => ({
        ...prev,
        isChecking: false,
        error: error.message
      }));
    } finally {
      setLoading(false);
    }
  };

  // Funzione per forzare l'aggiornamento
  const forceUpdate = () => {
    loadData();
  };

  // Normalizza i dati per l'utilizzo nell'app
  const normalizedData = useMemo(() => {
    if (!fpediaData || fpediaData.length === 0) return [];
    return normalizePlayerData(fpediaData);
  }, [fpediaData]);

  // Crea indice di ricerca
  const searchIndex = useMemo(() => {
    if (!normalizedData || normalizedData.length === 0) return [];
    
    return normalizedData.map((player, index) => ({
      ...player,
      originalIndex: index,
      searchableText: [
        player.nome,
        player.ruolo,
        player.squadra,
        // Aggiungi altri campi ricercabili se necessario
      ].filter(Boolean).join(' ').toLowerCase()
    }));
  }, [normalizedData]);

  // Handler per cambiare tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Handler per cambiare status giocatore
  const handlePlayerStatusChange = (playerId, status) => {
    setPlayerStatus(prev => updatePlayerStatus(prev, playerId, status));
  };

  // Handler per acquisire giocatore (apre modal)
  const handlePlayerAcquire = (player) => {
    setPlayerToAcquire(player);
    setShowFantamilioniModal(true);
  };

  // Handler per conferma fantamilioni
  const handleFantamilioniConfirm = (fantamilioni) => {
    if (playerToAcquire) {
      const totalSpent = getTotalFantamilioni(playerStatus);
      const newTotal = totalSpent + fantamilioni;
      
      if (newTotal > budget) {
        alert(`Budget insufficiente! Hai ${budget - totalSpent} FM disponibili.`);
        return;
      }

      setPlayerStatus(prev => updatePlayerStatus(prev, playerToAcquire.id, 'acquired', fantamilioni));
      setShowFantamilioniModal(false);
      setPlayerToAcquire(null);
    }
  };

  // Handler per rimuovere giocatore dalla rosa
  const handlePlayerRemove = (playerId) => {
    setPlayerStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[playerId];
      return newStatus;
    });
  };

  // Handler per modificare fantamilioni
  const handleEditFantamilioni = (playerId, newFantamilioni) => {
    setPlayerStatus(prev => updatePlayerStatus(prev, playerId, 'acquired', newFantamilioni));
  };

  // Handler per cambiare budget
  const handleBudgetChange = (newBudget) => {
    setBudget(newBudget);
  };

  // Stili per la navigazione tab
  const tabNavigationStyle = {
    display: 'flex',
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0',
    marginBottom: '1rem'
  };

  const tabButtonStyle = (isActive) => ({
    flex: 1,
    padding: '0.75rem 1rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: isActive ? '#3b82f6' : '#64748b',
    fontWeight: isActive ? '600' : '400',
    borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <Header
        dataCount={normalizedData.length}
        playerStatus={playerStatus}
        budget={budget}
        onBudgetChange={handleBudgetChange}
      />

      {/* Informazioni stato aggiornamento */}
      {updateStatus.currentVersion && (
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #7dd3fc',
          padding: '0.5rem 1rem',
          margin: '0 auto',
          maxWidth: '1200px',
          fontSize: '0.75rem',
          color: '#0369a1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>📊 Versione: {updateStatus.currentVersion}</span>
          {updateStatus.lastUpdate && (
            <span>🕒 Ultimo controllo: {new Date(updateStatus.lastUpdate).toLocaleString()}</span>
          )}
        </div>
      )}

      {updateStatus.error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          padding: '0.5rem 1rem',
          margin: '0 auto',
          maxWidth: '1200px',
          fontSize: '0.75rem',
          color: '#dc2626'
        }}>
          ⚠️ {updateStatus.error}
        </div>
      )}

      {/* Contenuto principale */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '1rem'
      }}>
        {/* Navigazione Tab */}
        {!loading && !error && normalizedData.length > 0 && (
          <div style={tabNavigationStyle}>
            <button
              style={tabButtonStyle(activeTab === 'giocatori')}
              onClick={() => handleTabChange('giocatori')}
            >
              🔍 Giocatori
            </button>
            <button
              style={tabButtonStyle(activeTab === 'rosa')}
              onClick={() => handleTabChange('rosa')}
            >
              ⭐ La Mia Rosa
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '3rem',
            fontSize: '1.125rem',
            color: '#64748b'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '4px solid #e2e8f0',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem auto'
              }} />
              {updateStatus.isChecking ? 'Controllo aggiornamenti dataset...' : 'Caricamento dati in corso...'}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '2rem',
            margin: '2rem auto',
            maxWidth: '600px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#dc2626',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Errore di caricamento
            </div>
            <div style={{ marginBottom: '1rem' }}>{error}</div>
            <button
              onClick={forceUpdate}
              style={{
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer'
              }}
            >
              Riprova
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && normalizedData.length === 0 && (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            fontSize: '1.125rem',
            color: '#64748b'
          }}>
            <div style={{ marginBottom: '1rem', fontSize: '3rem' }}>📊</div>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              Benvenuto in Fantavibe!
            </div>
            <div>Carica i dati per iniziare.</div>
          </div>
        )}

        {/* Content tabs */}
        {!loading && !error && normalizedData.length > 0 && (
          <>
            {activeTab === 'giocatori' && (
              <PlayersTab
                players={normalizedData}
                searchIndex={searchIndex}
                playerStatus={playerStatus}
                onStatusChange={handlePlayerStatusChange}
                onPlayerAcquire={handlePlayerAcquire}
                budget={budget}
              />
            )}

            {activeTab === 'rosa' && (
              <RosaAcquistata
                players={normalizedData}
                playerStatus={playerStatus}
                budget={budget}
                onPlayerRemove={handlePlayerRemove}
                onEditFantamilioni={handleEditFantamilioni}
              />
            )}
          </>
        )}
      </div>

      {/* Modal Fantamilioni */}
      {showFantamilioniModal && (
        <FantamilioniModal
          player={playerToAcquire}
          onConfirm={handleFantamilioniConfirm}
          onCancel={() => {
            setShowFantamilioniModal(false);
            setPlayerToAcquire(null);
          }}
          budget={budget}
          currentSpent={getTotalFantamilioni(playerStatus)}
        />
      )}

      {/* CSS per l'animazione di loading */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
