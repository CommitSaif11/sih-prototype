import React, { useEffect, useState } from 'react'
import { api } from './api'
import QRTools from './QRTools.jsx'

export default function App() {
  const [health, setHealth] = useState(null)
  const [vendors, setVendors] = useState([])
  const [lots, setLots] = useState([])
  const [items, setItems] = useState([])
  const [inspections, setInspections] = useState([])

  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedLot, setSelectedLot] = useState('')
  const [filteredItems, setFilteredItems] = useState([])

  const [form, setForm] = useState({ itemUid: '', date: '', inspector: 'Saif', result: 'pass', notes: '' })
  const [error, setError] = useState('')

  // Analytics
  const [metrics, setMetrics] = useState(null)
  const [insight, setInsight] = useState(null)
  const [loadingRpt, setLoadingRpt] = useState(false)

  useEffect(() => {
    api.health().then(setHealth).catch(console.error)
    api.vendors().then(setVendors).catch(console.error)
    api.lots().then(setLots).catch(console.error)
    api.items().then(setItems).catch(console.error)
    api.inspections().then(setInspections).catch(console.error)
  }, [])

  useEffect(() => {
    let arr = items
    if (selectedVendor) {
      const lotIds = lots.filter(l => l.vendorCode === selectedVendor).map(l => l.id)
      arr = arr.filter(i => lotIds.includes(i.lotId))
    }
    if (selectedLot) arr = arr.filter(i => i.lotId === selectedLot)
    setFilteredItems(arr)
  }, [items, lots, selectedVendor, selectedLot])

  useEffect(() => {
    if (form.itemUid) {
      api.inspections({ itemUid: form.itemUid }).then(setInspections).catch(console.error)
    }
  }, [form.itemUid])

  const handleCreateInspection = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.createInspection({ ...form })
      const list = await api.inspections({ itemUid: form.itemUid })
      setInspections(list)
      alert('Inspection created')
    } catch (err) {
      setError(err.message)
    }
  }

  const counts = {
    vendors: vendors.length,
    lots: lots.length,
    items: items.length,
    inspections: inspections.length,
  }

  async function generateAnalytics() {
    try {
      setLoadingRpt(true)
      const m = await api.reportsMetrics()
      const i = await api.reportsInsights()
      setMetrics(m)
      setInsight(i)
    } catch (e) {
      console.error(e)
      alert('Failed to generate analytics')
    } finally {
      setLoadingRpt(false)
    }
  }

  const copyNarrative = async () => {
    if (insight?.narrative) {
      await navigator.clipboard.writeText(insight.narrative)
      alert('Summary copied')
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem', maxWidth: 960 }}>
      <h1>SIH Prototype (FastAPI + React)</h1>

      <section>
        <h2>Health</h2>
        <pre>{health ? JSON.stringify(health, null, 2) : 'Loading...'}</pre>
        <small>API Base: {import.meta.env.VITE_API_BASE || 'http://localhost:8000'}</small>
      </section>

      <section>
        <h2>Browse Vendors, Lots, Items</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label>Vendor</label><br/>
            <select value={selectedVendor} onChange={e => { setSelectedVendor(e.target.value); setSelectedLot('') }}>
              <option value="">All</option>
              {vendors.map(v => <option key={v.id} value={v.code}>{v.code} — {v.name}</option>)}
            </select>
          </div>
          <div>
            <label>Lot</label><br/>
            <select value={selectedLot} onChange={e => setSelectedLot(e.target.value)}>
              <option value="">All</option>
              {(selectedVendor ? lots.filter(l => l.vendorCode === selectedVendor) : lots)
                .map(l => <option key={l.id} value={l.id}>{l.type}-{l.lotCode} ({l.vendorCode})</option>)}
            </select>
          </div>
        </div>

        <h3 style={{ marginTop: '1rem' }}>Items</h3>
        <ul>
          {filteredItems.map(i => (
            <li key={i.id}>
              <code>{i.uid}</code> — lot: {i.lotId} — status: {i.status}
              <button style={{ marginLeft: 8 }} onClick={() => setForm(f => ({ ...f, itemUid: i.uid }))}>
                Select for Inspection
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Create Inspection</h2>
        <form onSubmit={handleCreateInspection} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: 8 }}>
          <div>
            <label>Item UID</label><br/>
            <input value={form.itemUid} onChange={e => setForm({ ...form, itemUid: e.target.value })} placeholder="IRFT-..." />
          </div>
          <div>
            <label>Date</label><br/>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label>Inspector</label><br/>
            <input value={form.inspector} onChange={e => setForm({ ...form, inspector: e.target.value })} placeholder="Depot QA" />
          </div>
          <div>
            <label>Result</label><br/>
            <select value={form.result} onChange={e => setForm({ ...form, result: e.target.value })}>
              <option value="pass">pass</option>
              <option value="fail">fail</option>
              <option value="rework">rework</option>
            </select>
          </div>
          <div>
            <label>Notes</label><br/>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </div>
          <button type="submit" style={{ marginTop: 8 }}>Add Inspection</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>

        <h3 style={{ marginTop: '1rem' }}>Inspections for selected item</h3>
        <ul>
          {inspections.map(i => (
            <li key={i.id}>
              {i.date} — {i.inspector} — {i.result} — {i.notes || '-'}
            </li>
          ))}
        </ul>
      </section>

      {/* AI Analytics (Prototype) */}
      <section style={{ marginTop: '2rem', border: '1px solid #ddd', padding: '1rem', borderRadius: 8 }}>
        <h2>AI Analytics (Prototype)</h2>
        <button onClick={generateAnalytics} disabled={loadingRpt}>
          {loadingRpt ? 'Generating…' : 'Generate'}
        </button>
        {metrics && (
          <div style={{ marginTop: 12 }}>
            <strong>KPIs</strong>
            <ul>
              <li>Totals — vendors: {metrics.totals.vendors}, lots: {metrics.totals.lots}, items: {metrics.totals.items}, inspections: {metrics.totals.inspections}</li>
              <li>Pass rate: {metrics.pass_rate !== null ? `${(metrics.pass_rate*100).toFixed(1)}%` : 'n/a'}</li>
              <li>Fail rate: {metrics.fail_rate !== null ? `${(metrics.fail_rate*100).toFixed(1)}%` : 'n/a'}</li>
              <li>Items by status: {Object.entries(metrics.items_by_status).map(([k,v])=>`${k}:${v}`).join(', ')}</li>
              <li>Lots by type: {Object.entries(metrics.lots_by_type).map(([k,v])=>`${k}:${v}`).join(', ')}</li>
              {metrics.vendors_leaderboard?.[0] && (
                <li>Top risk vendor: {metrics.vendors_leaderboard[0].vendorCode} (fail {Math.round(metrics.vendors_leaderboard[0].fail_rate*100)}%)</li>
              )}
            </ul>
          </div>
        )}
        {insight && (
          <div style={{ marginTop: 10 }}>
            <strong>Summary</strong>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{insight.narrative}</pre>
            <button onClick={copyNarrative}>Copy summary</button>
          </div>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <QRTools />
      </section>
    </div>
  )
}