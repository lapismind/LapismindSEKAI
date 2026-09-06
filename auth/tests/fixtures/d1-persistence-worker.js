import { persistV2MatchReport } from '../../src/matchPersistence.js'
import { sanitizeMatchReport } from '../../src/matchReports.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/persist' || request.method !== 'POST') return new Response('not found', { status: 404 })
    const sanitized = sanitizeMatchReport(await request.json())
    if (!sanitized.ok) return Response.json({ error: sanitized.error }, { status: 400 })
    try {
      return Response.json(await persistV2MatchReport(env.DB, sanitized.report))
    } catch (error) {
      if (error?.code === 'REPORT_CONFLICT') return Response.json({ error: error.message }, { status: 409 })
      return Response.json({ error: error.message }, { status: 500 })
    }
  },
}
