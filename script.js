import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// =========================================================================
// ⚠️ ATENÇÃO: COLOQUE SUAS CHAVES DO FIREBASE ABAIXO! ⚠️
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyA_i9BkvMFIXxTTtJA6dyFc2HLXKP-TmHU",
  authDomain: "wms-h7.firebaseapp.com",
  projectId: "wms-h7",
  storageBucket: "wms-h7.firebasestorage.app",
  messagingSenderId: "274655939351",
  appId: "1:274655939351:web:806d2b96064d67b16b8552"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SENHA_SISTEMA = "Pinda@2026Operacional";
const DOMINIO = "@rupturatracker.com";
const paginaAtual = window.location.pathname;

let chartEvoInstance = null;
let chartLojaInstance = null;

// ==========================================
// 1. ROTEAMENTO E MONITOR DE ACESSO
// ==========================================
onAuthStateChanged(auth, (user) => {
    const isLogin = paginaAtual.includes('index.html') || paginaAtual === '/' || paginaAtual.endsWith('/');
    if (user) {
        if (isLogin) window.location.href = 'home.html';
        else {
            configurarInterface(user.email);
            if (paginaAtual.includes('incluir.html')) carregarOpcoesInclusao();
            if (paginaAtual.includes('dashboard.html')) carregarDashboard(user.email);
            if (paginaAtual.includes('historico.html')) carregarHistorico(user.email);
            if (paginaAtual.includes('usuarios.html')) carregarGerenciamentoUsuarios(user.email);
        }
    } else if (!isLogin) window.location.href = 'index.html';
});

function configurarInterface(email) {
    const userPart = email.split('@')[0].toUpperCase();
    const isRegional = email.includes('regional');
    
    const elNome = document.getElementById('ui-nome');
    const elPerfil = document.getElementById('ui-perfil');
    if (elNome) elNome.innerText = isRegional ? "Regional V.P" : `Loja ${userPart}`;
    if (elPerfil) elPerfil.innerText = isRegional ? "Visão Regional" : `Unidade: ${userPart}`;

    const elSaudacao = document.getElementById('saudacao');
    if (elSaudacao) {
        const hora = new Date().getHours();
        const saudacao = hora < 12 ? 'Bom dia' : (hora < 18 ? 'Boa tarde' : 'Boa noite');
        elSaudacao.innerText = `${saudacao}, ${isRegional ? 'Regional V.P' : userPart}.`;
    }

    const cardUser = document.getElementById('cardUsuarios');
    if (cardUser) cardUser.style.display = isRegional ? 'block' : 'none';
}

// ==========================================
// 2. LOGIN E LOGOUT
// ==========================================
const formLogin = document.getElementById('formLogin');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ident = document.getElementById('emailInput').value.trim().toLowerCase();
        const btn = document.getElementById('btnEntrar');
        btn.innerText = "Acessando...";
        try {
            await signInWithEmailAndPassword(auth, ident + DOMINIO, SENHA_SISTEMA);
        } catch (err) {
            document.getElementById('msgErroLogin').classList.remove('hidden');
            btn.innerText = "Entrar no Sistema";
        }
    });
}

const btnSair = document.getElementById('btnSair');
if (btnSair) btnSair.addEventListener('click', () => signOut(auth));

// ==========================================
// 3. INCLUIR RUPTURA
// ==========================================
async function carregarOpcoesInclusao() {
    const selectDepto = document.getElementById('departamento');
    const selectSecao = document.getElementById('secao');
    if (!selectDepto || !selectSecao) return;

    try {
        const response = await fetch('secoes.json');
        const mapaJson = await response.json();

        selectDepto.innerHTML = `<option value="">1º Escolha o Departamento...</option>`;
        Object.keys(mapaJson).sort().forEach(dep => {
            selectDepto.innerHTML += `<option value="${dep}">${dep}</option>`;
        });

        selectDepto.addEventListener('change', (e) => {
            const deptoEscolhido = e.target.value;
            selectSecao.innerHTML = `<option value="">Selecione a seção...</option>`;
            
            if (deptoEscolhido && mapaJson[deptoEscolhido]) {
                selectSecao.disabled = false;
                selectSecao.style.backgroundColor = '#f8fafc'; 
                mapaJson[deptoEscolhido].sort().forEach(sec => {
                    selectSecao.innerHTML += `<option value="${sec}">${sec}</option>`;
                });
            } else {
                selectSecao.disabled = true;
                selectSecao.style.backgroundColor = '#e2e8f0'; 
            }
        });
    } catch (err) { console.error("Erro no JSON", err); }
}

