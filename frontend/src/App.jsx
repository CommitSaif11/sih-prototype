import React, { useEffect, useState } from 'react'
import { api } from './api'

export default function App() {
  const [health, setHealth] = useState(null)
  const [vendors, setVendors] = useState([])
  const [lots, setLots] = useState([])
  const [items, setItems] = useState([])
  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedLot, setSelectedLot] = useState('')
  const [inspections, setInspections] = useState([])
  const [form, setForm] = useState({ itemUid: '', date: '', inspector: '', result: 'pass', notes: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    api.health().then(setHealth).catch(console.error)
    api.vendors().then(setVendors).catch(console.error)
    api.lots().then(setLots).catch(console.error)
    api.items().then(setItems).catch(console.error)
  }, [])

  useEffect(() => {
    if (form.itemUid) {
      api.inspections({ itemUid: form.itemUid }).then(setInspections).catch(console.error)
    } else {
      setInspections([])
    }
  }, [form.itemUid])

  const filteredLots = selectedVendor ? lots.filter(l => l.vendorCode === selectedVendor) : lots
  const filteredItems = selectedLot ? items.filter(i => i.lotId === selectedLot) : items

  const handleCreateInspection = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      await api.createInspection(payload)
      const list = await api.inspections({ itemUid: form.itemUid })
      setInspections(list)
      alert('Inspection created')
    } catch (err) {
      setError(err.message)
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
            <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}>
              <option value="">All</option>
              {vendors.map(v => <option key={v.id} value={v.code}>{v.code} — {v.name}</option>)}
            </select>
          </div>
          <div>
            <label>Lot</label><br/>
            <select value={selectedLot} onChange={e => setSelectedLot(e.target.value)}>
              <option value="">All</option>
              {filteredLots.map(l => <option key={l.id} value={l.id}>{l.type}-{l.lotCode} ({l.vendorCode})</option>)}
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
    </div>
  )
}
