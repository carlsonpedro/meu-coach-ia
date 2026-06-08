console.log("🚀 [DEBUG] app.js começou a carregar...");

// === 1. VARIÁVEIS GLOBAIS ===
let currentMetrics = { ctl: '--', atl: '--', tsb: '--', ftp: '--', runPace: '--', swimCss: '--' };
let chatHistory = [];
let recentActivitiesSummary = "";
let pendingWorkoutsList = [];
let evolutionChartInstance = null;

// === 2. FUNÇÕES DE BUSCA (DECLARADAS NO TOPO PARA EVITAR ERROS) ===
async function fetchWellnessData(athleteId, authHeader) {
    console.log("🔄 [DEBUG] Executando fetchWellnessData...");
    const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/wellness`, { method: 'GET', headers: authHeader });
    if (!res.ok) throw new Error('Erro ao buscar carga (Wellness).');
    const wellnessData = await res.json();
    
    if (wellnessData && wellnessData.length > 0) {
        let ultimoDia = wellnessData.slice().reverse().find(dia => (dia.ctl || dia.ctlLoad) > 0);
        if (ultimoDia) {
            currentMetrics.ctl = Math.round(ultimoDia.ctl || ultimoDia.ctlLoad);
            currentMetrics.atl = Math.round(ultimoDia.atl || ultimoDia.atlLoad || 0);
            currentMetrics.tsb = currentMetrics.ctl - currentMetrics.atl;
        }
        renderChart(wellnessData);
    }
}

async function fetchAthleteProfile(athleteId, authHeader) {
    console.log("🔄 [DEBUG] Executando fetchAthleteProfile...");
    try {
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}`, { method: 'GET', headers: authHeader });
        if (res.ok) {
            const data = await res.json();
            if (data.icu_ftp) currentMetrics.ftp = data.icu_ftp + "W";
        }
    } catch (e) {
        console.error("Erro no perfil:", e);
    }

    calculateFallbackThresholds(currentMetrics.ctl === '--' ? 20 : currentMetrics.ctl);

    if(document.getElementById('metric-ctl')) document.getElementById('metric-ctl').innerText = currentMetrics.ctl;
    if(document.getElementById('metric-atl')) document.getElementById('metric-atl').innerText = currentMetrics.atl;
    updateTSBDisplay(currentMetrics.tsb);
    if(document.getElementById('metric-ftp')) document.getElementById('metric-ftp').innerText = currentMetrics.ftp;
    if(document.getElementById('metric-rpace')) document.getElementById('metric-rpace').innerText = currentMetrics.runPace;
    if(document.getElementById('metric-swimcss')) document.getElementById('metric-swimcss').innerText = currentMetrics.swimCss;
}

