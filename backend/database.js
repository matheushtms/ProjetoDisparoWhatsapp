import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false, // Defina para console.log para visualizar as consultas SQL
});

// Definições de Modelos
export const Contato = sequelize.define('Contato', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telefone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Evita contatos duplicados por telefone
  },
}, {
  tableName: 'contatos',
  timestamps: true,
});

export const Campanha = sequelize.define('Campanha', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  delayMin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
  },
  delayMax: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending', // 'pending' (pendente), 'sending' (enviando), 'completed' (concluído)
  },
}, {
  tableName: 'campanhas',
  timestamps: true,
});

export const FilaEnvio = sequelize.define('FilaEnvio', {
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  agendadoPara: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  enviadoEm: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending', // 'pending' (pendente), 'sent' (enviado), 'failed' (falhou)
  },
  erro: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'fila_envio',
  timestamps: true,
});

export const Fluxo = sequelize.define('Fluxo', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'fluxos',
  timestamps: true,
});

export const FluxoEtapa = sequelize.define('FluxoEtapa', {
  ordem: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  delayMinutos: {
    type: DataTypes.FLOAT, // Float permite frações (ex: 0.1 minutos = 6 segundos) para testes rápidos
    allowNull: false,
    defaultValue: 1.0,
  },
}, {
  tableName: 'fluxo_etapas',
  timestamps: true,
});

export const ExecucaoFluxo = sequelize.define('ExecucaoFluxo', {
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'running', // 'running' (executando), 'completed' (concluído), 'failed' (falhou), 'paused' (pausado)
  },
  ultimaExecucao: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  proximaExecucao: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'execucao_fluxo',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['contatoId', 'fluxoId']
    }
  ]
});

// Relacionamentos
// Contato <-> FilaEnvio
Contato.hasMany(FilaEnvio, { foreignKey: 'contatoId', onDelete: 'CASCADE' });
FilaEnvio.belongsTo(Contato, { foreignKey: 'contatoId' });

// Campanha <-> FilaEnvio
Campanha.hasMany(FilaEnvio, { foreignKey: 'campanhaId', onDelete: 'SET NULL' });
FilaEnvio.belongsTo(Campanha, { foreignKey: 'campanhaId' });

// Fluxo <-> FluxoEtapa
Fluxo.hasMany(FluxoEtapa, { foreignKey: 'fluxoId', as: 'etapas', onDelete: 'CASCADE' });
FluxoEtapa.belongsTo(Fluxo, { foreignKey: 'fluxoId' });

// Contato <-> ExecucaoFluxo
Contato.hasMany(ExecucaoFluxo, { foreignKey: 'contatoId', onDelete: 'CASCADE' });
ExecucaoFluxo.belongsTo(Contato, { foreignKey: 'contatoId' });

// Fluxo <-> ExecucaoFluxo
Fluxo.hasMany(ExecucaoFluxo, { foreignKey: 'fluxoId', onDelete: 'CASCADE' });
ExecucaoFluxo.belongsTo(Fluxo, { foreignKey: 'fluxoId' });

// ExecucaoFluxo <-> FluxoEtapa (Etapa Atual)
ExecucaoFluxo.belongsTo(FluxoEtapa, { foreignKey: 'etapaAtualId', as: 'etapaAtual', onDelete: 'SET NULL' });

// ExecucaoFluxo <-> FilaEnvio
ExecucaoFluxo.hasMany(FilaEnvio, { foreignKey: 'execucaoFluxoId', onDelete: 'CASCADE' });
FilaEnvio.belongsTo(ExecucaoFluxo, { foreignKey: 'execucaoFluxoId' });

export async function initDb() {
  try {
    await sequelize.authenticate();
    // Evita alter:true para prevenir erros de chave estrangeira no SQLite
    await sequelize.sync();
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect/sync to the database:', error);
    throw error;
  }
}

export { sequelize };
