// App.js
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import FantamilioniModal from './components/FantamilioniModal';
import Header from './components/Header';
import PlayersTab from './components/PlayersTab';
import RosaAcquistata from './components/RosaAcquistata';
import { normalizePlayerData } from './utils/dataUtils';
import { checkAndUpdateDataset } from './utils/githubReleaseManager';
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
    
    console.log('Caricamento iniziale - Stato trovato:', Object.keys(status).length, 'giocatori');
    console.log('Caricamento iniziale - Budget trovato:', savedBudget);
    
    setPlayerStatus(status);
    setBudget(savedBudget);
    
    // Segna come inizializzato DOPO aver caricato i dati
    setIsInitialized(true);
    
    // Avvia il controllo automatico degli aggiornamenti
    loadDataWithUpdateCheck();
  }, []);

  // Salva automaticamente lo status dei giocatori
  useEffect(() => {
    // Non salvare durante l'inizializzazione
    if (!isInitialized) {
      console.log('Salvataggio saltato - app non ancora inizializzata');
      return;
    }
    
    console.log('Salvando stato giocatori:', Object.keys(playerStatus).length, 'giocatori');
    savePlayerStatus(playerStatus);
  }, [playerStatus, isInitialized]);

  // Salva automaticamente il budget
  useEffect(() => {
    // Non salvare durante l'inizializzazione
    if (!isInitialized) {
      console.log('Salvataggio budget saltato - app non ancora inizializzata');
      return;
    }
    
    console.log('Salvando budget:', budget);
    saveBudget(budget);
  }, [budget, isInitialized]);

  // Funzione semplificata per il caricamento
  const loadDataWithUpdateCheck = async () => {
    setLoading(true);
    setError(null);
    setUpdateStatus(prev => ({ ...prev, isChecking: true, error: null }));
    
    try {
      // Prova GitHub + CDN
      console.log('Controllo aggiornamenti...');
      const updateResult = await checkAndUpdateDataset();
      
      if (updateResult.datasetBuffer) {
        // Nuovo dataset scaricato
        const workbook = XLSX.read(updateResult.datasetBuffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        setFpediaData(jsonData);
        setUpdateStatus({
          isChecking: false,
          lastUpdate: new Date().toISOString(),
          currentVersion: updateResult.releaseInfo.tagName,
          error: null
        });
        
        console.log('✅ Dataset aggiornato alla versione:', updateResult.releaseInfo.tagName);
        return;
      } else {
        // Nessun aggiornamento necessario, carica da public
        console.log('Nessun aggiornamento, carico da public...');
        throw new Error('fallback_to_public');
      }
      
    } catch (gitHubError) {
      console.warn('GitHub fallito, uso file locale:', gitHubError.message);
      
      // Fallback: carica da public
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
            currentVersion: 'File locale',
            error: 'Usando file locale (GitHub non disponibile)'
          });
          
          console.log('✅ Caricato da file locale');
        } else {
          throw new Error('File locale non trovato');
        }
      } catch (localError) {
        setError('Impossibile caricare il dataset né da GitHub né localmente');
        setUpdateStatus({
          isChecking: false,
          lastUpdate: null,
          currentVersion: null,
          error: `GitHub: ${gitHubError.message}, Locale: ${localError.message}`
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Funzione per forzare il controllo
  const forceUpdate = async () => {
    await loadDataWithUpdateCheck();
  };

  // Normalizza i dati e crea indice di ricerca
  const normalizedDataWithIndex = useMemo(() => {
    if (!fpediaData.length) return { players: [], searchIndex: null };
    return normalizePlayerData(fpediaData);
  }, [fpediaData]);

  const normalizedData = normalizedDataWithIndex.players;
  const searchIndex = normalizedDataWithIndex.searchIndex;

  // Gestione status giocatori
  const handlePlayerStatusChange = (playerId, status, fantamilioni = null) => {
    console.log('Cambiamento stato giocatore:', playerId, status, fantamilioni);
    const newStatus = updatePlayerStatus(playerStatus, playerId, status, fantamilioni);
    setPlayerStatus(newStatus);
  };

  // Gestione acquisto giocatore con fantamilioni
  const handlePlayerAcquire = (player) => {
    setPlayerToAcquire(player);
    setShowFantamilioniModal(true);
  };

  const handleFantamilioniConfirm = (fantamilioni) => {
    if (playerToAcquire) {
      // Controllo budget
      const totalSpent = getTotalFantamilioni(playerStatus);
      if (totalSpent + fantamilioni > budget) {
        alert(`Non hai abbastanza fantamilioni! Disponibili: ${budget - totalSpent} FM`);
        return;
      }

      handlePlayerStatusChange(playerToAcquire.id, 'acquistato', fantamilioni);
      setShowFantamilioniModal(false);
      setPlayerToAcquire(null);
    }
  };

  // Gestione cancellazione acquisto
  const handlePlayerRemove = (playerId) => {
    if (window.confirm('Sei sicuro di voler rimuovere questo giocatore dalla rosa?')) {
      handlePlayerStatusChange(playerId, 'disponibile', null);
    }
  };

  // Gestione modifica fantamilioni
  const handleEditFantamilioni = (playerId, newFantamilioni) => {
    handlePlayerStatusChange(playerId, 'acquistato', newFantamilioni);
  };

  // Configurazione delle tab
  const tabs = [
    { id: 'giocatori', label: 'Giocatori', emoji: '⚽' },
    { id: 'rosa', label: 'Rosa Acquistata', emoji: '🏆' }
  ];

  // Stili
  const containerStyle = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    color: '#1e293b'
  };

  const tabNavStyle = {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 1rem',
    position: 'sticky',
    top: 0,
    zIndex: 10
  };

  const tabButtonsStyle = {
    display: 'flex',
    gap: '0.5rem',
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const tabButtonStyle = {
    padding: '1rem 1.5rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    fontSize: '0.875rem',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s ease'
  };

  const activeTabStyle = {
    ...tabButtonStyle,
    color: '#2563eb',
    borderBottomColor: '#2563eb',
    backgroundColor: '#f8fafc'
  };

  const tabContentStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1rem'
  };

  // Componente per mostrare lo stato degli aggiornamenti
  const UpdateStatus = () => {
    if (!updateStatus.lastUpdate && !updateStatus.isChecking) return null;

    return (
      <div style={{
        backgroundColor: updateStatus.error ? '#fef2f2' : '#f0f9ff',
        border: `1px solid ${updateStatus.error ? '#fecaca' : '#bae6fd'}`,
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        margin: '1rem 0',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{updateStatus.isChecking ? '🔄' : updateStatus.error ? '⚠️' : '✅'}</span>
          <span>
            {updateStatus.isChecking ? 'Controllo aggiornamenti...' : 
             updateStatus.error ? `Stato: ${updateStatus.error}` :
             `Dataset aggiornato - Versione: ${updateStatus.currentVersion}`}
          </span>
        </div>
        {!updateStatus.isChecking && (
          <button
            onClick={forceUpdate}
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            🔄 Controlla aggiornamenti
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={containerStyle}>
      <Header 
        budget={budget} 
        setBudget={setBudget}
        playerStatus={playerStatus}
      />

      {/* Stato aggiornamenti */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        <UpdateStatus />
      </div>

      {/* Navigazione Tab */}
      {!loading && !error && normalizedData.length > 0 && (
        <div style={tabNavStyle}>
          <div style={tabButtonsStyle}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={activeTab === tab.id ? activeTabStyle : tabButtonStyle}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.color = '#374151';
                    e.target.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.color = '#64748b';
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: '1.125rem' }}>{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div style={tabContentStyle}>
        {loading && (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            fontSize: '1.125rem',
            color: '#64748b'
          }}>
            <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>⏳</div>
            {updateStatus.isChecking ? 'Controllo aggiornamenti dataset...' : 'Caricamento dati in corso...'}
          </div>
        )}

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
    </div>
  );
};

export default App;
