# WhatsApp Automator — Disparador com Fluxos Automáticos

Este repositório contém a solução do **Desafio Técnico para Desenvolvimento de Disparador WhatsApp com Fluxos Automáticos**.

O sistema é composto por uma arquitetura resiliente com persistência em banco de dados local SQLite, execução de automação em segundo plano (Worker independente de navegador) e um painel administrativo moderno em React (Vite) + Tailwind CSS com atualizações em tempo real via WebSocket.

---

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** com Express para as APIs.
- **Sequelize ORM** para modelagem e persistência.
- **SQLite3** como banco de dados embarcado (arquivo local `database.sqlite`).
- **Multer** e **CSV-Parser** para importação de contatos em lote via upload.
- **WebSocket (ws)** para comunicação bidirecional com o frontend.
- **WPPConnect** para integração com disparos reais do WhatsApp e geração de QR Code.

### Frontend
- **React** com **Vite** para interface rápida de única página (SPA).
- **Tailwind CSS** para design moderno, fluido e premium em Dark Mode.
- **Lucide React** para iconografia.
- **WebSockets** nativo para escuta de eventos do disparador em tempo real.

---

## 🏗️ Arquitetura e Estrutura do Banco

O banco de dados foi estruturado com as 6 tabelas mínimas exigidas (e suas relações):

1. **`contatos`**: Armazena `nome`, `telefone` (único) e timestamps de criação.
2. **`campanhas`**: Registra as campanhas simples com mensagens e limites de delay aleatório (`delayMin`, `delayMax`, `status`).
3. **`fila_envio`**: Fila centralizadora de mensagens. Armazena `mensagem`, `agendadoPara` (timestamp calculado), `enviadoEm`, `status` (`pending`, `sending`, `sent`, `failed`) e o campo `erro` caso falhe. Mapeia chaves estrangeiras para `contatos`, `campanhas` e `execucao_fluxo`.
4. **`fluxos`**: Armazena os fluxos de automação criados (`nome`).
5. **`fluxo_etapas`**: Etapas sequenciais de cada fluxo, contendo a `mensagem`, a `ordem` e o `delayMinutos` de atraso.
6. **`execucao_fluxo`**: Controle de estado individual para cada contato dentro de um fluxo. Mantém o `status` (`running`, `completed`), a `etapaAtualId` em execução, a data da `ultimaExecucao` e a data de agendamento da `proximaExecucao`.
   - **Índice Único Composto**: Possui um índice composto nas colunas `['contatoId', 'fluxoId']` para garantir a unicidade de inscrições e evitar que um contato seja adicionado repetidamente no mesmo fluxo.

---

## ⚙️ Mecanismo de Funcionamento e Regras de Negócio

### 1. Sem setTimeout direto no Controller
Quando uma **Campanha de Disparo Simples** é iniciada, o backend calcula as datas de agendamento sequenciais espaçadas aleatoriamente (ex: se o delay é de 5 a 15s: Contato 1 recebe em `Agora + Rnd(5-15)`, Contato 2 em `Contato 1 + Rnd(5-15)`, etc.). Essas mensagens são salvas em lote na tabela `fila_envio` com o status `'pending'`. O endpoint da API retorna imediatamente.

### 2. Automação de Fluxo contato a contato
Ao "Adicionar lista ao fluxo", o sistema cria um registro na tabela `execucao_fluxo` para cada contato selecionado, agendando a primeira etapa. O worker gerencia esses registros de forma individualizada. Assim que a primeira etapa é processada (enviada para a `fila_envio`), o worker verifica se há uma etapa seguinte e agenda o tempo da próxima etapa na coluna `proximaExecucao`.

### 3. Worker/Agendador Continuo e Resiliente
O backend inicia uma rotina que roda a cada **2 segundos** pesquisando o banco de dados por:
- Mensagens na fila (`fila_envio`) com status `pending` e `agendadoPara <= NOW()`.
- Execuções de fluxo (`execucao_fluxo`) com status `running` e `proximaExecucao <= NOW()`.

**Resiliência:** Como todo o estado e as datas de agendamento estão salvos no SQLite, se o servidor backend for fechado e reiniciado 1 hora depois, o worker identificará as mensagens atrasadas e as processará imediatamente, sem perder o progresso ou pular etapas do fluxo dos contatos.

### 4. Modo Mock de Testes vs. Disparos Reais
Para facilitar a avaliação sem depender de escanear o QR Code de um WhatsApp pessoal:
- O sistema inicia em **Modo Mock (Simulado)** por padrão. As mensagens são geradas e atualizadas na fila instantaneamente e exibidas no painel de logs em tempo real.
- Na aba **Conexão WhatsApp**, você pode desativar o modo mock. O backend inicializará o **WPPConnect**, abrirá uma instância headless do Chromium e exibirá o QR Code diretamente no painel web para leitura.

---

## 🌟 Recursos Adicionados Durante a Iteração

Para tornar o sistema mais completo, profissional e aderente aos requisitos do usuário:
- **Pesquisa e Filtros de Contatos:** Barra de pesquisa no painel de contatos para filtrar e selecionar destinatários por nome ou número de telefone em tempo real.
- **Prevenção de Duplicidades:** Validação robusta de restrição no banco de dados e na API que impede a reinserção de um contato que já está executando ou completou o fluxo em questão. O painel retorna um feedback descritivo sobre contatos novos inseridos e contatos pulados.
- **Controle de Execução Individual e em Lote (Botões Play):**
  - Botão **Play Individual** na tabela de execuções para disparar ou reiniciar o fluxo imediatamente para aquele contato específico.
  - Botão **Disparar para Todos** para reiniciar e iniciar o fluxo imediatamente em lote para todos os inscritos naquele fluxo.
- **Exclusão de Contatos do Fluxo (Cascade):** Possibilidade de remover um contato da execução do fluxo a qualquer momento, o que limpa automaticamente da fila de disparos todas as mensagens pendentes correspondentes daquele contato (exclusão em cascata).
- **Ajuste de Sequenciamento Dinâmico (Reordenação de Etapas):** Quando uma etapa é excluída no editor de fluxo, o backend reorganiza automaticamente os números de ordem sequencial das etapas restantes de `1` a `N`. O formulário de criação preenche automaticamente o número da próxima ordem sequencial disponível.
- **Diálogos Visuais Premium:** Substituição completa de `alert` e `confirm` nativos por um sistema de Toasts flutuantes elegantes e Modais de Confirmação customizados no centro da tela com efeito de vidro (glassmorphism) e animações suaves.

---

## 🚀 Como Executar o Projeto

Certifique-se de possuir o **Node.js** instalado em sua máquina.

### Passo 1: Configurar e rodar o Backend
1. Abra um terminal na pasta do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
   *(O servidor de API rodará em `http://localhost:5000`)*

### Passo 2: Configurar e rodar o Frontend
1. Abra outro terminal na pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor Vite:
   ```bash
   npm run dev
   ```
4. Abra o navegador no endereço indicado (normalmente `http://localhost:5173`).

---

## 📂 Arquivo CSV de Exemplo
Para testar a importação de contatos, crie um arquivo com a extensão `.csv` (ex: `contatos.csv`) contendo os dados no formato abaixo:
```csv
Matheus Soares,5521999999999
Ana Silva,5511988888888
Lucas Souza,5531977777777
```
