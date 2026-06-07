// === MICRO-PARTE 1: VARIÁVEIS E INICIALIZAÇÃO ===
let currentMetrics = { ctl: '--', atl: '--', tsb: '--', ftp: '--', runPace: '--', swimCss: '--' };
let chatHistory = [];
let recentActivitiesSummary = "";
let pendingWorkoutsList = [];
let evolutionChartInstance = null;

window.onload = function() {
    if(localStorage.getItem('athleteId')) document.getElementById('athlete-id').value = localStorage.getItem('athleteId');
    if(localStorage.getItem('intervalsKey')) document.getElementById('intervals-key').value = localStorage.getItem('intervalsKey');
    if(localStorage.getItem('geminiKey')) document.getElementById('gemini-key').value = localStorage.getItem('geminiKey');
    if(localStorage.getItem('athleteBio')) document.getElementById('athlete-bio').value = localStorage.getItem('athleteBio');
    if(localStorage.getItem('athleteId') && localStorage.getItem('intervalsKey')) fetchIntervalsData();
};

// === MICRO-PARTE 2: CONFIGURAÇÕES E STATUS ===
function saveSettings() {
    localStorage.setItem('athleteId', document.getElementById('athlete-id').value.trim());
    localStorage.setItem('intervalsKey', document.getElementById('intervals-key').value.trim());
    localStorage.setItem('geminiKey', document.getElementById('gemini-key').value.trim());
    localStorage.setItem('athleteBio', document.getElementById('athlete-bio').value.trim());
    showStatus('Configurações salvas!', 'var(--success-color)');
}

function showStatus(text, color) {
    const el = document.getElementById('status-message');
    el.innerText = text; el.style.color = color || 'var(--text-muted)';
}

// === MICRO-PARTE 3: FORMATAÇÃO DO CHAT E TSB ===
function formatCoachMarkdown(text) {
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function appendMessage(sender, text) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.innerHTML = sender === 'coach' ? formatCoachMarkdown(text) : text;
    chatBox.appendChild(msgDiv); chatBox.scrollTop = chatBox.scrollHeight;
}

function updateTSBDisplay(tsb) {
    const tsbEl = document.getElementById('metric-tsb'); tsbEl.innerText = tsb;
    if (tsb < -20) tsbEl.style.color = 'var(--danger-color)';
    else if (tsb >= -20 && tsb <= 5) tsbEl.style.color = 'var(--success-color)';
    else tsbEl.style.color = 'var(--accent-color)';
}

// === MICRO-PARTE 4: CÁLCULO DE LIMIARES RESERVA ===
function calculateFallbackThresholds(ctl) {
    let baseFtp = 150 + (ctl * 1.5);
    let basePaceSegundos = 360 - (ctl * 1.2); 
    let cssSegundosCem = 130 - (ctl * 0.3);
    
    if(!currentMetrics.ftp || currentMetrics.ftp === '--') currentMetrics.ftp = Math.round(baseFtp) + "W";
    
    if(!currentMetrics.runPace || currentMetrics.runPace === '--') {
        let min = Math.floor(basePaceSegundos / 60); 
        let seg = Math.round(basePaceSegundos % 60).toString().padStart(2, '0');
        currentMetrics.runPace = `${min}:${seg}/km`;
    }
    
    if(!currentMetrics.swimCss || currentMetrics.swimCss === '--') {
        let minS = Math.floor(cssSegundosCem / 60); 
        let segS = Math.round(cssSegundosCem % 60).toString().padStart(2, '0');
        currentMetrics.swimCss = `${minS}:${segS}/100m`;
    }
}
// === MICRO-PARTE 5: RENDERIZAÇÃO DO GRÁFICO ===
function renderChart(wellnessData) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    const ultimosDias = wellnessData.slice(-15);
    
    const labels = ultimosDias.map(d => d.id.substring(5));
    const ctlData = ultimosDias.map(d => Math.round(d.ctl || d.ctlLoad || 0));
    const atlData = ultimosDias.map(d => Math.round(d.atl || d.atlLoad || 0));
    const tsbData = ctlData.map((c, i) => c - atlData[i]);

    if (evolutionChartInstance) evolutionChartInstance.destroy();

    evolutionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'CTL', data: ctlData, borderColor: '#34c759', borderWidth: 2, pointRadius: 1, fill: false },
                { label: 'ATL', data: atlData, borderColor: '#ff3b30', borderWidth: 1.5, pointRadius: 0, fill: false },
                { label: 'TSB', data: tsbData, borderColor: '#00c7ff', borderWidth: 2, pointRadius: 1, backgroundColor: 'rgba(0, 199, 255, 0.1)', fill: true }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#8e9aa8', font: { size: 9 } } },
                y: { grid: { color: '#253140' }, ticks: { color: '#8e9aa8', font: { size: 9 } } }
            },
            plugins: { legend: { labels: { color: '#f5f7fa', boxWidth: 10, font: { size: 10 } } } }
        }
    });
}







