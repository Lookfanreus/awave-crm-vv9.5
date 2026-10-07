import 'server-only'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mensagemSegura } from '@/lib/sanitizar-erro'


const executarBinario = promisify(execFile)



const IDENTIDADE = [
  '-c',
  'user.name=Awave Updater',
  '-c',
  'user.email=updater@awave.local',
  
  
  
  '-c',
  'core.autocrlf=false',
]

async function rodar(args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await executarBinario('git', [...IDENTIDADE, ...args], {
      cwd,
      
      
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        
        
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
      },
    })
    return stdout
  } catch (erro) {
    
    const e = erro as { stderr?: string; message?: string }
    throw new Error(mensagemSegura(e.stderr?.trim() || e.message || 'git falhou'))
  }
}


export function urlComToken(repo: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${repo}.git`
}

export const git = {
  
  async clonarRaso(url: string, destino: string): Promise<void> {
    await rodar(['clone', '--depth', '1', url, destino])
  },

  
  async clonarCompleto(url: string, destino: string): Promise<void> {
    await rodar(['clone', url, destino])
  },

  
  async estaLimpo(dir: string): Promise<boolean> {
    return (await rodar(['status', '--porcelain'], dir)).trim() === ''
  },

  async adicionarTudo(dir: string): Promise<void> {
    await rodar(['add', '-A'], dir)
  },

  async commitar(dir: string, mensagem: string): Promise<void> {
    await rodar(['commit', '-m', mensagem], dir)
  },

  async shaDoHead(dir: string): Promise<string> {
    return (await rodar(['rev-parse', 'HEAD'], dir)).trim()
  },

  async empurrar(dir: string): Promise<void> {
    await rodar(['push'], dir)
  },

  
  async empurrarBackup(dir: string, branch: string): Promise<void> {
    await rodar(['push', 'origin', `HEAD:refs/heads/${branch}`], dir)
  },

  
  async branchRemotoExiste(dir: string, branch: string): Promise<boolean> {
    const saida = await rodar(['ls-remote', '--heads', 'origin', branch], dir).catch(
      () => '',
    )
    return saida.trim() !== ''
  },

  
  async reverter(dir: string, sha: string): Promise<void> {
    await rodar(['revert', '--no-edit', sha], dir)
  },
}
