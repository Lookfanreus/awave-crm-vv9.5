
type Rec = Record<string, unknown>
function pegar(src: Rec, chaves: string[]): Rec {
  const out: Rec = {}
  for (const k of chaves) if (src[k] !== undefined) out[k] = src[k]
  return out
}

export function camposNegocio(src: Rec): Rec { return pegar(src, ['titulo', 'valor', 'contato_id', 'empresa_id', 'previsao_fechamento', 'responsavel_id']) }
export function camposContato(src: Rec): Rec { return pegar(src, ['nome', 'email', 'telefone', 'origem', 'notas', 'empresa_id']) }
export function camposEmpresa(src: Rec): Rec { return pegar(src, ['nome', 'site', 'telefone', 'notas']) }
