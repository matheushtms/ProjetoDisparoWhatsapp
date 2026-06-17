import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csvParser from 'csv-parser';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import { 
  initDb, 
  Contato, 
  Campanha, 
  FilaEnvio, 
  Fluxo, 
  FluxoEtapa, 
  ExecucaoFluxo 
} from './database.js';
import { wppService } from './wppService.js';
import { startWorker, registerWorkerCallbacks } from './worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Configura o Multer para uploads de arquivos CSV
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Configura o Servidor HTTP e o Servidor WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Transmite mensagens WebSocket para todos os clientes conectados
function broadcast(type, data) {
  const payload = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ----------------------------------------------------
// ROTAS DA API
// ----------------------------------------------------

// 1. Endpoints de Contatos
app.get('/api/contatos', async (req, res) => {
  try {
    const contatos = await Contato.findAll({ order: [['nome', 'ASC']] });
    res.json(contatos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contatos/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  const filePath = req.file.path;

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`[CSV Import] File content length: ${fileContent.length} chars`);
    const lines = fileContent.split(/\r?\n/);
    console.log(`[CSV Import] Total lines found: ${lines.length}`);
    const results = [];

    // Detecção Inteligente de Índices de Colunas
    let nameIndex = 0;
    let phoneIndex = 1;
    let hasHeader = false;

    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      let separator = ',';
      if (firstLine.includes(';')) separator = ';';

      const headers = firstLine.split(separator).map(c => c.replace(/['"]/g, '').trim().toLowerCase());
      console.log(`[CSV Import] Header columns found:`, headers);

      let foundNameIdx = -1;
      let foundPhoneIdx = -1;

      for (let i = 0; i < headers.length; i++) {
        const col = headers[i];
        // Checagem de prioridade para a coluna de nome
        if (col === 'nome' || col === 'name') {
          foundNameIdx = i;
        } else if (col === 'saved_name' && (foundNameIdx === -1 || headers[foundNameIdx] === 'public_name')) {
          foundNameIdx = i;
        } else if (col === 'public_name' && foundNameIdx === -1) {
          foundNameIdx = i;
        }

        // Checagem de prioridade para a coluna de telefone
        if (col === 'telefone' || col === 'phone' || col === 'phone_number') {
          foundPhoneIdx = i;
        }
      }

      if (foundNameIdx !== -1 && foundPhoneIdx !== -1) {
        nameIndex = foundNameIdx;
        phoneIndex = foundPhoneIdx;
        hasHeader = true;
        console.log(`[CSV Import] Smart Header detected! Mapping Name -> col[${nameIndex}], Phone -> col[${phoneIndex}]`);
      }
    }

    for (let idx = 0; idx < lines.length; idx++) {
      if (idx === 0 && hasHeader) {
        console.log(`[CSV Import] Skipping header row`);
        continue;
      }

      const line = lines[idx];
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }

      let separator = ',';
      if (trimmedLine.includes(';')) separator = ';';

      const columns = trimmedLine.split(separator);
      const maxNeededIdx = Math.max(nameIndex, phoneIndex);

      if (columns.length <= maxNeededIdx) {
        console.log(`[CSV Import] Line ${idx} has fewer columns than required (found ${columns.length}, need at least ${maxNeededIdx + 1}). Skipping.`);
        continue;
      }

      // Remove aspas se presentes
      const colName = columns[nameIndex].replace(/['"]/g, '').trim();
      const colPhone = columns[phoneIndex].replace(/['"]/g, '').trim();

      // Pula a linha do cabeçalho se não tivermos sinalizado (fallback)
      if (!hasHeader && (colName.toLowerCase() === 'nome' || colName.toLowerCase() === 'name')) {
        continue;
      }

      if (colName && colPhone) {
        results.push({ nome: colName, telefone: colPhone });
      }
    }

    console.log(`[CSV Import] Total parsed results count: ${results.length}`);

    let importedCount = 0;
    let skippedCount = 0;

    for (const item of results) {
      // Sanitização simples: mantém apenas dígitos
      const cleanPhone = item.telefone.replace(/\D/g, '');
      if (!cleanPhone) {
        console.log(`[CSV Import] Sanitized phone is empty for ${item.nome} (${item.telefone}), skipping`);
        skippedCount++;
        continue;
      }

      console.log(`[CSV Import] Saving contact: ${item.nome} | Raw phone: ${item.telefone} | Clean phone: ${cleanPhone}`);

      // Verifica duplicados ou atualiza o nome
      const [contato, created] = await Contato.findOrCreate({
        where: { telefone: cleanPhone },
        defaults: { nome: item.nome }
      });

      if (created) {
        console.log(`[CSV Import] Contact created: ${item.nome} (${cleanPhone})`);
        importedCount++;
      } else {
        contato.nome = item.nome;
        await contato.save();
        console.log(`[CSV Import] Contact updated: ${item.nome} (${cleanPhone})`);
        importedCount++;
      }
    }

    // Remove o arquivo de upload temporário
    fs.unlinkSync(filePath);

    broadcast('CONTATOS_UPDATED', { importedCount });
    res.json({ success: true, importedCount, skippedCount });
  } catch (error) {
    console.error('Error importing CSV:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contatos/:id', async (req, res) => {
  try {
    const deleted = await Contato.destroy({ where: { id: req.params.id } });
    broadcast('CONTATOS_UPDATED', { deleted });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contatos', async (req, res) => {
  try {
    await Contato.destroy({ where: {}, truncate: false });
    broadcast('CONTATOS_UPDATED', { deletedAll: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Endpoints de Campanhas
app.get('/api/campanhas', async (req, res) => {
  try {
    const campanhas = await Campanha.findAll({
      order: [['createdAt', 'DESC']],
    });

    // Conta estatísticas de envio para cada campanha
    const formattedCampanhas = await Promise.all(campanhas.map(async (camp) => {
      const pending = await FilaEnvio.count({ where: { campanhaId: camp.id, status: 'pending' } });
      const sending = await FilaEnvio.count({ where: { campanhaId: camp.id, status: 'sending' } });
      const sent = await FilaEnvio.count({ where: { campanhaId: camp.id, status: 'sent' } });
      const failed = await FilaEnvio.count({ where: { campanhaId: camp.id, status: 'failed' } });
      
      let status = camp.status;
      // Completa automaticamente o status da campanha se todos os envios forem concluídos
      if (camp.status === 'sending' && pending === 0 && sending === 0) {
        camp.status = 'completed';
        await camp.save();
        status = 'completed';
      }

      return {
        ...camp.toJSON(),
        status,
        stats: { pending, sending, sent, failed, total: pending + sending + sent + failed }
      };
    }));

    res.json(formattedCampanhas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campanhas', async (req, res) => {
  const { nome, mensagem, delayMin, delayMax, contatosIds } = req.body;

  if (!nome || !mensagem || !contatosIds || contatosIds.length === 0) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    const minDelay = parseInt(delayMin) || 5;
    const maxDelay = parseInt(delayMax) || 15;

    // Busca os contatos de destino
    const contatos = await Contato.findAll({ where: { id: contatosIds } });
    if (contatos.length === 0) {
      return res.status(400).json({ error: 'Nenhum contato válido encontrado.' });
    }

    // Salva a campanha
    const campanha = await Campanha.create({
      nome,
      mensagem,
      delayMin: minDelay,
      delayMax: maxDelay,
      status: 'sending'
    });

    // Escalona os agendamentos sequencialmente
    let currentScheduleTime = Date.now();
    const recordsToInsert = [];

    for (let i = 0; i < contatos.length; i++) {
      // Calcula atraso aleatório em segundos entre delayMin e delayMax
      const randomSec = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      currentScheduleTime += randomSec * 1000;

      recordsToInsert.push({
        contatoId: contatos[i].id,
        campanhaId: campanha.id,
        mensagem: mensagem,
        agendadoPara: new Date(currentScheduleTime),
        status: 'pending',
      });
    }

    // Insere na fila em lote (bulkCreate)
    await FilaEnvio.bulkCreate(recordsToInsert);

    broadcast('CAMPANHA_CREATED', campanha);
    broadcast('QUEUE_UPDATED', {});

    res.json({ success: true, campanhaId: campanha.id, count: recordsToInsert.length });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Endpoints de Fluxos
app.get('/api/fluxos', async (req, res) => {
  try {
    const fluxos = await Fluxo.findAll({
      include: [{ model: FluxoEtapa, as: 'etapas' }],
      order: [
        ['nome', 'ASC'],
        [{ model: FluxoEtapa, as: 'etapas' }, 'ordem', 'ASC']
      ]
    });
    res.json(fluxos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fluxos', async (req, res) => {
  const { nome } = req.body;
  if (!nome) {
    return res.status(400).json({ error: 'Nome do fluxo é obrigatório.' });
  }

  try {
    const fluxo = await Fluxo.create({ nome });
    res.json(fluxo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/fluxos/:id', async (req, res) => {
  try {
    await Fluxo.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoints de Etapas de Fluxo
app.post('/api/fluxos/:id/etapas', async (req, res) => {
  const { mensagem, delayMinutos, ordem } = req.body;
  const fluxoId = req.params.id;

  if (!mensagem || delayMinutos === undefined || ordem === undefined) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    const etapa = await FluxoEtapa.create({
      fluxoId,
      ordem: parseInt(ordem),
      mensagem,
      delayMinutos: parseFloat(delayMinutos),
    });
    res.json(etapa);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/fluxos/etapas/:etapaId', async (req, res) => {
  try {
    const etapaId = req.params.etapaId;
    const etapa = await FluxoEtapa.findByPk(etapaId);
    if (!etapa) {
      return res.status(404).json({ error: 'Etapa não encontrada.' });
    }
    const fluxoId = etapa.fluxoId;

    await etapa.destroy();

    // Reordena as etapas restantes
    const remainingSteps = await FluxoEtapa.findAll({
      where: { fluxoId },
      order: [['ordem', 'ASC']]
    });

    for (let i = 0; i < remainingSteps.length; i++) {
      remainingSteps[i].ordem = i + 1;
      await remainingSteps[i].save();
    }

    broadcast('FLOWS_UPDATED', {});
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting stage and reordering:', error);
    res.status(500).json({ error: error.message });
  }
});

// Adiciona contatos à execução do fluxo (Entrada no Fluxo)
app.post('/api/fluxos/:id/entrar', async (req, res) => {
  const fluxoId = parseInt(req.params.id, 10);
  const { contatosIds } = req.body;

  if (!contatosIds || contatosIds.length === 0) {
    return res.status(400).json({ error: 'Selecione pelo menos um contato.' });
  }

  try {
    // Verifica se o fluxo existe
    const fluxo = await Fluxo.findByPk(fluxoId, {
      include: [{ model: FluxoEtapa, as: 'etapas', order: [['ordem', 'ASC']] }]
    });

    if (!fluxo) {
      return res.status(404).json({ error: 'Fluxo não encontrado.' });
    }

    // Obtém a primeira etapa se existir
    const firstStep = fluxo.etapas && fluxo.etapas.length > 0 
      ? fluxo.etapas.sort((a, b) => a.ordem - b.ordem)[0] 
      : null;

    // Busca os contatos de destino
    const contatos = await Contato.findAll({ where: { id: contatosIds } });

    let startedCount = 0;
    let skippedCount = 0;
    
    for (const contato of contatos) {
      // Verifica se o contato já está cadastrado neste fluxo
      const existing = await ExecucaoFluxo.findOne({
        where: {
          contatoId: contato.id,
          fluxoId: fluxoId,
        }
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      // Calcula atraso inicial: A primeira etapa roda em NOW() + delayMinutos
      // Se não houver etapas, agenda para verificação imediata pelo worker
      const startTime = firstStep 
        ? new Date(Date.now() + firstStep.delayMinutos * 60 * 1000)
        : new Date();

      await ExecucaoFluxo.create({
        contatoId: contato.id,
        fluxoId: fluxoId,
        etapaAtualId: firstStep ? firstStep.id : null,
        status: 'running',
        proximaExecucao: startTime,
      });

      startedCount++;
    }

    broadcast('FLOWS_UPDATED', {});
    broadcast('QUEUE_UPDATED', {});

    res.json({ success: true, startedCount, skippedCount });
  } catch (error) {
    console.error('Error entering flow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exclui execução de fluxo (Remove contato do fluxo)
app.delete('/api/execucoes/:id', async (req, res) => {
  try {
    const deleted = await ExecucaoFluxo.destroy({ where: { id: req.params.id } });
    broadcast('FLOWS_UPDATED', { deleted });
    broadcast('QUEUE_UPDATED', {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicia/Reinicia execução de fluxo
app.post('/api/execucoes/:id/reiniciar', async (req, res) => {
  try {
    const exec = await ExecucaoFluxo.findByPk(req.params.id);
    if (!exec) {
      return res.status(404).json({ error: 'Execução não encontrada.' });
    }

    // Obtém a primeira etapa do fluxo
    const firstStep = await FluxoEtapa.findOne({
      where: { fluxoId: exec.fluxoId },
      order: [['ordem', 'ASC']]
    });

    // Redefine o estado de execução para iniciar imediatamente
    exec.status = 'running';
    exec.etapaAtualId = firstStep ? firstStep.id : null;
    exec.proximaExecucao = new Date(); // Inicia imediatamente
    exec.ultimaExecucao = null;
    await exec.save();

    broadcast('FLOWS_UPDATED', {});
    broadcast('QUEUE_UPDATED', {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicia/Reinicia execução de fluxo para TODOS os contatos no fluxo
app.post('/api/fluxos/:id/reiniciar-todos', async (req, res) => {
  try {
    const fluxoId = parseInt(req.params.id, 10);
    const execucoes = await ExecucaoFluxo.findAll({
      where: { fluxoId }
    });

    if (execucoes.length === 0) {
      return res.json({ success: true, count: 0, message: 'Nenhum contato cadastrado neste fluxo.' });
    }

    // Obtém a primeira etapa do fluxo
    const firstStep = await FluxoEtapa.findOne({
      where: { fluxoId },
      order: [['ordem', 'ASC']]
    });

    // Redefine o estado de execução para iniciar imediatamente para todos eles
    for (const exec of execucoes) {
      exec.status = 'running';
      exec.etapaAtualId = firstStep ? firstStep.id : null;
      exec.proximaExecucao = new Date(); // Inicia imediatamente
      exec.ultimaExecucao = null;
      await exec.save();
    }

    broadcast('FLOWS_UPDATED', {});
    broadcast('QUEUE_UPDATED', {});
    res.json({ success: true, count: execucoes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtém status das execuções dos fluxos
app.get('/api/execucoes', async (req, res) => {
  try {
    const execucoes = await ExecucaoFluxo.findAll({
      include: [
        { model: Contato },
        { model: Fluxo },
        { model: FluxoEtapa, as: 'etapaAtual' }
      ],
      order: [['updatedAt', 'DESC']],
    });
    res.json(execucoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Endpoints de Fila
app.get('/api/fila', async (req, res) => {
  try {
    const fila = await FilaEnvio.findAll({
      include: [
        { model: Contato },
        { model: Campanha }
      ],
      order: [['agendadoPara', 'DESC']],
      limit: 150, // Limita os resultados para manter o tamanho do payload aceitável
    });
    res.json(fila);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fila/limpar', async (req, res) => {
  try {
    // Exclui todas as mensagens pendentes da fila
    await FilaEnvio.destroy({ where: {} });
    // Limpa as execuções de fluxo também se houver limpeza completa
    await ExecucaoFluxo.destroy({ where: {} });
    broadcast('QUEUE_UPDATED', {});
    broadcast('FLOWS_UPDATED', {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Endpoints de Sessão e Conexão do WhatsApp
app.get('/api/wpp/status', (req, res) => {
  res.json(wppService.getSettings());
});

app.post('/api/wpp/mock', (req, res) => {
  const { enable } = req.body;
  wppService.setMockMode(enable);
  res.json(wppService.getSettings());
});

app.post('/api/wpp/connect', async (req, res) => {
  // Executa de forma assíncrona
  wppService.connectWpp();
  res.json({ success: true, message: 'Inicializando WPPConnect em background.' });
});

app.post('/api/wpp/disconnect', async (req, res) => {
  await wppService.disconnect();
  res.json(wppService.getSettings());
});

// ----------------------------------------------------
// INICIALIZAÇÃO
// ----------------------------------------------------

// Gerencia conexões WebSocket
wss.on('connection', (ws) => {
  console.log('[WS] Client connected.');
  // Envia as configurações atuais logo após conectar
  ws.send(JSON.stringify({ type: 'WPP_STATUS', data: wppService.getSettings() }));

  ws.on('close', () => {
    console.log('[WS] Client disconnected.');
  });
});

// Registra callbacks do worker para disparar atualizações via WS
registerWorkerCallbacks({
  onQueueUpdate: () => broadcast('QUEUE_UPDATED', {}),
  onFlowUpdate: () => broadcast('FLOWS_UPDATED', {}),
});

// Registra callback de mudança de estado do WhatsApp para transmitir aos clientes
wppService.registerStateChangeCallback((settings) => {
  broadcast('WPP_STATUS', settings);
});

// Inicia Banco de dados, Worker e Servidor
async function main() {
  await initDb();
  
  // Inicia o agendador do worker em background (varre o banco a cada 2 segundos)
  startWorker(2000);

  // Se o modo mock estiver desativado, inicia o processo de conexão no boot automaticamente
  if (!wppService.getSettings().useMockMode) {
    console.log('[Server] Mock mode is disabled by default. Auto-connecting to WPPConnect...');
    wppService.connectWpp();
  }

  server.listen(port, () => {
    console.log(`[Server] Express API running on http://localhost:${port}`);
    console.log(`[Server] WebSocket Server attached to same port.`);
  });
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