const formRup = document.getElementById('formRuptura');
if (formRup) {
    document.getElementById('dataAuditoria').valueAsDate = new Date();
    formRup.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.innerText = "Salvando...";
        
        const emailLogado = auth.currentUser.email;
        const filialCalculada = emailLogado.split('@')[0].toUpperCase().replace('H', 'H-');

        const qtdR = parseInt(document.getElementById('qtdRuptura').value);
        const qtdD = parseInt(document.getElementById('qtdDeposito').value);
        const perc = qtdR > 0 ? parseFloat(((qtdD / qtdR) * 100).toFixed(2)) : 0;
        
        try {
            await addDoc(collection(db, "auditorias_ruptura"), {
                data: document.getElementById('dataAuditoria').value,
                filial: filialCalculada,
                departamento: document.getElementById('departamento').value,
                secao: document.getElementById('secao').value,
                qtdRuptura: qtdR, qtdLoja: parseInt(document.getElementById('qtdLoja').value),
                qtdDeposito: qtdD, qtdSujeira: parseInt(document.getElementById('qtdSujeira').value),
                indicadorLogistico: perc,
                registradoPor: emailLogado, timestamp: serverTimestamp()
            });
            document.getElementById('msgSucesso').classList.remove('hidden');
            setTimeout(() => document.getElementById('msgSucesso').classList.add('hidden'), 3000);
            e.target.reset();
            document.getElementById('dataAuditoria').valueAsDate = new Date();
            document.getElementById('secao').disabled = true;
            document.getElementById('secao').style.backgroundColor = '#e2e8f0';
            configurarInterface(auth.currentUser.email);
        } catch (err) { alert("Erro ao salvar."); }
        finally { btn.innerText = "Salvar Auditoria"; }
    });
}

