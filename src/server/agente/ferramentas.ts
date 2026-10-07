





























import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { admin } from '@/server/supabase'
import { buscarNaBase } from '@/server/agente/busca-base'
import { montarBlocoConhecimento } from '@/lib/canais/bloco-conhecimento'
import {
  TETO_ANOTACAO,
  chaveDaAnotacao,
  prefixoDaConversa,
  sanitizarAnotacao,
} from '@/lib/agente/anotacao-do-assistente'
import {
  TETO_CARACTERES_BLOCO,
  TETO_MENSAGENS_HISTORICO,
  cortarBloco,
  neutralizarCerca,
  rotularAutor,
  truncarTexto,
  type AutorDaMensagem,
} from '@/lib/canais/historico-agente'


export interface CtxFerramentas {
  workspaceId: string
  conversaId: string
  contatoId: string | null
  
  assistenteId: string | null
}


export type DefinicaoFerramenta = {
  id: string
  description: string
  inputSchema: z.ZodTypeAny
  execute: (input: unknown) => Promise<unknown>
}


const TETO_NEGOCIOS = 20


const TETO_CONSULTA = 1000


const TETO_ANOTACOES_POR_RODADA = 1


const TETO_ANOTACOES_POR_CONVERSA = 20


const SLUG_DO_TIPO = 'resumo_ia'


const SITUACAO: Record<string, string> = {
  aberto: 'em andamento',
  ganho: 'concluido',
  perdido: 'encerrado',
}

