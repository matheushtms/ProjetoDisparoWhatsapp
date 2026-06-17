import { Op } from 'sequelize';
import { Contato, FilaEnvio, ExecucaoFluxo, FluxoEtapa, sequelize } from './database.js';
import { wppService } from './wppService.js';

let workerIntervalId = null;
let isProcessingQueue = false;
let isProcessingFlows = false;

// Callbacks para notificações em tempo real (WS)
let onQueueUpdate = () => {};
let onFlowUpdate = () => {};

export function registerWorkerCallbacks(callbacks) {
  if (callbacks.onQueueUpdate) onQueueUpdate = callbacks.onQueueUpdate;
  if (callbacks.onFlowUpdate) onFlowUpdate = callbacks.onFlowUpdate;
}

// 1. Processa a fila de mensagens
async function sendPendingMessages() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const pendingMessages = await FilaEnvio.findAll({
      where: {
        status: 'pending',
        agendadoPara: {
          [Op.lte]: new Date(),
        },
      },
      include: [
        { model: Contato }
      ],
      order: [['agendadoPara', 'ASC']],
      limit: 10, // Processa em pequenos lotes
    });

    if (pendingMessages.length > 0) {
      console.log(`[Worker] Found ${pendingMessages.length} pending messages to send.`);
    }

    for (const msg of pendingMessages) {
      // Define como enviando para evitar sobreposições
      msg.status = 'sending';
      await msg.save();
      onQueueUpdate();

      if (!msg.Contato) {
        msg.status = 'failed';
        msg.erro = 'Contato associado não encontrado.';
        await msg.save();
        onQueueUpdate();
        continue;
      }

      try {
        await wppService.sendMessage(msg.Contato.telefone, msg.mensagem);
        msg.status = 'sent';
        msg.enviadoEm = new Date();
        msg.erro = null;
      } catch (error) {
        msg.status = 'failed';
        msg.erro = error.message || String(error);
      }

      await msg.save();
      onQueueUpdate();
    }
  } catch (error) {
    console.error('[Worker Error] Queue processor encountered an error:', error);
  } finally {
    isProcessingQueue = false;
  }
}

// 2. Processa os fluxos de automação
async function processActiveFlows() {
  if (isProcessingFlows) return;
  isProcessingFlows = true;

  try {
    const activeExecutions = await ExecucaoFluxo.findAll({
      where: {
        status: 'running',
        proximaExecucao: {
          [Op.lte]: new Date(),
        },
      },
      include: [
        { model: Contato },
        { model: FluxoEtapa, as: 'etapaAtual' }
      ],
      limit: 10,
    });

    if (activeExecutions.length > 0) {
      console.log(`[Worker] Found ${activeExecutions.length} flows ready for execution.`);
    }

    for (const exec of activeExecutions) {
      let currentStep = exec.etapaAtual;
      
      // Se a etapa atual estiver ausente, busca a primeira etapa (fallback)
      if (!currentStep) {
        currentStep = await FluxoEtapa.findOne({
          where: { fluxoId: exec.fluxoId },
          order: [['ordem', 'ASC']],
        });

        if (!currentStep) {
          // Sem etapas neste fluxo! Conclui a execução.
          exec.status = 'completed';
          exec.etapaAtualId = null;
          exec.proximaExecucao = null;
          exec.ultimaExecucao = new Date();
          await exec.save();
          onFlowUpdate();
          continue;
        }
      }

      // Agenda a mensagem da etapa atual na FilaEnvio
      await FilaEnvio.create({
        contatoId: exec.contatoId,
        execucaoFluxoId: exec.id,
        mensagem: currentStep.mensagem,
        agendadoPara: new Date(), // Envia o quanto antes
        status: 'pending',
      });
      onQueueUpdate();

      // Encontra a próxima etapa
      const nextStep = await FluxoEtapa.findOne({
        where: {
          fluxoId: exec.fluxoId,
          ordem: {
            [Op.gt]: currentStep.ordem,
          },
        },
        order: [['ordem', 'ASC']],
      });

      if (nextStep) {
        // Agenda a próxima execução
        const nextDate = new Date(Date.now() + nextStep.delayMinutos * 60 * 1000);
        exec.etapaAtualId = nextStep.id;
        exec.proximaExecucao = nextDate;
        exec.ultimaExecucao = new Date();
        exec.status = 'running';
      } else {
        // O fluxo foi concluído
        exec.etapaAtualId = null;
        exec.proximaExecucao = null;
        exec.ultimaExecucao = new Date();
        exec.status = 'completed';
      }

      await exec.save();
      onFlowUpdate();
    }
  } catch (error) {
    console.error('[Worker Error] Flow processor encountered an error:', error);
  } finally {
    isProcessingFlows = false;
  }
}

// Inicia o ciclo do Worker
export function startWorker(intervalMs = 2000) {
  if (workerIntervalId) {
    console.log('[Worker] Worker already running.');
    return;
  }

  console.log(`[Worker] Starting background scheduler (interval: ${intervalMs}ms)...`);
  
  workerIntervalId = setInterval(async () => {
    await sendPendingMessages();
    await processActiveFlows();
  }, intervalMs);
}

// Interrompe o ciclo do Worker
export function stopWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('[Worker] Worker scheduler stopped.');
  }
}
