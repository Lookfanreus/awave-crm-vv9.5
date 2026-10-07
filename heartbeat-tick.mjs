


const PORT = process.env.PORT || 80
const INTERVALO = Math.max(5000, Number(process.env.HEARTBEAT_INTERVAL_MS) || 30000)
const SECRET = process.env.TICK_SECRET || ''













const JANELA_DO_PORTEIRO_S = 3600
const TETO_RECOMENDADO_MS = 1800000























let rodando = false

async function tick() {
  if (rodando) {
    console.warn('[heartbeat] tick anterior ainda rodando — pulando esta batida')
    return
  }
  rodando = true
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/interno/tick`, {
      method: 'POST', headers: { authorization: SECRET },
      signal: AbortSignal.timeout(60000),
    })
    if (!r.ok) console.warn('[heartbeat] tick não-ok:', r.status)
  } catch (err) {
    console.warn('[heartbeat] tick falhou:', err?.message ?? err)
  } finally {
    rodando = false
  }
}

console.log(`[heartbeat] ligado (intervalo ${INTERVALO}ms, porta ${PORT})`)
if (INTERVALO > TETO_RECOMENDADO_MS) {
  console.warn(`[heartbeat] HEARTBEAT_INTERVAL_MS=${INTERVALO} passa de 30 minutos (1800000). Se você usa os ganchos de evento da pasta custom/eventos, eventos podem se perder entre uma batida e outra; acima de 1 hora (3600000) eles se perdem com certeza. Veja docs/DEPLOY.md, item 2.4.`)
}
setInterval(tick, INTERVALO)