export function montarFerramentas(ctx: CtxFerramentas): Record<string, unknown> {
  
  let anotacoesNestaRodada = 0

  const ferramentas: Record<string, DefinicaoFerramenta> = {
    fichaDoContato: {
      id: 'fichaDoContato',
      description:
        'Dados de cadastro da pessoa com quem voce esta falando: nome, telefone, e-mail e a empresa dela. Use para se dirigir a ela pelo nome.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.contatoId) return { semContato: true }
        
        
        
        
        const { data, error } = await admin()
          .from('contatos')
          .select('nome, telefone, email, empresas(nome)')
          .eq('workspace_id', ctx.workspaceId)
          .eq('id', ctx.contatoId)
          .maybeSingle()
        
        
        if (error || !data) return { semContato: true }
        const linha = data as { nome?: string; telefone?: string; email?: string; empresas?: unknown }
        const empresa = Array.isArray(linha.empresas) ? linha.empresas[0] : linha.empresas
        
        
        
        
        return {
          nome: neutralizarCerca(linha.nome ?? ''),
          telefone: neutralizarCerca(linha.telefone ?? ''),
          email: neutralizarCerca(linha.email ?? ''),
          empresa: neutralizarCerca((empresa as { nome?: string } | null)?.nome ?? ''),
        }
      },
    },

    negociosDoContato: {
      id: 'negociosDoContato',
      
      
      
      
      
      description:
        'Quantos atendimentos esta pessoa tem com a empresa (`quantidade`, o total) e em que situacao esta cada um dos ate 20 mais recentes (`situacoes`). Use para saber se ja existe algo em andamento com ela. Se vier `naoConsegui`, nao afirme numero nenhum: diga que nao consegue ver isso agora.',
      inputSchema: z.object({}),
      execute: async () => {
        
        
        
        if (!ctx.contatoId) return { naoConsegui: true }
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        const { data, count, error } = await admin()
          .from('negocios')
          .select('status', { count: 'exact' })
          .eq('workspace_id', ctx.workspaceId)
          .eq('contato_id', ctx.contatoId)
          .order('criado_em', { ascending: false })
          .limit(TETO_NEGOCIOS)
        
        
        
        
        if (error || !data || typeof count !== 'number') return { naoConsegui: true }
        const situacoes = (data as Array<{ status?: string }>)
          .map((n) => SITUACAO[n.status ?? ''] ?? 'em andamento')
        return { quantidade: count, situacoes }
      },
    },

    historicoRecente: {
      id: 'historicoRecente',
      
      
      
      description:
        'Trechos de conversas ANTERIORES com esta mesma pessoa (`mensagens`). Use quando ela mencionar algo que ja falou com a empresa antes. Se vier `naoConsegui`, nao afirme que nao ha historico: diga que nao consegue ver isso agora.',
      
      
      
      
      
      
      
      inputSchema: z.object({}),
      execute: async () => {
        
        
        
        if (!ctx.contatoId) return { naoConsegui: true }
        
        
        
        
        
        
        
        
        
        
        
        const { data: conversas, error: erroConversas } = await admin()
          .from('conversas')
          .select('id')
          .eq('workspace_id', ctx.workspaceId)
          .eq('contato_id', ctx.contatoId)
          .order('atualizado_em', { ascending: false })
          .limit(TETO_NEGOCIOS)
        if (erroConversas || !conversas) return { naoConsegui: true }
        
        
        
        const ids = (conversas as Array<{ id: string }>).map((c) => c.id).filter((id) => id !== ctx.conversaId)
        
        
        
        if (ids.length === 0) return { mensagens: [] }

        const { data, error } = await admin()
          .from('mensagens')
          .select('direcao, autor, texto, origem_em')
          .eq('workspace_id', ctx.workspaceId)
          .in('conversa_id', ids)
          
          
          
          .in('status', ['recebida', 'pendente', 'enviada', 'entregue', 'lida'])
          .order('origem_em', { ascending: false })
          .limit(TETO_MENSAGENS_HISTORICO)
        if (error || !data) return { naoConsegui: true }

        const linhas = (data as Array<{ direcao: string; autor: AutorDaMensagem; texto: string }>)
          .filter((m) => (m.texto ?? '').trim())
          .reverse()
          
          
          
          .map((m) => {
            const corpo = neutralizarCerca(truncarTexto(m.texto))
            return m.direcao === 'entrada' ? `[cliente] ${corpo}` : rotularAutor(m.autor, corpo)
          })
        return { mensagens: cortarBloco(linhas, (l) => l.length, TETO_CARACTERES_BLOCO) }
      },
    },

    buscarBase: {
      id: 'buscarBase',
      description:
        'Procura na base de conhecimento da empresa o que responde uma duvida sobre preco, prazo, politica ou como as coisas funcionam. Use quando o cliente perguntar algo que voce nao pode inventar.',
      
      
      
      
      
      
      
      inputSchema: z.object({ consulta: z.string().min(1).max(TETO_CONSULTA) }),
      execute: async (input: unknown) => {
        const bruto = (input as { consulta?: unknown } | null)?.consulta
        const consulta = typeof bruto === 'string' ? bruto.slice(0, TETO_CONSULTA) : ''
        
        
        
        
        
        
        
        
        const achados = await buscarNaBase(ctx.workspaceId, consulta, {
          conversaId: ctx.conversaId,
          tipos: null,
          assistenteId: ctx.assistenteId,
        })
        
        
        
        
        
        
        
        
        
        
        
        
        
        return montarBlocoConhecimento(achados === 'indisponivel' ? 'indisponivel' : { achados })
      },
    },

    registrarNaFicha: {
      id: 'registrarNaFicha',
      
      
      
      
      
      
      
      
      
      
      
      description:
        'Guarda uma anotacao curta na ficha desta pessoa dentro do CRM da empresa, para a equipe ' +
        'ler depois. Use no MAXIMO uma vez, no fim do atendimento, e so quando houver fato novo ' +
        'que a equipe precise saber: o que a pessoa pediu, um dado que ela informou, ou a duvida ' +
        'que ficou sem resposta. NAO use para saudacao, conversa fiada, nem para repetir o que ' +
        'voce mesmo respondeu. A anotacao e interna: ela nao agenda nada, nao avisa ninguem e o ' +
        'cliente nao a ve — nunca diga a ele que voce registrou, anotou ou encaminhou alguma coisa.',
      
      
      
      inputSchema: z.object({ anotacao: z.string().min(1).max(TETO_ANOTACAO) }),
      execute: async (input: unknown) => {
        
        
        
        
        if (anotacoesNestaRodada >= TETO_ANOTACOES_POR_RODADA) {
          return { naoConsegui: true, motivo: 'voce ja registrou uma anotacao neste atendimento' }
        }
        
        
        
        
        
        if (!ctx.contatoId) {
          return { naoConsegui: true, motivo: 'esta conversa nao esta ligada a nenhuma ficha' }
        }
        
        
        const texto = sanitizarAnotacao((input as { anotacao?: unknown } | null)?.anotacao, TETO_ANOTACAO)
        
        
        
        if (!texto) return { naoConsegui: true, motivo: 'a anotacao ficou vazia' }

        
        
        
        
        const { data: tipo, error: erroTipo } = await admin()
          .from('tipos_atividade')
          .select('id')
          .eq('workspace_id', ctx.workspaceId)
          .eq('slug', SLUG_DO_TIPO)
          .maybeSingle()
        if (erroTipo || !tipo) {
          return { naoConsegui: true, motivo: 'nao consigo registrar agora' }
        }

        
        
        
        
        const { count, error: erroConta } = await admin()
          .from('atividades')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId)
          .like('chave_externa', `${prefixoDaConversa(ctx.conversaId)}%`)
        
        
        
        if (erroConta || typeof count !== 'number') {
          return { naoConsegui: true, motivo: 'nao consigo registrar agora' }
        }
        if (count >= TETO_ANOTACOES_POR_CONVERSA) {
          return { naoConsegui: true, motivo: 'ja ha anotacoes demais nesta ficha' }
        }

        const chave = chaveDaAnotacao(
          ctx.conversaId,
          createHash('sha256').update(texto).digest('hex'),
        )
        
        
        
        
        
        
        
        const { error: erroInsert } = await admin().from('atividades').insert({
          workspace_id: ctx.workspaceId,
          contato_id: ctx.contatoId,
          tipo_id: (tipo as { id: string }).id,
          autor: 'ia',
          conteudo: texto,
          chave_externa: chave,
        })
        if (erroInsert) {
          
          
          
          
          
          const codigo = (erroInsert as { code?: string }).code
          if (codigo === '23505') {
            anotacoesNestaRodada++
            return { jaRegistrado: true }
          }
          return { naoConsegui: true, motivo: 'nao consigo registrar agora' }
        }
        anotacoesNestaRodada++
        
        
        
        return { registrado: true }
      },
    },
  }
  return ferramentas
}
