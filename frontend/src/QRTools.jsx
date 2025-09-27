import React, { useRef, useState } from 'react'
import { api } from './api'
import QRCode from 'qrcode'
import { BrowserMultiFormatReader } from '@zxing/browser'

function parseScannedText(text) {
  try {
    if (text.includes('uid=')) {
      const params = new URLSearchParams(text)
      return { uid: params.get('uid') || '', sig: params.get('sig') || '' }
    }
    if (text.trim().startsWith('{')) {
      const obj = JSON.parse(text)
      return { uid: obj.uid || '', sig: obj.sig || '' }
    }
  } catch {}
  return { uid: text.trim(), sig: '' }
}

export default function QRTools() {
  // Generator
  const [gen, setGen] = useState({ type: 'ERC', vendorCode: 'ABC', lotCode: 'L1234', yymm: '2509', ser: '000001' })
  const [genResult, setGenResult] = useState({ uid: '', sig: '', dataUrl: '' })
  const [genError, setGenError] = useState('')

  // Scanner (camera + image upload)
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [scanning, setScanning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [scan, setScan] = useState({ raw: '', uid: '', sig: '', valid: null, item: null, error: '' })

  const API_BASE = import.meta.env.VITE_API_BASE

  async function handleGenerate(e) {
    e.preventDefault()
    setGenError('')
    try {
      const { uid, sig } = await api.uidMake(gen)
      const payload = `uid=${uid}&sig=${sig}`
      const dataUrl = await QRCode.toDataURL(payload, { width: 280, errorCorrectionLevel: 'M' })
      setGenResult({ uid, sig, dataUrl })
    } catch (err) {
      setGenError(err.message)
    }
  }

  // Camera scan
  async function startScan() {
    setScan({ raw: '', uid: '', sig: '', valid: null, item: null, error: '' })
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader
    try {
      await reader.decodeFromVideoDevice(null, videoRef.current, (result) => {
        if (result) {
          const text = result.getText()
          const { uid, sig } = parseScannedText(text)
          setScan(s => ({ ...s, raw: text }))
          verifyAndFetch(uid, sig)
        }
      })
      setScanning(true)
    } catch (err) {
      setScan(s => ({ ...s, error: String(err) }))
    }
  }
  function stopScan() {
    try { readerRef.current?.reset() } catch {}
    setScanning(false)
  }

  // Image (gallery/files) scan
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    await decodeImageFile(file)
    // allow selecting the same file again if needed
    e.target.value = ''
  }

  async function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) await decodeImageFile(file)
  }

  async function decodeImageFile(file) {
    setUploading(true)
    setScan({ raw: '', uid: '', sig: '', valid: null, item: null, error: '' })
    const objectUrl = URL.createObjectURL(file)
    const reader = new BrowserMultiFormatReader()
    try {
      const result = await reader.decodeFromImageUrl(objectUrl)
      const text = result.getText()
      const { uid, sig } = parseScannedText(text)
      setScan(s => ({ ...s, raw: text }))
      await verifyAndFetch(uid, sig)
    } catch (err) {
      setScan(s => ({ ...s, error: `Could not decode image: ${err}` }))
    } finally {
      try { reader.reset() } catch {}
      URL.revokeObjectURL(objectUrl)
      setUploading(false)
    }
  }

  async function verifyAndFetch(uid, sig) {
    try {
      const v = sig ? await api.uidVerify(uid, sig) : { valid: null }
      let item = null
      try { item = await api.itemByUid(uid) } catch {}
      setScan(s => ({ ...s, uid, sig, valid: v.valid ?? null, item, error: '' }))
    } catch (err) {
      setScan(s => ({ ...s, error: String(err) }))
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: 8, marginTop: '2rem' }}>
      <h2>QR Tools</h2>
      <p style={{ opacity: 0.7 }}>API Base: {API_BASE}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Generator */}
        <div>
          <h3>Generate QR</h3>
          <form onSubmit={handleGenerate}>
            <div>
              <label>Type</label><br/>
              <select value={gen.type} onChange={e => setGen({ ...gen, type: e.target.value })}>
                <option>ERC</option><option>PAD</option><option>LINER</option><option>SLEEPER</option>
              </select>
            </div>
            <div><label>Vendor Code</label><br/><input value={gen.vendorCode} onChange={e => setGen({ ...gen, vendorCode: e.target.value })} /></div>
            <div><label>Lot Code</label><br/><input value={gen.lotCode} onChange={e => setGen({ ...gen, lotCode: e.target.value })} /></div>
            <div><label>YYMM</label><br/><input value={gen.yymm} onChange={e => setGen({ ...gen, yymm: e.target.value })} /></div>
            <div><label>Serial</label><br/><input value={gen.ser} onChange={e => setGen({ ...gen, ser: e.target.value })} /></div>
            <button type="submit" style={{ marginTop: 8 }}>Generate</button>
            {genError && <p style={{ color: 'red' }}>{genError}</p>}
          </form>

          {genResult.uid && (
            <div style={{ marginTop: '1rem' }}>
              <p><strong>UID</strong>: {genResult.uid}</p>
              <p><strong>Signature</strong>: {genResult.sig}</p>
              <img src={genResult.dataUrl} alt="QR" style={{ border: '1px solid #ccc', padding: 4, maxWidth: '100%' }} />
              <div style={{ marginTop: 8 }}>
                <a href={genResult.dataUrl} download={`QR-${genResult.uid}.png`}>Download QR</a>
              </div>
            </div>
          )}
        </div>

        {/* Scanner */}
        <div>
          <h3>Scan & Verify</h3>

          {/* Camera controls */}
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!scanning
              ? <button onClick={startScan}>Start camera</button>
              : <button onClick={stopScan}>Stop camera</button>
            }
          </div>
          <video ref={videoRef} style={{ width: '100%', maxWidth: 420, background: '#000' }} muted playsInline></video>

          {/* Upload from gallery/files */}
          <div style={{ marginTop: 12 }}>
            <label><strong>Upload QR image (Gallery/Files)</strong></label><br/>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                marginTop: 8,
                border: '1px dashed #999',
                borderRadius: 8,
                padding: '0.75rem',
                color: '#666'
              }}
              title="Drop a QR image here"
            >
              Drag & drop a QR image here
            </div>
            {uploading && <p>Decoding image…</p>}
          </div>

          {/* Results */}
          {scan.raw && (
            <div style={{ marginTop: '0.75rem' }}>
              <p><strong>Raw</strong>: {scan.raw}</p>
              <p><strong>UID</strong>: {scan.uid}</p>
              <p><strong>Signature</strong>: {scan.sig || '(none in QR)'}</p>
              {scan.valid !== null && <p><strong>Signature valid</strong>: {String(scan.valid)}</p>}
              {scan.item && (
                <div>
                  <p><strong>Item</strong>:</p>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(scan.item, null, 2)}</pre>
                </div>
              )}
              {scan.error && <p style={{ color: 'red' }}>{scan.error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}