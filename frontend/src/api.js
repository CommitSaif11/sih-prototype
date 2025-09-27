const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json()
}

export const api = {
  health: () => get('/health'),
  vendors: () => get('/api/vendors'),
  lots: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/lots${q ? `?${q}` : ''}`)
  },
  items: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/items${q ? `?${q}` : ''}`)
  },
  inspections: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/inspections${q ? `?${q}` : ''}`)
  },
  createInspection: (payload) => post('/api/inspections', payload),
}
