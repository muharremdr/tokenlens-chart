import { useState } from 'react'

// TODO: replace with the real newsletter signup URL before launch.
const NEWSLETTER_URL = 'https://example.com/tokenlens-newsletter'
const REST_COLORS = ['#22D3EE', '#F472B6', '#FACC15', '#34D399', '#FB923C', '#A78BFA', '#60A5FA', '#F87171', '#A3E635', '#E879F9']
const MAX_ROWS = 10
const W = 1200
const H = 870

const EXAMPLE = [
  { label: 'Team', percent: '20', vesting: '36', cliff: '12' },
  { label: 'Investors', percent: '15', vesting: '24', cliff: '6' },
  { label: 'Community and Ecosystem', percent: '40', vesting: '48', cliff: '0' },
  { label: 'Treasury', percent: '15', vesting: '36', cliff: '0' },
  { label: 'Liquidity', percent: '10', vesting: '0', cliff: '0' },
]

let idCounter = 0
const withId = (r) => ({ id: ++idCounter, ...r })
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fmt = (n) => Math.round(n).toLocaleString('en-US')
const round2 = (n) => Math.round(n * 100) / 100
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'

function rowErrors(r) {
  const e = {}
  if (!r.label.trim()) e.label = 'Label required'
  const p = Number(r.percent)
  if (r.percent === '' || !Number.isFinite(p) || p < 0 || p > 100) e.percent = 'Percent must be 0 to 100'
  const v = Number(r.vesting)
  if (r.vesting === '' || !Number.isInteger(v) || v < 0) e.vesting = 'Whole number, 0 or more'
  const c = Number(r.cliff)
  if (r.cliff === '' || !Number.isInteger(c) || c < 0) e.cliff = 'Whole number, 0 or more'
  if (!e.vesting && !e.cliff && c > v) e.cliff = 'Cliff cannot exceed vesting'
  return e
}

// Unlocked tokens for one row at month m
function unlockedAt(x, m, supply) {
  const tok = (supply * x.p) / 100
  if (m < x.c) return 0
  if (x.v <= 0) return tok
  return tok * Math.min(1, m / x.v)
}

// Percent of total supply unlocked at month m (all rows)
function totalPctAt(model, m, supply) {
  return model.reduce((s, x) => s + (unlockedAt(x, m, supply) / supply) * 100, 0)
}

function donutFrag(model, colors, supply, ticker, cx, cy, R, r) {
  const total = model.reduce((s, x) => s + x.p, 0) || 1
  const pt = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]
  let a = -Math.PI / 2
  let out = ''
  model.forEach((x, i) => {
    if (x.p <= 0) return
    const span = (x.p / total) * 2 * Math.PI
    const tok = (supply * x.p) / 100
    const title = `<title>${esc(x.label)}: ${round2(x.p)}% (${fmt(tok)} ${esc(ticker)})</title>`
    if (span >= 2 * Math.PI - 1e-6) {
      out += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${colors[i]}" stroke-width="${R - r}">${title}</circle>`
    } else {
      const b = a + span
      const [x1, y1] = pt(a, R), [x2, y2] = pt(b, R), [x3, y3] = pt(b, r), [x4, y4] = pt(a, r)
      const large = span > Math.PI ? 1 : 0
      out += `<path d="M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 0 ${x4} ${y4} Z" fill="${colors[i]}">${title}</path>`
    }
    a += span
  })
  out += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="22" font-weight="700" fill="#F9FAFB">${esc(fmt(supply))}</text>`
  out += `<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="15" fill="#94A3B8">${esc(ticker)} total supply</text>`
  return out
}

function areaFrag(model, colors, supply, w, h) {
  const M = Math.max(12, ...model.map((x) => x.v))
  const pad = { l: 56, r: 20, t: 10, b: 30 }
  const iw = w - pad.l - pad.r
  const ih = h - pad.t - pad.b
  const X = (m) => pad.l + (m / M) * iw
  const Y = (p) => pad.t + ih - (p / 100) * ih
  const series = []
  for (let m = 0; m <= M; m++) {
    let acc = 0
    series.push(model.map((x) => {
      acc += (unlockedAt(x, m, supply) / supply) * 100
      return acc
    }))
  }
  let out = ''
  ;[0, 25, 50, 75, 100].forEach((g) => {
    out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(g)}" y2="${Y(g)}" stroke="#1F2937"/>`
    out += `<text x="${pad.l - 8}" y="${Y(g) + 4}" text-anchor="end" font-size="13" fill="#94A3B8">${g}%</text>`
  })
  model.forEach((x, i) => {
    if (x.p <= 0) return
    const top = series.map((row, m) => `${X(m)},${Y(row[i])}`)
    const bot = series.map((row, m) => `${X(m)},${Y(i > 0 ? row[i - 1] : 0)}`).reverse()
    out += `<polygon points="${top.concat(bot).join(' ')}" fill="${colors[i]}" fill-opacity="0.85"/>`
  })
  const totalLine = series.map((row, m) => `${X(m)},${Y(row[row.length - 1] || 0)}`).join(' ')
  out += `<polyline points="${totalLine}" fill="none" stroke="#FFFFFF" stroke-width="2"/>`
  const step = Math.max(1, Math.ceil(M / 6))
  for (let m = 0; m <= M; m += step) {
    out += `<text x="${X(m)}" y="${h - 8}" text-anchor="middle" font-size="13" fill="#94A3B8">M${m}</text>`
  }
  return out
}

