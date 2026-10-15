import { initDuckDB, registerParquetFile, executeQuery } from './db.js'

const statusEl = document.getElementById('status')
const fileInput = document.getElementById('file-input')
const dropZone = document.getElementById('drop-zone')
const queryInput = document.getElementById('query-input')
const runBtn = document.getElementById('run-btn')
const resultsContainer = document.getElementById('results-container')

let activeTable = null

function setStatus(msg, isError = false) {
  statusEl.textContent = msg
  statusEl.style.color = isError ? '#e53e3e' : '#718096'
}

async function handleFile(file) {
  if (!file) return

  try {
    setStatus(`Loading "${file.name}"...`)
    activeTable = await registerParquetFile(file)

    queryInput.value = `SELECT * FROM '${activeTable}' LIMIT 10;`
    setStatus(`File "${file.name}" ready! Virtual table: '${activeTable}'`)
    runQuery()
  } catch (err) {
    console.error('File registration failed:', err)
    setStatus(`Error registering file: ${err.message}`, true)
  }
}

async function runQuery() {
  const sql = queryInput.value.trim()
  if (!sql) return

  try {
    setStatus('Executing query...')
    runBtn.disabled = true

    const { result, durationMs } = await executeQuery(sql)
    setStatus(`Executed in ${durationMs}ms — ${result.numRows} rows, ${result.numCols} columns`)

    renderArrowTable(result)
  } catch (err) {
    console.error('Query execution failed:', err)
    setStatus(`Query error: ${err.message}`, true)
  } finally {
    runBtn.disabled = false
  }
}

function renderArrowTable(arrowTable) {
  resultsContainer.innerHTML = ''

  if (!arrowTable || arrowTable.numRows === 0) {
    resultsContainer.innerHTML = '<p class="empty-msg">Query returned 0 rows.</p>'
    return
  }

  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')

  const fields = arrowTable.schema.fields
  for (const field of fields) {
    const th = document.createElement('th')
    th.textContent = field.name
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  const maxDisplayRows = Math.min(arrowTable.numRows, 100)

  // Efficient column vector indexing
  const vectors = fields.map((f) => arrowTable.getChild(f.name))

  for (let rowIndex = 0; rowIndex < maxDisplayRows; rowIndex++) {
    const tr = document.createElement('tr')
    for (let colIndex = 0; colIndex < fields.length; colIndex++) {
      const td = document.createElement('td')
      const val = vectors[colIndex]?.get(rowIndex)
      td.textContent = val !== null && val !== undefined ? String(val) : 'NULL'
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }

  table.appendChild(tbody)
  resultsContainer.appendChild(table)

  if (arrowTable.numRows > maxDisplayRows) {
    const notice = document.createElement('p')
    notice.className = 'pagination-notice'
    notice.textContent = `Showing first ${maxDisplayRows} of ${arrowTable.numRows} rows.`
    resultsContainer.appendChild(notice)
  }
}

// Event Listeners
fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0]
  if (file) handleFile(file)
})

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault()
  dropZone.classList.add('drag-active')
})

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-active')
})

dropZone.addEventListener('drop', (e) => {
  e.preventDefault()
  dropZone.classList.remove('drag-active')
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
})

runBtn.addEventListener('click', runQuery)

// Initialize DuckDB on page load
initDuckDB().catch((err) => {
  console.error('Failed to initialize DuckDB:', err)
  setStatus(`Initialization error: ${err.message}`, true)
})
