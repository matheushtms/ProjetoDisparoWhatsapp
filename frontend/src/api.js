const API_URL = 'http://localhost:5000/api';

export const api = {
  // Contatos
  async getContatos() {
    const res = await fetch(`${API_URL}/contatos`);
    return res.json();
  },

  async importContatos(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/contatos/import`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async deleteContato(id) {
    const res = await fetch(`${API_URL}/contatos/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async clearContatos() {
    const res = await fetch(`${API_URL}/contatos`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Campanhas
  async getCampanhas() {
    const res = await fetch(`${API_URL}/campanhas`);
    return res.json();
  },

  async createCampanha(data) {
    const res = await fetch(`${API_URL}/campanhas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Fluxos
  async getFluxos() {
    const res = await fetch(`${API_URL}/fluxos`);
    return res.json();
  },

  async createFluxo(nome) {
    const res = await fetch(`${API_URL}/fluxos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    });
    return res.json();
  },

  async deleteFluxo(id) {
    const res = await fetch(`${API_URL}/fluxos/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async addFluxoEtapa(fluxoId, data) {
    const res = await fetch(`${API_URL}/fluxos/${fluxoId}/etapas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteFluxoEtapa(etapaId) {
    const res = await fetch(`${API_URL}/fluxos/etapas/${etapaId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async entrarFluxo(fluxoId, contatosIds) {
    const res = await fetch(`${API_URL}/fluxos/${fluxoId}/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contatosIds }),
    });
    return res.json();
  },

  async getExecucoes() {
    const res = await fetch(`${API_URL}/execucoes`);
    return res.json();
  },

  async deleteExecucao(id) {
    const res = await fetch(`${API_URL}/execucoes/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async reiniciarExecucao(id) {
    const res = await fetch(`${API_URL}/execucoes/${id}/reiniciar`, {
      method: 'POST',
    });
    return res.json();
  },

  async reiniciarTodosExecucao(fluxoId) {
    const res = await fetch(`${API_URL}/fluxos/${fluxoId}/reiniciar-todos`, {
      method: 'POST',
    });
    return res.json();
  },

  // Fila
  async getFila() {
    const res = await fetch(`${API_URL}/fila`);
    return res.json();
  },

  async clearFila() {
    const res = await fetch(`${API_URL}/fila/limpar`, {
      method: 'POST',
    });
    return res.json();
  },

  // WhatsApp Conexão
  async getWppStatus() {
    const res = await fetch(`${API_URL}/wpp/status`);
    return res.json();
  },

  async toggleWppMock(enable) {
    const res = await fetch(`${API_URL}/wpp/mock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable }),
    });
    return res.json();
  },

  async connectWpp() {
    const res = await fetch(`${API_URL}/wpp/connect`, {
      method: 'POST',
    });
    return res.json();
  },

  async disconnectWpp() {
    const res = await fetch(`${API_URL}/wpp/disconnect`, {
      method: 'POST',
    });
    return res.json();
  },
};