async function fetchRecentEvents(athleteId, authHeader) {
    console.log("🔄 [DEBUG] Executando fetchRecentEvents...");
    let hojeStr = new Date().toISOString().split('T')[0];
    let umaSemanaAtras = new Date(); umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 8);
    let inicioStr = umaSemanaAtras.toISOString().split('T')[0];

    const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${inicioStr}&newest=${hojeStr}`, { method: 'GET', headers: authHeader });
    if(res.ok) {
        const events = await res.json();
        let realizados = events.filter(e => e.type && e.moving_time > 0).slice(-3);
        recentActivitiesSummary = realizados.map(e => 
            `- ${e.type}: ${e.name}, Minutos: ${Math.round(e.moving_time/60)}, Watts Med: ${e.icu_average_watts || 'N/A'}, FC Med: ${e.average_heart_rate || 'N/A'}`
        ).join('\n');
    }
}

async function fetchIntervalsData() {
    console.log("🔄 [DEBUG] Iniciando fetchIntervalsData...");
    const athleteId = localStorage.getItem('athleteId');
    const intervalsKey = localStorage.getItem('intervalsKey');
    if (!athleteId || !intervalsKey) return;

    showStatus('Sincronizando dados...', 'var(--accent-color)');
    const authHeader = { 'Authorization': `Basic ${btoa(`API_KEY:${intervalsKey}`)}` };
    
    try {
        await fetchWellnessData(athleteId, authHeader);
        await fetchAthleteProfile(athleteId, authHeader);
        await fetchRecentEvents(athleteId, authHeader);
        showStatus('Dados updated!', 'var(--success-color)');
    } catch (error) { 
        showStatus(`Erro: ${error.message}`, '#ff3b30'); 
    }
}

// === 3. INICIALIZAÇÃO WINDOW ===
window.onload = function() {
    console.log("🏁 [DEBUG] Window carregada. Resgatando dados locais...");
    if(localStorage.getItem('athleteId')) document.getElementById('athlete-id').value = localStorage.getItem('athleteId');
    if(localStorage.getItem('intervalsKey')) document.getElementById('intervals-key').value = localStorage.getItem('intervalsKey');
    if(localStorage.getItem('geminiKey')) document.getElementById('gemini-key').value = localStorage.getItem('geminiKey');
    if(localStorage.getItem('athleteBio')) document.getElementById('athlete-bio').value = localStorage.getItem('athleteBio');
    if(localStorage.getItem('athleteId') && localStorage.getItem('intervalsKey')) fetchIntervalsData();
};

// === 4. CONFIGURAÇÕES E STATUS ===
function saveSettings() {
    localStorage.setItem('athleteId', document.getElementById('athlete-id').value.trim());
    localStorage.setItem('intervalsKey', document.getElementById('intervals-key').value.trim());
    localStorage.setItem('geminiKey', document.getElementById('gemini-key').value.trim());
    localStorage.setItem('athleteBio', document.getElementById('athlete-bio').value.trim());
    showStatus('Configurações salvas!', 'var(--success-color)');
    fetchIntervalsData();
}

function showStatus(text, color) {
    const el = document.getElementById('status-message');
    if (el) {
        el.innerText = text; 
        el.style.color = color || 'var(--text-muted)';
    }
}

// === 5. CHAT E FORMATAÇÃO ===
function formatCoachMarkdown(text) {
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function appendMessage(sender, text) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.innerHTML = sender === 'coach' ? formatCoachMarkdown(text) : text;
    chatBox.appendChild(msgDiv); 
    chatBox.scrollTop = chatBox.scrollHeight;
}

function updateTSBDisplay(tsb) {
    const tsbEl = document.getElementById('metric-tsb'); 
    if (!tsbEl) return;
    tsbEl.innerText = tsb;
    if (tsb < -20) tsbEl.style.color = 'var(--danger-color)';
    else if (tsb >= -20 && tsb <= 5) tsbEl.style.color = 'var(--success-color)';
    else tsbEl.style.color = 'var(--accent-color)';
}

// === 6. CÁLCULO DE SUPORTE ===
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

// === 7. GRÁFICO (CHART.JS) ===
function renderChart(wellnessData) {
    const el = document.getElementById('evolutionChart');
    if (!el) return;
    const ctx = el.getContext('2d');
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

// === 8. ENVIO PARA GEMINI ===
async function sendMessage() {
    const inputEl = document.getElementById('user-input');
    const btnEl = document.querySelector('.chat-input-container button');
    if (!inputEl || !btnEl) return;
    
    const userText = inputEl.value.trim();
    const geminiKey = localStorage.getItem('geminiKey');
    const athleteBio = localStorage.getItem('athleteBio') || "";

    if (!userText || !geminiKey) return;

    inputEl.disabled = true; btnEl.disabled = true;
    appendMessage('user', userText); inputEl.value = '';

    chatHistory.push({ role: "user", parts: [{ text: userText }] });
    let apiContents = JSON.parse(JSON.stringify(chatHistory.slice(-3)));
    const dataHoje = new Date().toISOString().split('T')[0];

    const systemInstruction = `És um treinador focado em resultados rápidos para atletas AMADORES com pouquíssimo tempo de treino (estilo Humango focado em densidade).
    Objetivo do Atleta: Sprint Triathlon (750m natação, 20km ciclismo, 5km corrida). O atleta usa Garmin e MyWhoosh.
    
    REGRA CRUCIAL DE NATAÇÃO:
    - NÃO sugira treinos de natação (Swim) por padrão na planilha. O atleta só fará natação quando deixar isso EXPLICITO no comentário/prompt atual do chat. Se ele não pedir, foque apenas em Ciclismo, Corrida e Força.

    DIRETRIZES DE INTENSIDADE PARA O GARMIN (INEGOCIÁVEL):
    - Treinos de Base / Endurance / Leves (Z2): Use estritamente a Frequência Cardíaca (FC) como métrica de controle de intensidade na descrição do treino.
    - Treinos Fortes / Intervalados / Ritmo Alto (Z4 ou superior): Use Potência (Watts) para treinos de ciclismo (foco em flutuações Over-Unders perto/acima do FTP no MyWhoosh) e Pace (min/km) para treinos de corrida.

    REGRAS INEGOCIÁVEIS DE FORÇA NA SEMANA:
    - Segunda-feira (2ª feira): Treino de Força com Kettlebells obrigatório. Dividido rigidamente em 2 blocos de 20 minutos. Bloco 1: Upper Body Complex. Bloco 2: Lower Body Complex.
    - Quarta-feira (4ª feira): Treino de Força com Halteres obrigatório. Dividido rigidamente em 2 blocos de 20 minutos. Bloco 1: Upper Body. Bloco 2: Lower Body.
    
    REGRAS RÍGIDAS DE DURAÇÃO E TEMPO:
    - Durante os dias de semana (Segunda a Sexta): Os treinos de ciclismo (Ride) não podem passar de 50 minutos e os treinos de corrida (Run) não podem passar de 45 minutos.
    - Nos finais de semana (Sábado ou Domingo): Permitir sessões mais longas de endurance ou transições (ex: Brick), respeitando o limite máximo de até 1h30 (90 minutos).

    Métricas atuais: CTL: ${currentMetrics.ctl}, TSB: ${currentMetrics.tsb}. Limiares: FTP: ${currentMetrics.ftp} | Pace: ${currentMetrics.runPace} | CSS: ${currentMetrics.swimCss}.
    Restrições Extras: ${athleteBio}
    Últimos treinos: \n${recentActivitiesSummary || "Sem histórico recente."}

    A data de HOJE é: ${dataHoje}. Calcule as datas da semana estritamente a partir disso. Responde em português de forma direta, analítica e focada em qualidade sobre volume.

    REGRA DO JSON: Se sugerires treinos, adicione as três barras no final da resposta exatamente assim:
    |||[{"date":"AAAA-MM-DD","type":"Run"|"Ride"|"Swim"|"Strength","name":"Nome Curto","desc":"- Bloco 1 (20m): ...\\n- Bloco 2 (20m): ..."}]`;

    // === COLOQUE ESTE BLOCO SUBSTIUINDO O TRY/CATCH DA FUNÇÃO sendMessage ===
    const requestBody = { contents: apiContents, systemInstruction: { parts: [{ text: systemInstruction }] } };
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody)
        });
        
        // Diagnóstico avançado: se der erro, lê a mensagem real do Google
        if (!res.ok) {
            const errorDetails = await res.json().catch(() => ({}));
            const apiMessage = errorDetails.error?.message || `Status HTTP ${res.status}`;
            throw new Error(`[Google API] ${apiMessage}`);
        }
        
        const data = await res.json();
        let coachText = data.candidates[0].content.parts[0].text;
        
        if (coachText.includes('|||')) {
            let partes = coachText.split('|||'); coachText = partes[0];
            try { 
                pendingWorkoutsList = JSON.parse(partes[1].trim()); 
                renderPendingWorkouts(); 
            } catch(e) { console.error(e); }
        }
        appendMessage('coach', coachText);
        chatHistory.push({ role: "model", parts: [{ text: coachText }] });
    } catch (err) {
        // Exibe o erro real na tela do chat
        appendMessage('coach', `🚨 Erro na comunicação: ${err.message}`);
    } finally {
        inputEl.disabled = false; btnEl.disabled = false;
    }
}

function clearChat() {
    chatHistory = [];
    const box = document.getElementById('chat-box');
    if (box) box.innerHTML = '<div class="message coach">Histórico limpo! Como posso ajudar com a sua planilha focada no Sprint Triathlon hoje?</div>';
}

function renderPendingWorkouts() {
    const card = document.getElementById('validation-card');
    const list = document.getElementById('preview-list');
    if (!card || !list) return;
    list.innerHTML = '';
    
    if (!pendingWorkoutsList || pendingWorkoutsList.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    pendingWorkoutsList.forEach(w => {
        const item = document.createElement('div');
        item.className = 'preview-workout-item';
        item.innerHTML = `<strong>${w.date} - [${w.type}] ${w.name}</strong><pre>${w.desc}</pre>`;
        list.appendChild(item);
    });
    card.style.display = 'block';
}

// === 9. ENVIO PARA INTERVALS.ICU ===
async function uploadWorkouts() {
    const athleteId = localStorage.getItem('athleteId');
    const intervalsKey = localStorage.getItem('intervalsKey');
    if (!athleteId || !intervalsKey || pendingWorkoutsList.length === 0) return;

    const btnEl = document.querySelector('#validation-card button');
    if (btnEl) btnEl.disabled = true;
    showStatus('Enviando treinos para o Intervals...', 'var(--accent-color)');
    
    const authHeader = { 
        'Authorization': `Basic ${btoa(`API_KEY:${intervalsKey}`)}`,
        'Content-Type': 'application/json'
    };

    let successes = 0;
    for (const w of pendingWorkoutsList) {
        const payload = {
            start_date_local: `${w.date}T06:00:00`,
            type: w.type,
            name: w.name,
            description: w.desc
        };

        try {
            const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events`, {
                method: 'POST',
                headers: authHeader,
                body: JSON.stringify(payload)
            });
            if (res.ok) successes++;
        } catch (e) {
            console.error('Erro ao subir treino:', e);
        }
    }

    if (successes > 0) {
        showStatus(`${successes} treino(s) enviados!`, 'var(--success-color)');
        appendMessage('coach', `🎯 Feito! Enviei ${successes} treino(s) direto para o seu calendário no Intervals.icu. Estão prontos para sincronizar com o Garmin/MyWhoosh!`);
        pendingWorkoutsList = [];
        renderPendingWorkouts();
        fetchIntervalsData();
    } else {
        showStatus('Erro ao enviar treinos.', 'var(--danger-color)');
        if (btnEl) btnEl.disabled = false;
    }
}

// === ALIAS DE COMPATIBILIDADE ===
function approvePendingWorkouts() { uploadWorkouts(); }

console.log("✅ [DEBUG] app.js terminou de carregar com sucesso!");