function cardSvg({ name, ticker, supply, model, colors, brand }) {
  let legend = ''
  model.forEach((x, i) => {
    const y = 170 + i * 36
    const tok = (supply * x.p) / 100
    legend += `<rect x="460" y="${y - 14}" width="16" height="16" rx="3" fill="${colors[i]}"/>`
    legend += `<text x="486" y="${y}" font-size="18" fill="#E5E7EB">${esc(x.label)}</text>`
    legend += `<text x="1000" y="${y}" text-anchor="end" font-size="18" fill="#E5E7EB">${round2(x.p)}%</text>`
    legend += `<text x="1140" y="${y}" text-anchor="end" font-size="16" fill="#94A3B8">${esc(fmt(tok))} ${esc(ticker)}</text>`
  })
  const a = [0, 12, 24].map((m) => round2(totalPctAt(model, m, supply)))
  let full = 0
  for (let m = 0; m <= 600; m++) {
    if (totalPctAt(model, m, supply) >= 99.995) { full = m; break }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Arial, sans-serif">
<rect width="${W}" height="${H}" rx="24" fill="#0B0F1A"/>
<rect width="${W}" height="6" fill="${brand}"/>
<text x="60" y="84" font-size="44" font-weight="700" fill="#F9FAFB">${esc(name)}</text>
<text x="60" y="118" font-size="20" fill="${brand}">${esc(ticker)} tokenomics</text>
${donutFrag(model, colors, supply, ticker, 230, 300, 160, 105)}
${legend}
<text x="60" y="560" font-size="22" font-weight="600" fill="#F9FAFB">Unlock projection (cumulative % of supply)</text>
<g transform="translate(60,580)">${areaFrag(model, colors, supply, 1080, 200)}</g>
<text x="60" y="812" font-size="16" fill="#E5E7EB">TGE ${a[0]}%  ·  12 months ${a[1]}%  ·  24 months ${a[2]}%  ·  100% at month ${full}</text>
<text x="60" y="845" font-size="18" fill="#94A3B8">made with tokenlens</text>
</svg>`
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function App() {
  const [name, setName] = useState('Your Project')
  const [ticker, setTicker] = useState('TOKEN')
  const [supply, setSupply] = useState('1000000000')
  const [brand, setBrand] = useState('#7C5CFF')
  const [rows, setRows] = useState(EXAMPLE.map(withId))

  const setRow = (id, key, value) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)))
  const addRow = () => rows.length < MAX_ROWS && setRows((rs) => [...rs, withId({ label: '', percent: '', vesting: '0', cliff: '0' })])
  const removeRow = (id) => rows.length > 1 && setRows((rs) => rs.filter((r) => r.id !== id))

  const supplyNum = Number(supply)
  const supplyOk = supply !== '' && Number.isFinite(supplyNum) && supplyNum > 0
  const errs = rows.map(rowErrors)
  const labels = rows.map((r) => r.label.trim().toLowerCase())
  rows.forEach((r, i) => {
    if (r.label.trim() && labels.filter((l) => l === labels[i]).length > 1) errs[i].label = 'Label must be unique'
  })
  const rowErr = errs.some((e) => Object.keys(e).length > 0)
  const total = round2(rows.reduce((s, r) => s + (Number(r.percent) || 0), 0))
  const totalOk = total === 100
  const valid = totalOk && supplyOk && !rowErr

  let banner = ''
  if (!totalOk) {
    const diff = round2(100 - total)
    banner = diff > 0 ? `Total is ${total}%. Add ${diff}% to reach 100%.` : `Total is ${total}%. Remove ${-diff}% to reach 100%.`
  } else if (!supplyOk) banner = 'Total supply must be a number greater than 0.'
  else if (rowErr) banner = 'Fix the highlighted row errors to download.'

  const model = rows.map((r) => ({
    label: r.label.trim() || 'Untitled',
    p: Number(r.percent) || 0,
    v: Math.max(0, Number(r.vesting) || 0),
    c: Math.max(0, Number(r.cliff) || 0),
  }))
  const colors = model.map((_, i) => (i === 0 ? brand : REST_COLORS[(i - 1) % REST_COLORS.length]))
  const safeSupply = supplyOk ? supplyNum : 1
  const svg = cardSvg({ name: name || 'Your Project', ticker: ticker || 'TOKEN', supply: safeSupply, model, colors, brand })
  const slug = slugify(name)

  const exportSvg = () => download(new Blob([svg], { type: 'image/svg+xml' }), `${slug}-tokenomics.svg`)
  const exportPng = () => {
    const img = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1600
      canvas.height = Math.round((1600 * H) / W)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => download(blob, `${slug}-tokenomics.png`), 'image/png')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const inputCls = 'w-full rounded-lg bg-[#0B0F1A] border border-white/10 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-white/40'
  const btn = 'rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-200 hover:bg-white/5'

  return (
    <div className="min-h-screen bg-[#060912] text-gray-100 font-sans">
      <header className="px-4 sm:px-8 py-5 border-b border-white/10 flex items-center justify-between">
        <div className="text-xl font-bold tracking-tight">
          token<span style={{ color: brand }}>lens</span> chart
        </div>
        <div className="text-xs text-gray-400">Tokenomics visual generator</div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <h2 className="font-semibold">Project</h2>
            <label className="block text-sm text-gray-400">Project name / logo text
              <input className={inputCls + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-gray-400">Ticker
                <input className={inputCls + ' mt-1'} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
              </label>
              <label className="block text-sm text-gray-400">Brand color
                <input type="color" className="mt-1 h-10 w-full rounded-lg bg-transparent" value={brand} onChange={(e) => setBrand(e.target.value)} />
              </label>
            </div>
            <label className="block text-sm text-gray-400">Total token supply
              <input className={inputCls + ' mt-1'} inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^0-9.]/g, ''))} />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Distribution</h2>
              <div className="flex gap-2 text-xs">
                <button className={btn} onClick={() => setRows(EXAMPLE.map(withId))}>Reset to example</button>
                <button className={btn} onClick={() => setRows([withId({ label: '', percent: '', vesting: '0', cliff: '0' })])}>Clear</button>
              </div>
            </div>
            {rows.map((r, i) => (
              <div key={r.id} className="rounded-xl border border-white/10 p-3 space-y-2">
                <div className="grid grid-cols-[1fr_84px] gap-2">
                  <input className={inputCls} placeholder="Category label" value={r.label} onChange={(e) => setRow(r.id, 'label', e.target.value)} />
                  <div className="relative">
                    <input className={inputCls + ' pr-7'} inputMode="decimal" placeholder="%" value={r.percent} onChange={(e) => setRow(r.id, 'percent', e.target.value.replace(/[^0-9.]/g, ''))} />
                    <span className="absolute right-2 top-2 text-sm text-gray-500">%</span>
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <label className="text-xs text-gray-400">Vesting (mo)
                    <input className={inputCls + ' mt-1'} inputMode="numeric" value={r.vesting} onChange={(e) => setRow(r.id, 'vesting', e.target.value.replace(/[^0-9]/g, ''))} />
                  </label>
                  <label className="text-xs text-gray-400">Cliff (mo)
                    <input className={inputCls + ' mt-1'} inputMode="numeric" value={r.cliff} onChange={(e) => setRow(r.id, 'cliff', e.target.value.replace(/[^0-9]/g, ''))} />
                  </label>
                  <button className="text-xs text-gray-400 hover:text-red-400 mt-4 disabled:opacity-30" disabled={rows.length < 2} onClick={() => removeRow(r.id)} aria-label={`Remove row ${i + 1}`}>Remove</button>
                </div>
                <div className="text-xs text-gray-500">
                  {supplyOk && r.percent !== '' ? `${fmt((safeSupply * (Number(r.percent) || 0)) / 100)} ${ticker || 'TOKEN'}` : 'Enter supply and percent'}
                </div>
                {Object.values(errs[i]).map((msg) => (
                  <div key={msg} className="text-xs text-red-400">{msg}</div>
                ))}
              </div>
            ))}
            <button className={btn + ' w-full'} disabled={rows.length >= MAX_ROWS} onClick={addRow}>+ Add row</button>
            <div className={'flex justify-between rounded-lg px-3 py-2 text-sm font-semibold ' + (totalOk ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10')}>
              <span>Total</span><span>{total}% / 100%</span>
            </div>
            {banner && <div className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">{banner}</div>}
          </div>
        </section>

        <section className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-5 overflow-hidden">
            <div className="w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button disabled={!valid} onClick={exportPng} className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-30" style={{ background: brand }}>Download PNG</button>
            <button disabled={!valid} onClick={exportSvg} className="rounded-lg px-4 py-2 text-sm font-semibold border disabled:opacity-30" style={{ borderColor: brand, color: brand }}>Download SVG</button>
          </div>
          <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
            <summary className="cursor-pointer text-gray-200">How this is calculated</summary>
            <p className="mt-2">Each row unlocks 0 before its cliff. With 0 vesting it is fully unlocked at TGE (month 0). Otherwise it unlocks linearly from the cliff until the vesting month. Projection assumes linear vesting after cliff, no buybacks, no burns, no early unlocks.</p>
          </details>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 sm:px-8 py-6 text-sm text-gray-400 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <a href="/" className="font-semibold text-gray-200 hover:underline">made with tokenlens</a>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>Get the weekly web3 launch and brand teardown newsletter</span>
          <a href={NEWSLETTER_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-1.5 text-black font-semibold" style={{ background: brand }}>Subscribe</a>
        </div>
      </footer>
    </div>
  )
}
