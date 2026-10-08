# Relatório de segurança — Awave CRM

**Data da análise:** 2026-10-08  
**Versão observada:** 0.9.5  
**Checkout analisado:** `main`, commit `e43fe5d`  
**Tipo de instalação:** cópia/customização do comprador

## Resumo executivo

Este diretório não contém o repositório-fonte completo do Awave CRM. Ele contém
uma instalação/customização do produto, com a área `custom/` preservada para
alterações do comprador. Por isso, não é possível corrigir diretamente os
achados abaixo sem acesso ao código-fonte principal ou a uma versão oficial
mantida pelo fornecedor.

Foram identificados três problemas que devem ser encaminhados ao responsável
pelo core do produto:

| # | Severidade | Área | Problema |
|---|---|---|---|
| 1 | Alta | Atualizações | Pacotes ZIP de atualização são extraídos sem verificação criptográfica de assinatura ou hash assinado. |
| 2 | Alta | Configurações | Ações administrativas de credenciais de API e webhooks aparentemente não exigem papel de owner/admin. |
| 3 | Média | Atualizações via Git | Token do GitHub é inserido na URL usada pelo processo `git`, podendo aparecer em argumentos ou diagnósticos do servidor. |

## Limitação de escopo

As regras de `AGENTS.md` e `custom/LEIA-ME.md` determinam que customizações do
comprador devem ficar dentro de `custom/`. Alterar arquivos do produto em
`src/` faria a alteração ser sobrescrita na próxima atualização.

Os três achados estão fora da superfície de extensão documentada. Criar uma
implementação paralela em `custom/` não corrigiria o caminho vulnerável do
produto e poderia criar uma falsa sensação de segurança.

## Achados

### 1. Atualização sem verificação criptográfica do artefato

**Severidade:** Alta  
**Confiança:** 8/10  
**Arquivo observado:** `src/server/atualizacao/aplicar.ts`  
**Trechos:** linhas 86–100 e 135–143

O fluxo aceita a resposta HTTP da origem de atualização e prossegue para a
validação estrutural e extração do ZIP, mas não foi encontrada verificação de
uma assinatura criptográfica do artefato nem de um manifesto de hashes assinado.

Se a origem de atualização, o canal de publicação ou a comunicação intermediária
forem comprometidos, um ZIP malicioso poderá introduzir código com os privilégios
do servidor. O impacto potencial inclui acesso a variáveis de ambiente, banco de
dados, integrações e dados de todos os workspaces hospedados.

**Correção recomendada ao fornecedor:**

1. Publicar um manifesto de release contendo o hash SHA-256 do artefato.
2. Assinar o manifesto ou o próprio artefato com uma chave privada mantida fora
   do servidor de atualização.
3. Embutir a chave pública confiável no produto ou distribuí-la por mecanismo
   autenticado de confiança.
4. Verificar assinatura e hash antes de extrair qualquer arquivo.
5. Recusar artefatos sem assinatura válida, com hash divergente ou de versão
   inesperada.
6. Adicionar testes para artefato adulterado, não assinado e assinado por chave
   desconhecida.

### 2. Ações sensíveis de configuração sem autorização administrativa explícita

**Severidade:** Alta  
**Confiança:** 9/10  
**Arquivo observado:** `src/app/(app)/config/acoes.ts`  
**Trechos:** linhas 20–40 e 58–85

As ações analisadas verificam sessão e contexto do workspace, mas não foi
encontrada uma checagem explícita de owner/admin antes de:

- criar ou regenerar credenciais de API;
- alterar o endpoint de webhook;
- regenerar o segredo do webhook.

Caso a ação seja acessível a qualquer membro comum, um usuário interno com
permissão limitada poderá criar credenciais de integração, redirecionar eventos
para um endpoint controlado por ele ou invalidar o segredo usado por integrações
existentes.

**Correção recomendada ao fornecedor:**

1. Criar uma autorização centralizada para administração de integrações.
2. Exigir owner/admin ou uma permissão específica de gerenciamento de
   integrações em cada Server Action.
3. Aplicar a mesma autorização no servidor, sem depender apenas de ocultar
   botões na interface.
4. Registrar auditoria para criação, revogação e regeneração de credenciais e
   segredos.
5. Adicionar testes garantindo que membro comum recebe negação e owner/admin
   autorizado consegue executar a operação.
6. Invalidar sessões ou credenciais antigas conforme a política definida para
   regeneração.

### 3. Token do GitHub exposto na URL do processo `git`

**Severidade:** Média  
**Confiança:** 9/10  
**Arquivo observado:** `src/server/atualizacao/git.ts`  
**Trecho:** linha 47–48

O token é incorporado em uma URL HTTPS no formato de autenticação do Git e
passado ao processo. Dependendo do sistema operacional, do modo de execução e
das ferramentas de diagnóstico, essa informação pode aparecer na lista de
processos, em dumps, telemetria ou logs de erro.

**Correção recomendada ao fornecedor:**

1. Remover o token dos argumentos do processo.
2. Usar `GIT_ASKPASS`, um credential helper seguro ou mecanismo equivalente.
3. Garantir que mensagens de erro e logs removam qualquer URL autenticada.
4. Rotacionar tokens que possam ter sido expostos.
5. Adicionar um teste que confirme que o segredo não aparece nos argumentos
   registrados do processo.

## Ações imediatas para o administrador da instalação

Enquanto uma versão corrigida não estiver disponível:

1. Restringir o acesso ao painel de administração e às configurações de
   integração ao menor número possível de usuários.
2. Revisar os membros e papéis de todos os workspaces.
3. Não executar atualizações de origem desconhecida ou fora do canal oficial.
4. Restringir a saída de rede do servidor quando operacionalmente possível e
   monitorar conexões para destinos inesperados.
5. Rotacionar credenciais de API, webhooks e tokens de atualização caso haja
   suspeita de exposição.
6. Preservar logs de atualizações, alterações de configuração e chamadas de
   integração para investigação.
7. Solicitar ao fornecedor confirmação formal sobre assinatura de artefatos,
   autorização por papel e tratamento seguro de tokens.

Estas medidas reduzem o risco operacional, mas não substituem as correções no
core.

## Solicitação ao fornecedor/desenvolvedor

Solicita-se uma versão corrigida ou um patch oficial que:

- valide criptograficamente todos os artefatos de atualização antes da extração;
- exija autorização owner/admin ou permissão equivalente nas ações sensíveis de
  configuração;
- elimine tokens secretos dos argumentos de processos Git;
- inclua testes automatizados e notas de versão para as três correções;
- informe se houve exposição histórica de tokens ou artefatos sem assinatura e
  quais credenciais devem ser rotacionadas.

## Evidência e limitações da análise

Esta análise foi feita sobre o checkout local disponível, sem acesso a:

- repositório-fonte externo ou branch privada do fornecedor;
- ambiente de produção;
- configuração administrativa de branch protection ou CI remoto;
- histórico de atualizações baixadas;
- logs e credenciais reais da instalação.

As conclusões indicam riscos no código observado. A exploração em produção não
foi realizada, e nenhuma credencial foi acessada ou incluída neste relatório.

## Referências locais

- `custom/LEIA-ME.md` — delimita a área de customização e proíbe dependências
  diretas em módulos internos de `src/`.
- `custom/ARQUITETURA.md` — descreve a arquitetura, o modelo multi-tenant e a
  superfície de atualização.
- `AGENTS.md` — determina que alterações fora de `custom/` são sobrescritas nas
  atualizações do produto.
