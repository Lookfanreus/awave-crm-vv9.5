import { erroV1 } from '@/server/api/erro'
import {
  CrmError, CrmNegocioNaoEncontrado, CrmEtapaNaoEncontrada, CrmEtapaDeOutroPipeline,
  CrmAtividadeSemAlvo, CrmSemPipelinePadrao, CrmContatoNomeObrigatorio, CrmCamposInvalidos,
  CrmCamposObrigatorios, CrmNegocioTituloObrigatorio, CrmAutomacaoInvalida, CrmAutomacaoAlvoInvalido,
} from '@/server/crm/erros'


export function mapearErroCrm(err: unknown): Response {
  if (err instanceof CrmNegocioNaoEncontrado || err instanceof CrmEtapaNaoEncontrada)
    return erroV1('nao_encontrado', err.message, 404)
  if (err instanceof CrmEtapaDeOutroPipeline || err instanceof CrmAtividadeSemAlvo || err instanceof CrmContatoNomeObrigatorio || err instanceof CrmNegocioTituloObrigatorio || err instanceof CrmAutomacaoAlvoInvalido)
    return erroV1('entrada_invalida', err.message, 422)
  if (err instanceof CrmSemPipelinePadrao)
    return erroV1('config_incompleta', err.message, 409)
  
  if (err instanceof CrmCamposInvalidos)
    return erroV1('campo_invalido', err.message, 422, { campos: err.slugs })
  if (err instanceof CrmCamposObrigatorios)
    return erroV1('campos_obrigatorios', err.message, 422, { campos: err.slugs })
  
  
  if (err instanceof CrmAutomacaoInvalida)
    return erroV1('automacao_invalida', err.message, 422, { campos: err.slugs })
  if (err instanceof CrmError)
    return erroV1('entrada_invalida', err.message, 422)
  
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === '23503') return erroV1('entrada_invalida', 'referencia inexistente', 422)
  if (code === '23505') return erroV1('conflito', 'recurso ja existe', 409)
  if (code === '23502') return erroV1('entrada_invalida', 'campo obrigatorio ausente', 422)
  console.error('[api/v1] erro nao mapeado:', err)
  return erroV1('erro_interno', 'erro interno', 500)
}
