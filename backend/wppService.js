import wppconnect from '@wppconnect-team/wppconnect';

// Estados de conexão possíveis: 'DISCONNECTED', 'CONNECTING', 'QRCODE', 'CONNECTED'
let connectionState = 'DISCONNECTED';
let qrCodeData = null; // Imagem do código QR em Base64
let wppClient = null;
let useMockMode = false; // Desabilitado por padrão para executar WPPConnect real na inicialização

// Callback para notificar o servidor sobre mudanças de estado (ex: enviar via WS)
let onStateChangeCallback = () => {};

// Log em memória das mensagens enviadas para visualização em tempo real na interface
const sentMessagesLog = [];

export const wppService = {
  getSettings() {
    return {
      connectionState,
      qrCodeData,
      useMockMode,
      sentMessagesLog: sentMessagesLog.slice(-50), // Retorna as últimas 50 mensagens
    };
  },

  setMockMode(enable) {
    useMockMode = enable;
    if (enable) {
      this.disconnect();
    } else {
      this.connectWpp();
    }
    notifyStateChange();
  },

  registerStateChangeCallback(callback) {
    onStateChangeCallback = callback;
  },

  logMockMessage(to, message, status, error = null) {
    const logEntry = {
      id: Math.random().toString(36).substr(2, 9),
      to,
      message,
      status, // 'sent' (enviado) ou 'failed' (falhou)
      error,
      timestamp: new Date().toISOString(),
      mode: useMockMode ? 'Mock' : 'WPPConnect',
    };
    sentMessagesLog.push(logEntry);
    if (sentMessagesLog.length > 200) {
      sentMessagesLog.shift();
    }
    notifyStateChange();
  },

  async connectWpp() {
    if (useMockMode) {
      connectionState = 'DISCONNECTED';
      qrCodeData = null;
      notifyStateChange();
      return;
    }

    if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
      return;
    }

    connectionState = 'CONNECTING';
    qrCodeData = null;
    notifyStateChange();

    try {
      console.log('Initializing WPPConnect...');
      wppClient = await wppconnect.create({
        session: 'whatsapp-automator',
        catchQR: (base64Qr, asciiQR, attempts, feedback) => {
          connectionState = 'QRCODE';
          qrCodeData = base64Qr;
          console.log(`QR Code generated. Attempt ${attempts}`);
          notifyStateChange();
        },
        statusFind: (statusSession, session) => {
          console.log(`Session Status: ${statusSession} - ${session}`);
          if (statusSession === 'isLogged' || statusSession === 'chatsAvailable') {
            connectionState = 'CONNECTED';
            qrCodeData = null;
            notifyStateChange();
          } else if (statusSession === 'notLogged') {
            connectionState = 'DISCONNECTED';
            notifyStateChange();
          }
        },
        headless: 'new', // Usa o modo headless mais recente
        autoClose: 0,
        devtools: false,
        logQR: false,
      });

      connectionState = 'CONNECTED';
      qrCodeData = null;
      console.log('WPPConnect client connected and ready.');
      
      wppClient.onStateChange((state) => {
        console.log(`WPPConnect client state changed: ${state}`);
        if (state === 'CONFLICT' || state === 'UNPAIRED') {
          connectionState = 'DISCONNECTED';
          wppClient = null;
          notifyStateChange();
        }
      });

      notifyStateChange();
    } catch (error) {
      console.error('Failed to initialize WPPConnect:', error);
      connectionState = 'DISCONNECTED';
      qrCodeData = null;
      notifyStateChange();
    }
  },

  async disconnect() {
    if (wppClient) {
      try {
        await wppClient.close();
      } catch (err) {
        console.error('Error closing WPPConnect client:', err);
      }
      wppClient = null;
    }
    connectionState = 'DISCONNECTED';
    qrCodeData = null;
    notifyStateChange();
    console.log('WPPConnect client disconnected.');
  },

  formatPhone(phone) {
    // Sanitiza e formata o número de telefone para a API do WhatsApp
    let cleaned = phone.replace(/\D/g, ''); // Mantém apenas dígitos
    
    // Ajustes simples para o código de área do Brasil:
    // Números brasileiros geralmente são: 55 + DDD + Número.
    // Se não tiver o DDI do país (comprimento 10 ou 11), adiciona 55.
    if (cleaned.length === 11 || cleaned.length === 10) {
      cleaned = '55' + cleaned;
    }
    
    // No Brasil, o WhatsApp às vezes descarta o nono dígito (terceira posição após 55) para números de celular na formatação da API.
    // Ex: 55 (DDD) 9xxxx-xxxx torna-se 55 (DDD) xxxx-xxxx.
    // Contudo, o WPPConnect geralmente funciona bem de ambas as formas, mas acrescentar @c.us é obrigatório.
    return `${cleaned}@c.us`;
  },

  async sendMessage(to, message) {
    if (useMockMode) {
      // Simulação do envio de mensagem
      console.log(`[MOCK SEND] Sending message to ${to}: "${message}"`);
      // Simula o atraso de rede
      await new Promise(resolve => setTimeout(resolve, 800));
      this.logMockMessage(to, message, 'sent');
      return { success: true, messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` };
    }

    if (connectionState !== 'CONNECTED' || !wppClient) {
      this.logMockMessage(to, message, 'failed', 'WPPConnect not authenticated');
      throw new Error('WhatsApp client is not authenticated. Please scan the QR Code.');
    }

    const formattedTo = this.formatPhone(to);
    console.log(`[WPP SEND] Sending real message to ${formattedTo}: "${message}"`);
    
    try {
      const result = await wppClient.sendText(formattedTo, message);
      this.logMockMessage(to, message, 'sent');
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error(`[WPP SEND ERROR] Failed to send to ${to}:`, error);
      this.logMockMessage(to, message, 'failed', error.message || error);
      throw error;
    }
  }
};

function notifyStateChange() {
  if (typeof onStateChangeCallback === 'function') {
    onStateChangeCallback(wppService.getSettings());
  }
}
