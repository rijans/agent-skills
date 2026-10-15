import { initOpfsDB, insertLog, getLogs, clearLogs } from './db.js'

const statusEl = document.getElementById('status')
const actionInput = document.getElementById('action-input')
const detailsInput = document.getElementById('details-input')
const addBtn = document.getElementById('add-btn')
const clearBtn = document.getElementById('clear-btn')
const logsContainer = document.getElementById('logs-container')

function setStatus(msg, isError = false) {
  statusEl.textContent = msg
  statusEl.style.color = isError ? '#e53e3e' : '#718096'
}

async function refreshLogs() {
  try {
    const result = await getLogs()
    renderLogs(result)
  } catch (err) {
    console.error('Failed to query logs:', err)
    setStatus(`Query error: ${err.message}`, true)
  }
}

function renderLogs(arrowTable) {
  logsContainer.innerHTML = ''

  if (!arrowTable || arrowTable.numRows === 0) {
    logsContainer.innerHTML = '<p class="empty-msg">No logs in database. Add an entry or refresh the page!</p>'
    return
  }

  const table = document.createElement('table')
  const thead = document.createElement('thead')
  thead.innerHTML = `
    <tr>
      <th>ID</th>
      <th>Action</th>
      <th>Timestamp</th>
      <th>Details</th>
    </tr>
  `
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  const ids = arrowTable.getChild('id')
  const actions = arrowTable.getChild('action')
  const timestamps = arrowTable.getChild('timestamp')
  const details = arrowTable.getChild('details')

  for (let i = 0; i < arrowTable.numRows; i++) {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${ids?.get(i)}</td>
      <td><strong>${actions?.get(i)}</strong></td>
      <td>${timestamps?.get(i)}</td>
      <td>${details?.get(i)}</td>
    `
    tbody.appendChild(tr)
  }

  table.appendChild(tbody)
  logsContainer.appendChild(table)
}

addBtn.addEventListener('click', async () => {
  const action = actionInput.value.trim()
  const details = detailsInput.value.trim()

  if (!action) {
    setStatus('Please specify an action name.', true)
    return
  }

  try {
    addBtn.disabled = true
    setStatus('Inserting and checkpointing to OPFS...')
    await insertLog(action, details || 'N/A')

    actionInput.value = ''
    detailsInput.value = ''
    setStatus('Log saved to OPFS disk storage!')
    await refreshLogs()
  } catch (err) {
    console.error('Failed to insert log:', err)
    setStatus(`Error: ${err.message}`, true)
  } finally {
    addBtn.disabled = false
  }
})

clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear all logs from OPFS?')) return

  try {
    clearBtn.disabled = true
    setStatus('Clearing logs...')
    await clearLogs()
    setStatus('Logs cleared.')
    await refreshLogs()
  } catch (err) {
    console.error('Failed to clear logs:', err)
    setStatus(`Error: ${err.message}`, true)
  } finally {
    clearBtn.disabled = false
  }
})

// Initialize DB and load existing logs on startup
initOpfsDB()
  .then(() => {
    setStatus('Connected to OPFS database (opfs://analytics.duckdb)')
    return refreshLogs()
  })
  .catch((err) => {
    console.error('Failed to initialize OPFS DuckDB:', err)
    setStatus(`Initialization failed: ${err.message}`, true)
  })
