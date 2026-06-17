import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Send, 
  GitBranch, 
  ListTodo, 
  QrCode, 
  Upload, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  Play, 
  Plus, 
  RefreshCw, 
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
  Search
} from 'lucide-react';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [contatos, setContatos] = useState([]);
  const [selectedContatos, setSelectedContatos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [fluxos, setFluxos] = useState([]);
  const [execucoes, setExecucoes] = useState([]);
  const [fila, setFila] = useState([]);
  const [wppStatus, setWppStatus] = useState({
    connectionState: 'DISCONNECTED',
    qrCodeData: null,
    useMockMode: true,
    sentMessagesLog: []
  });

  // Entradas do formulário (estados da UI)
  const [campaignForm, setCampaignForm] = useState({ nome: '', mensagem: '', delayMin: 5, delayMax: 15 });
  const [flowForm, setFlowForm] = useState({ nome: '' });
  const [stepForm, setStepForm] = useState({ mensagem: '', delayValue: 1, delayUnit: 'minutos', ordem: 1 });
  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const selectedFlowIdRef = useRef(selectedFlowId);
  selectedFlowIdRef.current = selectedFlowId;
  
  // Estados de carregamento (loading) e avisos
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContatos = contatos.filter(c => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (c.nome?.toLowerCase().includes(query) || c.telefone?.toLowerCase().includes(query));
  });

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const [confirmModal, setConfirmModal] = useState(null);
  
  const showConfirm = (config) => {
    setConfirmModal(config);
  };
  
  const fileInputRef = useRef(null);
  const wsRef = useRef(null);

  // Inicializa os dados e a conexão WebSocket
  useEffect(() => {
    fetchData();
    connectWebSocket();

    // Atualiza os dados periodicamente como fallback
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Recalcula a ordem da próxima etapa quando o fluxo selecionado ou a lista de fluxos mudar
  useEffect(() => {
    const currentFlow = fluxos.find(f => f.id === selectedFlowId);
    if (currentFlow) {
      const nextOrdem = (currentFlow.etapas?.length || 0) + 1;
      setStepForm(prev => ({ ...prev, ordem: nextOrdem }));
    } else {
      setStepForm(prev => ({ ...prev, ordem: 1 }));
    }
  }, [selectedFlowId, fluxos]);

  const fetchData = async () => {
    try {
      const [contList, campList, flowList, execList, queueList, status] = await Promise.all([
        api.getContatos(),
        api.getCampanhas(),
        api.getFluxos(),
        api.getExecucoes(),
        api.getFila(),
        api.getWppStatus()
      ]);
      setContatos(contList);
      setCampanhas(campList);
      setFluxos(flowList);
      setExecucoes(execList);
      setFila(queueList);
      setWppStatus(status);

      // Seleciona automaticamente o primeiro fluxo se nenhum estiver selecionado e existirem fluxos
      if (flowList.length > 0 && !selectedFlowIdRef.current) {
        setSelectedFlowId(flowList[0].id);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
  };

  const connectWebSocket = () => {
    try {
      const socket = new WebSocket('ws://localhost:5000');
      wsRef.current = socket;

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('[WS] Mensagem recebida:', message);

        switch (message.type) {
          case 'WPP_STATUS':
            setWppStatus(message.data);
            break;
          case 'QUEUE_UPDATED':
            // Recarrega a fila e campanhas
            api.getFila().then(setFila);
            api.getCampanhas().then(setCampanhas);
            break;
          case 'FLOWS_UPDATED':
            api.getFluxos().then(setFluxos);
            api.getExecucoes().then(setExecucoes);
            break;
          case 'CONTATOS_UPDATED':
            api.getContatos().then(setContatos);
            break;
          default:
            break;
        }
      };

      socket.onclose = () => {
        console.log('[WS] Desconectado. Tentando reconectar...');
        setTimeout(connectWebSocket, 3000);
      };
    } catch (e) {
      console.error('[WS] Erro ao conectar:', e);
    }
  };

  // Manipuladores de Contatos (Handlers)
  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    setImportFeedback(null);
    try {
      const res = await api.importContatos(file);
      if (res.success) {
        setImportFeedback({ type: 'success', message: `${res.importedCount} contatos importados com sucesso.` });
        api.getContatos().then(setContatos);
      } else {
        setImportFeedback({ type: 'error', message: res.error || 'Erro ao importar contatos.' });
      }
    } catch (error) {
      setImportFeedback({ type: 'error', message: 'Falha na conexão com o servidor.' });
    } finally {
      setIsImporting(false);
      e.target.value = ''; // Reseta o campo de upload
    }
  };

  const handleToggleSelectContato = (id) => {
    setSelectedContatos(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleSelectAllContatos = () => {
    if (selectedContatos.length === filteredContatos.length) {
      setSelectedContatos([]);
    } else {
      setSelectedContatos(filteredContatos.map(c => c.id));
    }
  };

  const handleDeleteContato = (id) => {
    showConfirm({
      title: 'Excluir Contato',
      message: 'Deseja realmente excluir este contato? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      isDanger: true,
      onConfirm: async () => {
        await api.deleteContato(id);
        setSelectedContatos(prev => prev.filter(cId => cId !== id));
        api.getContatos().then(setContatos);
        showToast('Contato excluído com sucesso!');
      }
    });
  };

  const handleClearContatos = () => {
    showConfirm({
      title: 'Limpar Todos os Contatos',
      message: 'Atenção: Isso excluirá permanentemente TODOS os contatos do banco de dados. Confirmar?',
      confirmText: 'Excluir Tudo',
      isDanger: true,
      onConfirm: async () => {
        await api.clearContatos();
        setSelectedContatos([]);
        api.getContatos().then(setContatos);
        showToast('Banco de contatos limpo com sucesso!');
      }
    });
  };

  // Manipuladores de Campanha (Handlers)
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (selectedContatos.length === 0) {
      showToast('Selecione pelo menos um contato na aba "Contatos" para disparar a campanha.', 'warning');
      return;
    }

    try {
      const res = await api.createCampanha({
        nome: campaignForm.nome,
        mensagem: campaignForm.mensagem,
        delayMin: campaignForm.delayMin,
        delayMax: campaignForm.delayMax,
        contatosIds: selectedContatos
      });

      if (res.success) {
        showToast('Campanha criada e disparos agendados na fila com sucesso!');
        setCampaignForm({ nome: '', mensagem: '', delayMin: 5, delayMax: 15 });
        setSelectedContatos([]);
        setActiveTab('campanhas');
        fetchData();
      } else {
        showToast('Erro ao criar campanha: ' + res.error, 'error');
      }
    } catch (e) {
      showToast('Erro de conexão ao criar campanha.', 'error');
    }
  };

  // Manipuladores de Fluxo (Handlers)
  const handleCreateFlow = async (e) => {
    e.preventDefault();
    if (!flowForm.nome) return;

    try {
      const res = await api.createFluxo(flowForm.nome);
      setFlowForm({ nome: '' });
      const flowList = await api.getFluxos();
      setFluxos(flowList);
      setSelectedFlowId(res.id);
      showToast('Fluxo criado com sucesso!');
    } catch (e) {
      showToast('Erro ao criar fluxo.', 'error');
    }
  };

  const handleDeleteFlow = (id) => {
    showConfirm({
      title: 'Excluir Fluxo',
      message: 'Tem certeza que deseja excluir este fluxo e todas as suas etapas? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      isDanger: true,
      onConfirm: async () => {
        await api.deleteFluxo(id);
        if (selectedFlowId === id) setSelectedFlowId(null);
        const flowList = await api.getFluxos();
        setFluxos(flowList);
        if (flowList.length > 0) setSelectedFlowId(flowList[0].id);
        showToast('Fluxo excluído com sucesso!');
      }
    });
  };

  const handleAddStep = async (e) => {
    e.preventDefault();
    if (!selectedFlowId) return;

    const delayMinutes = stepForm.delayUnit === 'segundos' 
      ? parseFloat(stepForm.delayValue) / 60 
      : parseFloat(stepForm.delayValue);

    try {
      await api.addFluxoEtapa(selectedFlowId, {
        mensagem: stepForm.mensagem,
        delayMinutos: delayMinutes,
        ordem: stepForm.ordem
      });

      setStepForm(prev => ({
        mensagem: '',
        delayValue: 1,
        delayUnit: 'minutos',
        ordem: prev.ordem + 1
      }));

      fetchData();
      showToast('Etapa adicionada com sucesso!');
    } catch (e) {
      showToast('Erro ao adicionar etapa.', 'error');
    }
  };

  const handleDeleteStep = (stepId) => {
    showConfirm({
      title: 'Excluir Etapa',
      message: 'Tem certeza que deseja excluir esta etapa do fluxo? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      isDanger: true,
      onConfirm: async () => {
        await api.deleteFluxoEtapa(stepId);
        fetchData();
        showToast('Etapa excluída com sucesso!');
      }
    });
  };

  const handleAddListToFlow = async () => {
    if (!selectedFlowId) {
      showToast('Selecione ou crie um fluxo primeiro.', 'warning');
      return;
    }
    if (selectedContatos.length === 0) {
      showToast('Selecione pelo menos um contato na aba "Contatos" para adicionar ao fluxo.', 'warning');
      return;
    }

    try {
      const res = await api.entrarFluxo(selectedFlowId, selectedContatos);
      if (res.success) {
        if (res.startedCount > 0 && res.skippedCount > 0) {
          showToast(`${res.startedCount} contatos inseridos. ${res.skippedCount} ignorados (já cadastrados).`, 'success');
        } else if (res.startedCount === 0 && res.skippedCount > 0) {
          showToast(`Todos os contatos selecionados já estão cadastrados neste fluxo!`, 'warning');
        } else {
          showToast(`${res.startedCount} contatos inseridos no fluxo de automação com sucesso!`, 'success');
        }
        setSelectedContatos([]);
        fetchData();
      } else {
        showToast('Erro: ' + (res.error || 'Não foi possível adicionar ao fluxo.'), 'error');
      }
    } catch (error) {
      showToast('Erro ao adicionar contatos ao fluxo: ' + error.message, 'error');
    }
  };

  const handleDeleteExecucao = (id) => {
    showConfirm({
      title: 'Remover Contato do Fluxo',
      message: 'Deseja remover este contato do fluxo de automação? Os envios pendentes dele também serão cancelados.',
      confirmText: 'Remover',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.deleteExecucao(id);
          if (res.success) {
            showToast('Contato removido do fluxo com sucesso!');
            fetchData();
          } else {
            showToast('Erro ao remover contato: ' + (res.error || 'Erro desconhecido'), 'error');
          }
        } catch (e) {
          showToast('Erro de conexão ao remover contato do fluxo.', 'error');
        }
      }
    });
  };

  const handleStartExecucao = async (id) => {
    try {
      const res = await api.reiniciarExecucao(id);
      if (res.success) {
        showToast('Fluxo iniciado com sucesso para o contato!');
        fetchData();
      } else {
        showToast('Erro ao iniciar fluxo: ' + (res.error || 'Erro desconhecido'), 'error');
      }
    } catch (e) {
      showToast('Erro de conexão ao iniciar fluxo.', 'error');
    }
  };

  const handleStartTodosExecucoes = async () => {
    if (!selectedFlowId) return;
    showConfirm({
      title: 'Disparar para Todos',
      message: 'Deseja realmente iniciar ou reiniciar o fluxo de automação imediatamente para TODOS os contatos cadastrados neste fluxo?',
      confirmText: 'Disparar em Todos',
      isDanger: false,
      onConfirm: async () => {
        try {
          const res = await api.reiniciarTodosExecucao(selectedFlowId);
          if (res.success) {
            showToast(`${res.count || 0} contatos iniciados no fluxo com sucesso!`);
            fetchData();
          } else {
            showToast('Erro ao disparar fluxo: ' + (res.error || 'Erro desconhecido'), 'error');
          }
        } catch (e) {
          showToast('Erro de conexão ao iniciar fluxo para todos.', 'error');
        }
      }
    });
  };

  // Manipuladores de Conexão do WhatsApp (Handlers)
  const handleToggleMock = async (enable) => {
    try {
      const status = await api.toggleWppMock(enable);
      setWppStatus(status);
      showToast(`Modo mock ${enable ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (e) {
      showToast('Erro ao alternar modo mock.', 'error');
    }
  };

  const handleConnectWpp = async () => {
    try {
      await api.connectWpp();
      showToast('Conexão ao WhatsApp iniciada.');
    } catch (e) {
      showToast('Erro ao iniciar conexão.', 'error');
    }
  };

  const handleDisconnectWpp = async () => {
    try {
      const status = await api.disconnectWpp();
      setWppStatus(status);
      showToast('Conexão deslogada com sucesso!');
    } catch (e) {
      showToast('Erro ao desconectar.', 'error');
    }
  };

  const handleClearQueue = () => {
    showConfirm({
      title: 'Limpar Fila de Envios',
      message: 'Deseja realmente limpar todas as mensagens pendentes e logs da fila? As automações em andamento também serão canceladas.',
      confirmText: 'Limpar Fila',
      isDanger: true,
      onConfirm: async () => {
        await api.clearFila();
        fetchData();
        showToast('Fila e execuções limpas com sucesso!');
      }
    });
  };

  // Contagens derivadas para os cards de estatísticas
  const stats = {
    totalContatos: contatos.length,
    filaPendente: fila.filter(m => m.status === 'pending').length,
    filaEnviado: fila.filter(m => m.status === 'sent').length,
    filaFalhado: fila.filter(m => m.status === 'failed').length,
    fluxosAtivos: execucoes.filter(e => e.status === 'running').length,
    campanhasAtivas: campanhas.filter(c => c.status === 'sending').length,
  };

  // Obtém os dados do fluxo ativo
  const currentFlow = fluxos.find(f => f.id === selectedFlowId);

  return (
    <div className="flex h-screen bg-[#080B11] text-slate-100 overflow-hidden font-sans">
      
      {/* 1. MENU LATERAL */}
      <aside className="w-64 bg-[#0C111C] border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Cabeçalho da marca */}
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950/40">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-wide bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">WppAutomator</h1>
              <span className="text-[10px] text-purple-400 font-semibold tracking-widest uppercase">Engine v1.0</span>
            </div>
          </div>

          {/* Links de navegação */}
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'contatos', label: 'Contatos', icon: Users, badge: selectedContatos.length > 0 ? selectedContatos.length : null },
              { id: 'campanhas', label: 'Campanhas', icon: Send },
              { id: 'fluxos', label: 'Fluxos (Automação)', icon: GitBranch, badge: stats.fluxosAtivos > 0 ? stats.fluxosAtivos : null },
              { id: 'fila', label: 'Fila e Logs', icon: ListTodo, badge: stats.filaPendente > 0 ? stats.filaPendente : null },
              { id: 'conexao', label: 'Conexão WhatsApp', icon: QrCode, highlight: wppStatus.connectionState === 'CONNECTED' },
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group text-sm ${
                    isActive 
                      ? 'bg-gradient-to-r from-purple-600/20 to-indigo-600/10 text-purple-200 border-l-4 border-purple-500 font-medium' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xxs font-bold bg-purple-600 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {item.highlight && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Widget de status de conexão do WhatsApp no rodapé */}
        <div className="p-4 border-t border-slate-800 bg-[#0A0D16]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Status Conexão:</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
              wppStatus.connectionState === 'CONNECTED' 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : wppStatus.connectionState === 'CONNECTING' || wppStatus.connectionState === 'QRCODE'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {wppStatus.connectionState === 'CONNECTED' ? 'Ativo' : wppStatus.connectionState === 'DISCONNECTED' ? 'Off' : 'Lendo'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Modo: <strong>{wppStatus.useMockMode ? 'MOCK (Simulado)' : 'WPPCONNECT'}</strong></span>
          </div>
        </div>
      </aside>

      {/* 2. ÁREA DO CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-950">
        
        {/* Cabeçalho Superior */}
        <header className="h-16 border-b border-slate-900 bg-[#090D15]/80 backdrop-blur-md px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-slate-200 capitalize">{activeTab.replace('-', ' ')}</h2>
            {selectedContatos.length > 0 && (
              <span className="px-3 py-1 bg-purple-500/15 text-purple-300 rounded-full text-xs border border-purple-500/25">
                {selectedContatos.length} contatos selecionados
              </span>
            )}
          </div>
          <button 
            onClick={fetchData} 
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Recarregar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </header>

        {/* Área de visualização do conteúdo das abas */}
        <div className="p-8 max-w-7xl mx-auto w-full space-y-8 flex-1">
          
          {/* TAB 1: DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Metric grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Contatos', value: stats.totalContatos, icon: Users, color: 'from-blue-600 to-cyan-500', desc: 'Contatos importados no banco' },
                  { label: 'Fila Pendente', value: stats.filaPendente, icon: ListTodo, color: 'from-amber-600 to-yellow-500', desc: 'Aguardando agendamento' },
                  { label: 'Fluxos em Execução', value: stats.fluxosAtivos, icon: GitBranch, color: 'from-purple-600 to-indigo-500', desc: 'Contatos executando fluxos' },
                  { label: 'Campanhas Ativas', value: stats.campanhasAtivas, icon: Send, color: 'from-emerald-600 to-teal-500', desc: 'Campanhas ativas na fila' },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="glass rounded-2xl p-6 relative overflow-hidden group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{stat.label}</p>
                          <h3 className="text-3xl font-extrabold mt-2 tracking-tight">{stat.value}</h3>
                        </div>
                        <div className={`p-3 rounded-xl bg-gradient-to-tr ${stat.color} text-white shadow-md`}>
                          <Icon className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-4">{stat.desc}</p>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 from-transparent via-slate-700 to-transparent" />
                    </div>
                  );
                })}
              </div>

              {/* Quick action grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Wpp state card */}
                <div className="glass rounded-2xl p-6 col-span-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-200 mb-4 flex items-center space-x-2">
                      <QrCode className="w-5 h-5 text-purple-400" />
                      <span>Integração WhatsApp</span>
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      O motor do disparador está ativo em background independente do navegador.
                    </p>
                    
                    <div className="space-y-3 p-4 bg-[#0A0D15] rounded-xl border border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Conexão:</span>
                        <span className="font-semibold text-slate-200">{wppStatus.connectionState}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Driver de envio:</span>
                        <span className="font-semibold text-purple-400">{wppStatus.useMockMode ? 'MOCK (Simulado)' : 'Real (WPPConnect)'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setActiveTab('conexao')}
                    className="w-full mt-6 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 hover:border-slate-600 transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Configurar Conexão</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Queue status */}
                <div className="glass rounded-2xl p-6 col-span-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-200 mb-4 flex items-center space-x-2">
                      <ListTodo className="w-5 h-5 text-indigo-400" />
                      <span>Fila de Disparos</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-3 bg-slate-900/60 rounded-xl border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 uppercase">Pendente</span>
                        <p className="text-lg font-bold text-amber-400 mt-1">{stats.filaPendente}</p>
                      </div>
                      <div className="text-center p-3 bg-slate-900/60 rounded-xl border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 uppercase">Enviados</span>
                        <p className="text-lg font-bold text-emerald-400 mt-1">{stats.filaEnviado}</p>
                      </div>
                      <div className="text-center p-3 bg-slate-900/60 rounded-xl border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 uppercase">Falhas</span>
                        <p className="text-lg font-bold text-rose-400 mt-1">{stats.filaFalhado}</p>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setActiveTab('fila')}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 hover:border-slate-600 transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Acessar Fila de Envios</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Automation flows summary */}
                <div className="glass rounded-2xl p-6 col-span-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-200 mb-4 flex items-center space-x-2">
                      <GitBranch className="w-5 h-5 text-pink-400" />
                      <span>Fluxos Ativos</span>
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Mecanismos de automação sequencial que disparam mensagens programadas para contatos individualmente ao longo do tempo.
                    </p>
                    <div className="space-y-2">
                      {fluxos.slice(0, 3).map((f) => (
                        <div key={f.id} className="flex justify-between items-center text-xs p-2 bg-slate-900/30 rounded-lg">
                          <span className="text-slate-300 font-medium truncate max-w-[150px]">{f.nome}</span>
                          <span className="text-slate-500">{f.etapas?.length || 0} etapas</span>
                        </div>
                      ))}
                      {fluxos.length === 0 && (
                        <p className="text-xs text-slate-500 italic text-center py-4">Nenhum fluxo cadastrado.</p>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('fluxos')}
                    className="w-full mt-6 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 hover:border-slate-600 transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Gerenciar Automações</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Real time logs block */}
              <div className="glass rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-bold text-slate-200 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
                    <span>Monitor de Envios em Tempo Real (Atividade Recente)</span>
                  </h4>
                  <button 
                    onClick={() => setActiveTab('fila')}
                    className="text-xs text-purple-400 hover:text-purple-300 underline font-medium"
                  >
                    Ver logs completos
                  </button>
                </div>

                <div className="bg-[#070A11] border border-slate-900 rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-[220px] space-y-2.5">
                  {wppStatus.sentMessagesLog && wppStatus.sentMessagesLog.length > 0 ? (
                    wppStatus.sentMessagesLog.slice().reverse().map((log) => (
                      <div key={log.id} className="flex items-start space-x-3 text-slate-300 border-b border-slate-900/50 pb-2">
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {log.status === 'sent' ? 'SUCCESS' : 'FAILED'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-400 truncate">
                            Para: <strong className="text-slate-200">{log.to}</strong> | {log.message}
                          </p>
                          {log.error && <p className="text-rose-400 text-[10px] mt-0.5">{log.error}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic py-6 text-center">
                      Nenhum envio recente registrado. Crie uma campanha ou inicie um fluxo para ver os disparos aqui.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTATOS VIEW */}
          {activeTab === 'contatos' && (
            <div className="space-y-8">
              
              {/* Header card with upload */}
              <div className="glass rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* Upload Form */}
                <div>
                  <h4 className="font-bold text-slate-200 mb-2">Importar Lista de Contatos</h4>
                  <p className="text-xs text-slate-400 mb-6">
                    Selecione um arquivo CSV com as colunas sem aspas, no formato: <code className="bg-slate-900 px-1 py-0.5 rounded text-purple-400 font-mono">nome,telefone</code>. Os telefones duplicados serão ignorados ou mesclados.
                  </p>
                  
                  <div className="flex items-center space-x-4">
                    <input 
                      type="file" 
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleCSVImport}
                      className="hidden" 
                    />
                    <button
                      onClick={() => fileInputRef.current.click()}
                      disabled={isImporting}
                      className="py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-950/20 disabled:opacity-50 flex items-center space-x-2"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Importando...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Upload Arquivo CSV</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleClearContatos}
                      className="py-3 px-4 rounded-xl border border-slate-700/60 hover:border-rose-500/30 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 text-sm font-semibold transition-all flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Limpar Banco</span>
                    </button>
                  </div>

                  {importFeedback && (
                    <div className={`mt-4 p-4 rounded-xl border text-xs ${
                      importFeedback.type === 'success' 
                        ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300' 
                        : 'bg-rose-500/15 border-rose-500/20 text-rose-300'
                    }`}>
                      {importFeedback.message}
                    </div>
                  )}
                </div>

                {/* Bulk Actions */}
                <div className="p-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                  <h4 className="font-bold text-slate-300 text-sm mb-3">Ações de Lista para Selecionados ({selectedContatos.length})</h4>
                  <p className="text-xs text-slate-400 mb-6">
                    Selecione contatos na tabela abaixo e escolha qual automação deseja executar para esses contatos em lote.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Add to campaign shortcut */}
                    <button
                      onClick={() => {
                        if (selectedContatos.length === 0) {
                          alert('Selecione pelo menos um contato na tabela.');
                          return;
                        }
                        setActiveTab('campanhas');
                      }}
                      className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all flex items-center justify-center space-x-2"
                    >
                      <Send className="w-3.5 h-3.5 text-purple-400" />
                      <span>Criar Disparo Simples</span>
                    </button>

                    {/* Add to Flow selection */}
                    <div className="flex space-x-1 shrink-0">
                      <select 
                        value={selectedFlowId || ''} 
                        onChange={(e) => setSelectedFlowId(Number(e.target.value))}
                        className="bg-[#0A0D14] border border-slate-800 text-slate-300 text-xs rounded-xl px-2 py-2.5 flex-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="" disabled>Escolha o Fluxo...</option>
                        {fluxos.map(f => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddListToFlow}
                        className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all flex items-center justify-center"
                        title="Adicionar selecionados ao fluxo"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contacts Table List */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div>
                    <h4 className="font-bold text-slate-200">Lista Geral de Contatos</h4>
                    <span className="text-xs text-slate-400">
                      {searchQuery ? `${filteredContatos.length} de ${contatos.length}` : contatos.length} registros
                    </span>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <input 
                      type="text"
                      placeholder="Pesquisar por nome ou número..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#0A0D14] border border-slate-800 focus:border-purple-500 text-slate-200 text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none"
                    />
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                        <th className="p-4 w-12 text-center">
                          <input 
                            type="checkbox" 
                            checked={filteredContatos.length > 0 && selectedContatos.length === filteredContatos.length}
                            onChange={handleSelectAllContatos}
                            className="rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="p-4">Nome</th>
                        <th className="p-4">Telefone</th>
                        <th className="p-4">Importado Em</th>
                        <th className="p-4 w-16 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredContatos.map((contato) => {
                        const isSelected = selectedContatos.includes(contato.id);
                        return (
                          <tr 
                            key={contato.id} 
                            className={`hover:bg-slate-900/30 transition-colors ${isSelected ? 'bg-purple-900/10' : ''}`}
                          >
                            <td className="p-4 text-center">
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectContato(contato.id)}
                                className="rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="p-4 font-medium text-slate-200">{contato.nome}</td>
                            <td className="p-4 text-slate-300 font-mono">{contato.telefone}</td>
                            <td className="p-4 text-slate-400 text-xs">
                              {new Date(contato.createdAt).toLocaleDateString()} {new Date(contato.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleDeleteContato(contato.id)}
                                className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                                title="Excluir Contato"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredContatos.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-slate-500 italic">
                            {searchQuery ? 'Nenhum resultado encontrado para a sua pesquisa.' : 'Nenhum contato encontrado. Importe um arquivo CSV acima.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CAMPANHAS VIEW */}
          {activeTab === 'campanhas' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Campaign Creator form */}
              <div className="glass rounded-2xl p-6 lg:col-span-1 space-y-6">
                <div>
                  <h4 className="font-bold text-slate-200 mb-2">Criar Campanha</h4>
                  <p className="text-xs text-slate-400">
                    Define um envio assíncrono para os contatos selecionados com delay aleatório entre cada mensagem.
                  </p>
                </div>

                <form onSubmit={handleCreateCampaign} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold">Nome da Campanha</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Campanha de Vendas Junho"
                      value={campaignForm.nome}
                      onChange={(e) => setCampaignForm({...campaignForm, nome: e.target.value})}
                      className="w-full bg-[#0A0D14] border border-slate-800 focus:border-purple-500 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 font-semibold">Delay Min (segundos)</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        value={campaignForm.delayMin}
                        onChange={(e) => setCampaignForm({...campaignForm, delayMin: Number(e.target.value)})}
                        className="w-full bg-[#0A0D14] border border-slate-800 focus:border-purple-500 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300 font-semibold">Delay Max (segundos)</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        value={campaignForm.delayMax}
                        onChange={(e) => setCampaignForm({...campaignForm, delayMax: Number(e.target.value)})}
                        className="w-full bg-[#0A0D14] border border-slate-800 focus:border-purple-500 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold">Mensagem</label>
                    <textarea 
                      required
                      rows="6"
                      placeholder="Digite a mensagem do disparo..."
                      value={campaignForm.mensagem}
                      onChange={(e) => setCampaignForm({...campaignForm, mensagem: e.target.value})}
                      className="w-full bg-[#0A0D14] border border-slate-800 focus:border-purple-500 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none resize-none"
                    />
                  </div>

                  {selectedContatos.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start space-x-2.5 text-xs text-amber-300 leading-relaxed">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Selecione os contatos destinatários na aba <strong>Contatos</strong> primeiro.</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between text-xs text-purple-300">
                      <span>Destinatários selecionados:</span>
                      <strong className="text-slate-100">{selectedContatos.length} contatos</strong>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={selectedContatos.length === 0}
                    className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Disparar Campanha</span>
                  </button>
                </form>
              </div>

              {/* Campaign list */}
              <div className="lg:col-span-2 space-y-6">
                <h4 className="font-bold text-slate-200 text-lg">Campanhas Executadas</h4>

                <div className="space-y-4">
                  {campanhas.map((camp) => {
                    const total = camp.stats.total || 0;
                    const sent = camp.stats.sent || 0;
                    const failed = camp.stats.failed || 0;
                    const progress = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;
                    
                    return (
                      <div key={camp.id} className="glass rounded-2xl p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Campanha #{camp.id}</span>
                            <h5 className="font-bold text-slate-200 text-base mt-1">{camp.nome}</h5>
                          </div>
                          
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            camp.status === 'completed' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse'
                          }`}>
                            {camp.status === 'completed' ? 'Finalizada' : 'Disparando'}
                          </span>
                        </div>

                        {/* Message Preview */}
                        <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/40 text-xs text-slate-300 leading-relaxed font-mono">
                          {camp.mensagem}
                        </div>

                        {/* Progress Bar & Details */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Progresso: {progress}%</span>
                            <span>Delays: {camp.delayMin}s a {camp.delayMax}s</span>
                          </div>
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex">
                            <div className="bg-emerald-500 h-full" style={{ width: `${total > 0 ? (sent / total) * 100 : 0}%` }} title="Sucesso" />
                            <div className="bg-rose-500 h-full" style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }} title="Falhas" />
                          </div>
                          <div className="flex space-x-6 text-[11px] text-slate-500">
                            <span>Sucesso: <strong className="text-slate-300">{sent}</strong></span>
                            <span>Falhas: <strong className="text-slate-300">{failed}</strong></span>
                            <span>Pendentes: <strong className="text-slate-300">{camp.stats.pending}</strong></span>
                            <span>Total: <strong className="text-slate-300">{total}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {campanhas.length === 0 && (
                    <div className="glass rounded-2xl p-8 text-center text-slate-500 italic">
                      Nenhuma campanha disparada.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FLUXOS VIEW */}
          {activeTab === 'fluxos' && (
            <div className="space-y-8">
              
              {/* Flow Selector and Creator */}
              <div className="glass rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center space-x-4">
                  <GitBranch className="w-8 h-8 text-purple-400" />
                  <div>
                    <h4 className="font-bold text-slate-200">Automação de Fluxos</h4>
                    <p className="text-xs text-slate-400">Selecione ou crie um fluxo para editar suas etapas e acompanhar execuções.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <form onSubmit={handleCreateFlow} className="flex items-center bg-[#0A0D14] border border-slate-800 rounded-xl px-2 py-1">
                    <input 
                      type="text" 
                      required
                      placeholder="Novo nome de fluxo..."
                      value={flowForm.nome}
                      onChange={(e) => setFlowForm({ nome: e.target.value })}
                      className="bg-transparent text-slate-200 text-xs px-3 py-1.5 focus:outline-none w-48"
                    />
                    <button 
                      type="submit" 
                      className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white"
                      title="Criar fluxo"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  {/* Flow Dropdown */}
                  <select 
                    value={selectedFlowId || ''} 
                    onChange={(e) => setSelectedFlowId(Number(e.target.value))}
                    className="bg-[#0A0D14] border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
                  >
                    <option value="" disabled>Selecionar Fluxo...</option>
                    {fluxos.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>

                  {selectedFlowId && (
                    <button
                      onClick={() => handleDeleteFlow(selectedFlowId)}
                      className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 rounded-xl transition-all"
                      title="Excluir Fluxo Selecionado"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>
              </div>

              {currentFlow ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  
                  {/* Flow Steps Editor (Left column) */}
                  <div className="glass rounded-2xl p-6 lg:col-span-1 space-y-6">
                    <div>
                      <h5 className="font-bold text-slate-200 text-base">Etapas do Fluxo: <span className="text-purple-400">{currentFlow.nome}</span></h5>
                      <p className="text-xs text-slate-400 mt-1">Defina a ordem das mensagens e o atraso relativo para cada contato.</p>
                    </div>

                    {/* Step Timeline */}
                    <div className="space-y-4 relative pl-4 border-l border-slate-800">
                      {currentFlow.etapas && currentFlow.etapas.sort((a,b) => a.ordem - b.ordem).map((step, index) => (
                        <div key={step.id} className="relative group">
                          {/* Timeline node */}
                          <div className="absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full bg-purple-600 border-2 border-slate-950 flex items-center justify-center font-bold text-[7px]" />
                          
                          <div className="bg-[#0A0D15] p-3 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-all">
                            <div className="flex justify-between items-start text-[10px] text-slate-400 mb-1">
                              <span className="font-semibold text-purple-400">Mensagem {step.ordem}</span>
                              <div className="flex items-center space-x-2">
                                <span className="flex items-center text-slate-500">
                                  <Clock className="w-3 h-3 mr-1" />
                                  +{step.delayMinutos < 1 ? `${Math.round(step.delayMinutos * 60)}s` : `${step.delayMinutos}m`}
                                </span>
                                <button 
                                  onClick={() => handleDeleteStep(step.id)}
                                  className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-slate-200 leading-relaxed font-mono truncate">{step.mensagem}</p>
                          </div>
                        </div>
                      ))}

                      {(!currentFlow.etapas || currentFlow.etapas.length === 0) && (
                        <p className="text-xs text-slate-500 italic py-4">Este fluxo ainda não possui etapas. Adicione uma abaixo.</p>
                      )}
                    </div>

                    {/* Add step form */}
                    <form onSubmit={handleAddStep} className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-xl space-y-4">
                      <h6 className="font-bold text-slate-300 text-xs uppercase tracking-wider">Nova Etapa</h6>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold">Ordem Sequencial</label>
                          <input 
                            type="number" 
                            required
                            min="1"
                            value={stepForm.ordem}
                            onChange={(e) => setStepForm({...stepForm, ordem: Number(e.target.value)})}
                            className="w-full bg-[#0A0D14] border border-slate-800 focus:border-purple-500 text-slate-200 text-xs rounded-lg px-2.5 py-2 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold">Tempo de Atraso</label>
                          <div className="flex bg-[#0A0D14] border border-slate-800 rounded-lg overflow-hidden">
                            <input 
                              type="number" 
                              required
                              step="any"
                              min="0"
                              value={stepForm.delayValue}
                              onChange={(e) => setStepForm({...stepForm, delayValue: Number(e.target.value)})}
                              className="w-12 bg-transparent text-slate-200 text-xs px-2 py-2 focus:outline-none text-center"
                            />
                            <select 
                              value={stepForm.delayUnit}
                              onChange={(e) => setStepForm({...stepForm, delayUnit: e.target.value})}
                              className="bg-[#0D121B] text-slate-300 text-[10px] px-1 focus:outline-none border-l border-slate-850"
                            >
                              <option value="segundos">seg</option>
                              <option value="minutos">min</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold">Mensagem da Etapa</label>
                        <textarea 
                          required
                          rows="3"
                          placeholder="Texto que o contato receberá..."
                          value={stepForm.mensagem}
                          onChange={(e) => setStepForm({...stepForm, mensagem: e.target.value})}
                          className="w-full bg-[#0A0D14] border border-slate-800 focus:border-purple-500 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Etapa</span>
                      </button>
                    </form>
                  </div>

                  {/* Flow Executions Tracker (Right column) */}
                  <div className="glass rounded-2xl p-6 lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h5 className="font-bold text-slate-200 text-base">Contatos no Fluxo</h5>
                        <p className="text-xs text-slate-400">Controle o status de execução de cada contato agendado neste fluxo.</p>
                      </div>
                      
                      <div className="flex items-center space-x-2 shrink-0">
                        {execucoes.filter(e => e.fluxoId === selectedFlowId).length > 0 && (
                          <button
                            onClick={handleStartTodosExecucoes}
                            className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center space-x-1"
                            title="Disparar fluxo para todos"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Disparar para Todos</span>
                          </button>
                        )}
                        {selectedContatos.length > 0 && (
                          <button
                            onClick={handleAddListToFlow}
                            className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all flex items-center space-x-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar {selectedContatos.length}</span>
                          </button>
                        )}
                      </div>
                    </div>

                     <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900/40 border-b border-slate-850 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                            <th className="p-3">Contato</th>
                            <th className="p-3">Telefone</th>
                            <th className="p-3">Etapa Atual</th>
                            <th className="p-3">Próximo Disparo</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-center w-16">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40 text-slate-300">
                          {execucoes.filter(e => e.fluxoId === selectedFlowId).map((exec) => (
                            <tr key={exec.id} className="hover:bg-slate-900/20">
                              <td className="p-3 font-medium text-slate-200">{exec.Contato?.nome}</td>
                              <td className="p-3 font-mono text-slate-400">{exec.Contato?.telefone}</td>
                              <td className="p-3">
                                {exec.etapaAtual ? (
                                  <span className="font-semibold text-purple-400">Etapa {exec.etapaAtual.ordem}</span>
                                ) : (
                                  <span className="text-slate-500 italic">Nenhuma</span>
                                )}
                              </td>
                              <td className="p-3">
                                {exec.proximaExecucao ? (
                                  <span className="flex items-center font-mono">
                                    <Clock className="w-3 h-3 text-slate-500 mr-1" />
                                    {new Date(exec.proximaExecucao).toLocaleTimeString()}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic">-</span>
                                )}
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                  exec.status === 'running' 
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                                }`}>
                                  {exec.status === 'running' ? 'EXECUTANDO' : 'COMPLETADO'}
                                </span>
                              </td>
                              <td className="p-3 text-center flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => handleStartExecucao(exec.id)}
                                  className="p-1.5 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 rounded-lg transition-colors"
                                  title="Iniciar/Reiniciar Fluxo"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExecucao(exec.id)}
                                  className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                                  title="Remover do Fluxo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {execucoes.filter(e => e.fluxoId === selectedFlowId).length === 0 && (
                            <tr>
                              <td colSpan="6" className="p-6 text-center text-slate-500 italic">
                                Nenhum contato cadastrado na fila deste fluxo. Selecione contatos e clique em "Adicionar ao fluxo".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="glass rounded-2xl p-12 text-center text-slate-500 italic">
                  Crie um fluxo no topo para gerenciar suas automações.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FILA E LOGS VIEW */}
          {activeTab === 'fila' && (
            <div className="space-y-6">
              
              {/* Reset queue banner */}
              <div className="glass rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h4 className="font-bold text-slate-200">Fila de Disparos Assíncronos</h4>
                  <p className="text-xs text-slate-400">Consulte todas as mensagens programadas que o worker está executando em background.</p>
                </div>
                <button
                  onClick={handleClearQueue}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 transition-all flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Limpar Fila de Envios</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Live Output Log Stream (Left column) */}
                <div className="glass rounded-2xl p-6 lg:col-span-1 space-y-4">
                  <h5 className="font-bold text-slate-200 text-sm">Logs em tempo real (Console do Disparador)</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Mostra os envios instantaneamente na tela assim que o worker os processa.
                  </p>
                  
                  <div className="bg-[#05080E] border border-slate-900 rounded-xl p-4 font-mono text-[11px] text-indigo-300 space-y-2 h-[450px] overflow-y-auto">
                    {wppStatus.sentMessagesLog && wppStatus.sentMessagesLog.length > 0 ? (
                      wppStatus.sentMessagesLog.slice().reverse().map((log) => (
                        <div key={log.id} className="pb-2 border-b border-slate-900/60 leading-normal">
                          <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                          <span className={log.status === 'sent' ? 'text-emerald-400' : 'text-rose-400'}>
                            {log.status === 'sent' ? '[✓]' : '[✗]'}
                          </span>{' '}
                          Para: <span className="text-slate-300 font-bold">{log.to}</span>
                          <p className="text-slate-400 pl-4 mt-0.5">{log.message}</p>
                          {log.error && <p className="text-rose-400 text-[10px] pl-4 italic">Erro: {log.error}</p>}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-600 italic py-12 text-center text-xs">
                        Aguardando atividade do worker...
                      </div>
                    )}
                  </div>
                </div>

                {/* Queue Database entries table (Right column) */}
                <div className="glass rounded-2xl p-6 lg:col-span-2 space-y-4">
                  <h5 className="font-bold text-slate-200 text-sm">Histórico e Agendamentos no Banco</h5>
                  
                  <div className="overflow-x-auto max-h-[450px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-850 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                          <th className="p-3">Destinatário</th>
                          <th className="p-3">Campanha/Fluxo</th>
                          <th className="p-3">Mensagem</th>
                          <th className="p-3">Agendado Para</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-slate-300">
                        {fila.map((msg) => (
                          <tr key={msg.id} className="hover:bg-slate-900/10">
                            <td className="p-3">
                              <span className="font-medium block text-slate-200">{msg.Contato?.nome || 'Desconhecido'}</span>
                              <span className="text-slate-500 font-mono text-[10px]">{msg.Contato?.telefone}</span>
                            </td>
                            <td className="p-3">
                              {msg.Campanha ? (
                                <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded font-semibold">Campanha</span>
                              ) : msg.execucaoFluxoId ? (
                                <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-300 rounded font-semibold">Fluxo</span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="p-3 max-w-[200px] truncate leading-normal" title={msg.mensagem}>
                              {msg.mensagem}
                            </td>
                            <td className="p-3 font-mono text-slate-400">
                              {new Date(msg.agendadoPara).toLocaleTimeString()}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                msg.status === 'sent' 
                                  ? 'bg-emerald-500/10 text-emerald-400' 
                                  : msg.status === 'failed'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-amber-500/10 text-amber-400 animate-pulse'
                              }`}>
                                {msg.status.toUpperCase()}
                              </span>
                              {msg.erro && <span className="block text-rose-400 text-[9px] truncate max-w-[120px]" title={msg.erro}>{msg.erro}</span>}
                            </td>
                          </tr>
                        ))}
                        {fila.length === 0 && (
                          <tr>
                            <td colSpan="5" className="p-6 text-center text-slate-500 italic">
                              A fila está vazia. Crie envios para visualizar.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: CONEXÃO VIEW */}
          {activeTab === 'conexao' && (
            <div className="max-w-2xl mx-auto space-y-8">
              
              {/* Options Toggle Mode */}
              <div className="glass rounded-2xl p-6 space-y-6">
                <div>
                  <h4 className="font-bold text-slate-200">Escolha o Modo do WhatsApp</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Para testes rápidos e sem necessidade de escanear celular, use o **Modo Mock (Simulador)**. Para enviar mensagens reais usando seu chip do WhatsApp, use o **Modo WPPConnect**.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-200">Simulador / Modo Mock</span>
                    <p className="text-xs text-slate-500">Se ativo, simula os disparos sem abrir navegador.</p>
                  </div>
                  
                  <button 
                    onClick={() => handleToggleMock(!wppStatus.useMockMode)}
                    className="focus:outline-none transition-colors"
                  >
                    {wppStatus.useMockMode ? (
                      <ToggleRight className="w-12 h-12 text-purple-500 cursor-pointer" />
                    ) : (
                      <ToggleLeft className="w-12 h-12 text-slate-600 cursor-pointer" />
                    )}
                  </button>
                </div>
              </div>

              {/* QR Code / Actions Block */}
              {!wppStatus.useMockMode && (
                <div className="glass rounded-2xl p-6 text-center space-y-6">
                  <div>
                    <h4 className="font-bold text-slate-200">Conexão WPPConnect</h4>
                    <p className="text-xs text-slate-400 mt-1">Inicie a conexão e escaneie o código QR abaixo para sincronizar seu WhatsApp.</p>
                  </div>

                  <div className="flex justify-center items-center py-6">
                    {wppStatus.connectionState === 'QRCODE' && wppStatus.qrCodeData ? (
                      <div className="p-4 bg-white rounded-2xl shadow-xl shadow-purple-950/20 border border-slate-200 flex flex-col items-center">
                        <img 
                          src={wppStatus.qrCodeData} 
                          alt="WhatsApp QR Code" 
                          className="w-56 h-56"
                        />
                        <span className="text-[10px] text-slate-500 mt-2 font-semibold uppercase tracking-wider">Aponte a câmera do WhatsApp</span>
                      </div>
                    ) : wppStatus.connectionState === 'CONNECTED' ? (
                      <div className="py-12 flex flex-col items-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <div>
                          <h5 className="font-bold text-emerald-400 text-lg">WhatsApp Conectado com sucesso</h5>
                          <p className="text-xs text-slate-400 mt-1">Disparos reais estão habilitados e serão efetuados via WPPConnect.</p>
                        </div>
                      </div>
                    ) : wppStatus.connectionState === 'CONNECTING' ? (
                      <div className="py-16 flex flex-col items-center space-y-4">
                        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                        <p className="text-xs text-slate-400">Carregando Puppeteer e gerando QR Code... Aguarde.</p>
                      </div>
                    ) : (
                      <div className="py-16 text-slate-500 italic text-sm">
                        WhatsApp Desconectado. Clique no botão abaixo para iniciar.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center space-x-4">
                    {wppStatus.connectionState === 'DISCONNECTED' ? (
                      <button
                        onClick={handleConnectWpp}
                        className="py-3 px-8 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-950/20 flex items-center space-x-2"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Iniciar Sessão QR Code</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleDisconnectWpp}
                        className="py-3 px-8 rounded-xl border border-slate-700/60 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 hover:border-rose-500/30 font-semibold text-sm transition-all flex items-center space-x-2"
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>Desconectar Sessão</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mock mode welcome card */}
              {wppStatus.useMockMode && (
                <div className="glass rounded-2xl p-6 bg-gradient-to-tr from-purple-950/20 to-indigo-950/10 border border-purple-500/10">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-purple-600/10 text-purple-400 rounded-xl border border-purple-500/20">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-purple-300">Modo de Simulação Ativo (Padrão)</h4>
                      <p className="text-xs text-slate-400 leading-relaxed mt-2">
                        O sistema está totalmente operacional e rodará o worker continuamente. As mensagens geradas por campanhas e etapas dos fluxos serão processadas e salvas no banco de dados SQLite normalmente.
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed mt-2">
                        Você poderá acompanhar os resultados dos envios em tempo real na aba **"Fila e Logs"** ou no console do painel.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </main>

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0F131C] border border-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl relative overflow-hidden animate-toast">
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                confirmModal.isDanger 
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {confirmModal.isDanger ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-200 mb-2">{confirmModal.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">{confirmModal.message}</p>
              
              <div className="flex w-full space-x-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-2 px-4 rounded-xl border border-slate-705/60 hover:bg-slate-900 hover:text-slate-200 text-slate-400 text-xs font-semibold transition-all focus:outline-none"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className={`flex-1 py-2 px-4 rounded-xl text-white text-xs font-bold transition-all shadow-lg focus:outline-none ${
                    confirmModal.isDanger
                      ? 'bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 shadow-rose-950/20'
                      : 'bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 shadow-amber-950/20'
                  }`}
                >
                  {confirmModal.confirmText || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center justify-between gap-4 bg-[#0F131C]/95 border-y border-r border-slate-800/90 backdrop-blur-md p-4 rounded-xl shadow-2xl max-w-md border-l-4 ${
          toast.type === 'success' 
            ? 'border-l-emerald-500' 
            : toast.type === 'error' 
            ? 'border-l-rose-500' 
            : 'border-l-amber-500'
        } animate-toast`}>
          <div className="flex items-center space-x-3">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div className="text-sm font-medium text-slate-200 leading-normal">
              {toast.message}
            </div>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold tracking-wider focus:outline-none shrink-0"
          >
            OK
          </button>
        </div>
      )}

    </div>
  );
}
