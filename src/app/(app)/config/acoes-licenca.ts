'use server'

import { setSecret } from '@/server/secrets'
import { revalidarLicenca } from '@/server/license/validar'
import { estadoDaLicenca, type VistaDaLicenca } from '@/server/license/estado'
import { ehDonoDoDeploy } from '@/server/auth/dono-deploy'
import { invalidarMemoBloqueio } from '@/server/license/bloqueio'



export async function lerLicenca(): Promise<VistaDaLicenca | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  return estadoDaLicenca()
}


export async function salvarChaveDeLicenca(
  chave: string,
): Promise<{ ok: true; estado: VistaDaLicenca } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  const c = chave.trim()
  if (!c) return { erro: 'chave_vazia' }
  
  
  if (c.length > 200) return { erro: 'chave_invalida' }

  try {
    await setSecret('license_key', c)
    
    
    await revalidarLicenca()
    return { ok: true, estado: await estadoDaLicenca() }
  } catch {
    return { erro: 'falha_ao_salvar' }
  } finally {
    invalidarMemoBloqueio() 
  }
}

export async function revalidarAgora(): Promise<{ ok: true; estado: VistaDaLicenca } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  try {
    await revalidarLicenca() 
    return { ok: true, estado: await estadoDaLicenca() }
  } finally {
    
    
    
    invalidarMemoBloqueio()
  }
}


export async function removerChaveDeLicenca(): Promise<{ ok: true; estado: VistaDaLicenca } | { erro: string }> {
  if (!(await ehDonoDoDeploy())) return { erro: 'nao_autorizado' }
  try {
    await setSecret('license_key', '')
    return { ok: true, estado: await estadoDaLicenca() }
  } catch {
    return { erro: 'falha_ao_salvar' }
  } finally {
    
    
    
    
    
    
    invalidarMemoBloqueio()
  }
}
