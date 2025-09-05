// App.js - Fixed version
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
    
    // Carica i dati all'avvio
    loadData();
  }, []);

  // Salva dati quando cambiano (solo dopo inizializzazione)
  useEffect(() => {
    if (isInitialized) {
      savePlayerStatus(playerStatus);
      console.log('Status giocatori salvato:', Object.keys(playerStatus).length, 'giocatori');
    }
  }, [playerStatus, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      saveBudget(budget);
      console.log('Budget salvato:', budget);
    }
  }, [budget, isInitialized]);

  // Funzione per caricare i dati
  const loadData = async () => {
    setLoading(true);
    setError(null);
    setUpdateStatus(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      console.log('🚀 Inizio caricamento dati...');
      
      // Prima verifica se ci sono aggiornamenti
      const updateResult = await checkAndUpdateDataset();
      
      setUpdateStatus(prev => ({
        ...prev,
        lastUpdate: updateResult.lastUpdate,
        currentVersion: updateResult.currentVersion,
        isChecking: false
      }));

      // Poi carica i dati (da file locale o scaricato)
      let data;
      
      try {
        // Prova prima a scaricare l'ultima versione
        data = await downloadDatasetFromGitHub();
        console.log('✅ Dati scaricati da GitHub, giocatori trovati:', data?.length || 0);
      } catch (downloadError) {
        console.warn('⚠️ Fallback a file locale:', downloadError.message);
        
        // Fallback: carica file locale
        const response = await fetch('/fpedia_analysis.xlsx');
        if (!response.ok) throw new Error('File locale non trovato');
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const sheetName = workbook.SheetNames[0];
        data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log('📁 Dati caricati da file locale, giocatori:', data?.length || 0);
      }

      if (!data || data.length === 0) {
        throw new Error('Nessun dato trovato nel file');
      }

      setFpediaData(data);
      console.log('✅ Caricamento completato con successo');

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
  const normalizedDataResult = useMemo(() => {
    if (!fpediaData || fpediaData.length === 0) return { players: [], searchIndex: new Map() };
    return normalizePlayerData(fpediaData);
  }, [fpediaData]);

  // Estrai players e searchIndex dal risultato
  const normalizedData = normalizedDataResult.players || [];
  const searchIndexFromNormalization = normalizedDataResult.searchIndex || new Map();

  // Crea indice di ricerca per componenti legacy (se necessario)
  const searchIndex = useMemo(() => {
    if (!normalizedData || normalizedData.length === 0) return [];
    
    return normalizedData.map((player, index) => ({
      ...player,
      originalIndex: index,
      searchableText: [
        player.Nome, // Corretto: usa Nome con maiuscola
        player.Ruolo,
        player.Squadra,
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
    color: isActive ? '#3b82f6' : '#6b7280',
    borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '500',
    transition: 'all 0.2s'
  });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc'
    }}>
      {/* Header */}
      <Header
        budget={budget}
        onBudgetChange={handleBudgetChange}
        playerStatus={playerStatus}
        onRefreshData={forceUpdate}
        updateStatus={updateStatus}
      />

      {/* Navigation tabs */}
      {!loading && !error && normalizedData.length > 0 && (
        <div style={tabNavigationStyle}>
          <button
            style={tabButtonStyle(activeTab === 'giocatori')}
            onClick={() => handleTabChange('giocatori')}
          >
            🏆 Giocatori
          </button>
          <button
            style={tabButtonStyle(activeTab === 'rosa')}
            onClick={() => handleTabChange('rosa')}
          >
            👥 Rosa Acquistata
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        {/* Loading */}
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '1.5rem'
            }} />
            <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
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
                searchIndex={searchIndexFromNormalization} // Usa il searchIndex corretto
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