// ==========================================
// 4. DASHBOARD EXECUTIVO (COM LOCAL CACHING)
// ==========================================
async function carregarDashboard(email) {
    const isReg = email.includes('regional');
    const lojaBase = email.split('@')[0].toUpperCase().replace('H', 'H-');
    
    const mesInput = document.getElementById('dashMes');
    const filialInput = document.getElementById('dashFilial');
    const containerFilial = document.getElementById('containerDashFilial');
    
    mesInput.value = new Date().toISOString().slice(0, 7);

    if (isReg) {
        const snapUsers = await getDocs(collection(db, "perfil_usuarios"));
        let lojasCadastradas = [];
        snapUsers.forEach(doc => {
            const u = doc.data();
            if (u.permissao !== 'regional') lojasCadastradas.push(u.identificador.toUpperCase().replace('H', 'H-'));
        });
        
        filialInput.innerHTML = '<option value="">Visão Regional (Todas as Lojas)</option>';
        lojasCadastradas.sort().forEach(lojaID => {
            filialInput.innerHTML += `<option value="${lojaID}">${lojaID}</option>`;
        });
    } else {
        containerFilial.style.display = 'none';
        filialInput.value = lojaBase;
    }

    // 🚀 A BLINDAGEM DO BANCO DE DADOS ACONTECE AQUI
    let cacheDadosBrutos = null; 
    let mesBuscadoNoCache = "";

    async function processarDados() {
        const m = mesInput.value;
        const f = isReg ? filialInput.value : lojaBase;
        
        // Só vai no Firebase se for o primeiro carregamento ou se mudarem o Mês
        if (!cacheDadosBrutos || mesBuscadoNoCache !== m) {
            // Mostra pro usuário que está processando
            document.getElementById('kpiOfensor').innerText = "Baixando da nuvem...";
            
            const snap = await getDocs(isReg ? collection(db, "auditorias_ruptura") : query(collection(db, "auditorias_ruptura"), where("filial", "==", lojaBase)));
            
            cacheDadosBrutos = [];
            snap.forEach(doc => cacheDadosBrutos.push(doc.data()));
            mesBuscadoNoCache = m;
        }

        let stats = { tr: 0, td: 0, deptos: {}, lojas: {}, evolucao: {} };

        // Agora o loop roda na MEMÓRIA RAM do computador, custo ZERO pro Firebase
        cacheDadosBrutos.forEach(v => {
            if ((!m || v.data.startsWith(m)) && (!f || v.filial === f)) {
                stats.tr += v.qtdRuptura;
                stats.td += v.qtdDeposito;

                const d = v.departamento || 'Outros';
                if (!stats.deptos[d]) stats.deptos[d] = { r: 0, d: 0 };
                stats.deptos[d].r += v.qtdRuptura;
                stats.deptos[d].d += v.qtdDeposito;

                if (!stats.lojas[v.filial]) stats.lojas[v.filial] = { r: 0, d: 0 };
                stats.lojas[v.filial].r += v.qtdRuptura;
                stats.lojas[v.filial].d += v.qtdDeposito;

                if (!stats.evolucao[v.data]) stats.evolucao[v.data] = { r: 0, d: 0 };
                stats.evolucao[v.data].r += v.qtdRuptura;
                stats.evolucao[v.data].d += v.qtdDeposito;
            }
        });

        atualizarUI(stats, f, isReg);
    }

    function atualizarUI(s, filtroAtivo, isReg) {
        document.getElementById('kpiPercentual').innerText = s.tr > 0 ? `${((s.td/s.tr)*100).toFixed(2)}%` : "0%";
        document.getElementById('kpiRupturaVolume').innerText = s.tr;
        
        const piorDep = Object.keys(s.deptos).length > 0 ? Object.keys(s.deptos).reduce((a, b) => (s.deptos[a].d / s.deptos[a].r) > (s.deptos[b].d / s.deptos[b].r) ? a : b) : "---";
        document.getElementById('kpiOfensor').innerText = piorDep;

        const piorLj = Object.keys(s.lojas).length > 0 ? Object.keys(s.lojas).reduce((a, b) => (s.lojas[a].d / s.lojas[a].r) > (s.lojas[b].d / s.lojas[b].r) ? a : b) : "---";
        document.getElementById('kpiPiorLoja').innerText = isReg && !filtroAtivo ? piorLj : (filtroAtivo || "---");

        const corpo = document.getElementById('tabelaDepto');
        corpo.innerHTML = '';
        Object.keys(s.deptos).sort().forEach(d => {
            const r = s.deptos[d].r;
            const dep = s.deptos[d].d;
            const ef = r > 0 ? (dep / r * 100).toFixed(2) : 0;
            const status = ef <= 5 ? 'good' : 'danger';
            const textoStatus = ef <= 5 ? 'OK' : 'Crítico';
            corpo.innerHTML += `<tr><td><strong>${d}</strong></td><td>${r}</td><td>${dep}</td><td>${ef}%</td><td><span class="badge-kpi ${status}">${textoStatus}</span></td></tr>`;
        });

        renderCharts(s, isReg && !filtroAtivo);
    }

    function renderCharts(s, mostrarLojas) {
        const ctxEvo = document.getElementById('chartEvolucao');
        const labelsEvo = Object.keys(s.evolucao).sort();
        const dataEvo = labelsEvo.map(k => {
            let r = s.evolucao[k].r;
            return r > 0 ? (s.evolucao[k].d / r * 100).toFixed(2) : 0;
        });

        if (chartEvoInstance) chartEvoInstance.destroy();
        chartEvoInstance = new Chart(ctxEvo, {
            type: 'line',
            data: { labels: labelsEvo.map(d => d.split('-').reverse().slice(0,2).join('/')), datasets: [{ label: '% Ruptura', data: dataEvo, borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        const ctxLj = document.getElementById('chartLojas');
        if (mostrarLojas) {
            const labelsLj = Object.keys(s.lojas);
            const dataLj = labelsLj.map(k => {
                let r = s.lojas[k].r;
                return r > 0 ? (s.lojas[k].d / r * 100).toFixed(2) : 0;
            });
            if (chartLojaInstance) chartLojaInstance.destroy();
            chartLojaInstance = new Chart(ctxLj, {
                type: 'bar',
                data: { labels: labelsLj, datasets: [{ label: '% Ruptura', data: dataLj, backgroundColor: '#dc2626' }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
            document.getElementById('containerChartLojas').style.display = 'block';
            document.querySelector('.charts-grid').style.gridTemplateColumns = '1fr 1fr';
        } else {
            document.getElementById('containerChartLojas').style.display = 'none';
            document.querySelector('.charts-grid').style.gridTemplateColumns = '1fr';
        }
    }

    mesInput.addEventListener('change', processarDados);
    filialInput.addEventListener('change', processarDados);
    processarDados(); // Dispara na primeira vez que abre a tela
}

// ==========================================
// 5. HISTÓRICO (JÁ ESTAVA PROTEGIDO PELO BOTÃO BUSCAR)
// ==========================================
async function carregarHistorico(email) {
    const isReg = email.includes('regional');
    const loja = email.split('@')[0].toUpperCase().replace('H', 'H-');
    
    const containerFilial = document.getElementById('containerFiltroFilial');
    const filialInput = document.getElementById('filtroFilial');
    const btnBuscar = document.getElementById('btnBuscarHistorico');
    
    if (!isReg) {
        containerFilial.style.display = 'none';
    } else {
        const snapUsers = await getDocs(collection(db, "perfil_usuarios"));
        let lojasCadastradas = [];
        snapUsers.forEach(doc => {
            const u = doc.data();
            if (u.permissao !== 'regional') lojasCadastradas.push(u.identificador.toUpperCase().replace('H', 'H-'));
        });
        
        filialInput.innerHTML = '<option value="">Todas as Lojas</option>';
        lojasCadastradas.sort().forEach(lojaID => {
            filialInput.innerHTML += `<option value="${lojaID}">${lojaID}</option>`;
        });
    }
    
    const mesInput = document.getElementById('filtroMes');
    mesInput.value = new Date().toISOString().slice(0, 7);

    try {
        const res = await fetch('secoes.json');
        const mapaJson = await res.json();
        const fDepto = document.getElementById('filtroDepartamento');
        const fSecao = document.getElementById('filtroSecao');

        Object.keys(mapaJson).sort().forEach(dep => fDepto.innerHTML += `<option value="${dep}">${dep}</option>`);

        fDepto.addEventListener('change', (e) => {
            const depEscolhido = e.target.value;
            fSecao.innerHTML = `<option value="">Todas</option>`;
            if(depEscolhido) {
                mapaJson[depEscolhido].sort().forEach(sec => fSecao.innerHTML += `<option value="${sec}">${sec}</option>`);
            } else {
                Object.values(mapaJson).flat().sort().forEach(sec => fSecao.innerHTML += `<option value="${sec}">${sec}</option>`);
            }
        });
    } catch(e) { console.error("Erro no JSON", e); }

    async function buscar() {
        const textoOriginal = btnBuscar.innerHTML;
        btnBuscar.innerHTML = `<span class="material-icons-round">sync</span> Buscando...`;
        btnBuscar.disabled = true;

        const corpo = document.getElementById('corpoTabela');
        corpo.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px;">Carregando dados da nuvem...</td></tr>`;

        try {
            const snap = await getDocs(isReg ? collection(db, "auditorias_ruptura") : query(collection(db, "auditorias_ruptura"), where("filial", "==", loja)));
            const m = mesInput.value;
            const dpto = document.getElementById('filtroDepartamento').value;
            const s = document.getElementById('filtroSecao').value;
            const f = filialInput.value;
            
            corpo.innerHTML = '';
            let encontrou = false;

            snap.forEach(d => {
                const v = d.data();
                if ((!m || v.data.startsWith(m)) && (!dpto || v.departamento === dpto) && (!s || v.secao === s) && (!f || v.filial === f)) {
                    encontrou = true;
                    const badgeClass = v.indicadorLogistico <= 5 ? 'good' : 'danger';
                    corpo.innerHTML += `<tr><td>${v.data.split('-').reverse().join('/')}</td><td>${v.filial}</td><td><strong>${v.departamento || '-'}</strong></td><td>${v.secao}</td><td>${v.qtdRuptura}/${v.qtdDeposito}</td><td><span class="badge-kpi ${badgeClass}">${v.indicadorLogistico.toFixed(2)}%</span></td></tr>`;
                }
            });

            if (!encontrou) {
                corpo.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: var(--text-muted);">Nenhum lançamento encontrado para estes filtros.</td></tr>`;
            }

        } catch (error) {
            corpo.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: red;">Erro ao buscar dados.</td></tr>`;
        } finally {
            btnBuscar.innerHTML = textoOriginal;
            btnBuscar.disabled = false;
        }
    }

    btnBuscar.addEventListener('click', buscar);
}

// ==========================================
// 6. GERENCIAMENTO DE USUÁRIOS
// ==========================================
async function carregarGerenciamentoUsuarios(email) {
    if (!email.includes('regional')) { window.location.href = 'home.html'; return; }
    
    const listar = async () => {
        const corpo = document.getElementById('listaUsuariosCadastrados');
        corpo.innerHTML = '';
        const snap = await getDocs(collection(db, "perfil_usuarios"));
        snap.forEach(d => {
            const u = d.data();
            corpo.innerHTML += `<tr><td><strong>${u.identificador}</strong></td><td>${u.permissao === 'regional' ? 'Regional' : 'Unidade'}</td><td><span class="badge-kpi good">Ativo</span></td></tr>`;
        });
    };

    const form = document.getElementById('formUsuario');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ident = document.getElementById('emailNovoUser').value.trim().toLowerCase();
        const nivel = document.getElementById('nivelAcesso').value;
        const btn = document.getElementById('btnCriarUser');
        btn.innerText = "Autorizando...";
        try {
            const appAux = getApps().find(a => a.name === "Aux") || initializeApp(firebaseConfig, "Aux");
            await createUserWithEmailAndPassword(getAuth(appAux), ident + DOMINIO, SENHA_SISTEMA);
            await signOut(getAuth(appAux));
            
            await addDoc(collection(db, "perfil_usuarios"), { identificador: ident, permissao: nivel, criadoEm: serverTimestamp() });
            
            document.getElementById('msgSucessoUser').classList.remove('hidden');
            form.reset();
            listar();
            setTimeout(() => document.getElementById('msgSucessoUser').classList.add('hidden'), 3000);
        } catch (err) { alert("Erro ao criar."); }
        finally { btn.innerText = "Autorizar"; }
    });
    listar();
}