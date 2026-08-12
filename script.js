// =========================================================================
// 1. CONFIGURAÇÕES DA API (100% GOOGLE SHEETS - ZERO FIREBASE)
// =========================================================================

// ⚠️ COLE AQUI A URL DO SEU APP DA WEB DO GOOGLE SHEETS ⚠️
const API_URL = "COLE_SUA_URL_DO_GOOGLE_AQUI"; 

const paginaAtual = window.location.pathname;
let chartEvoInstance = null;
let chartLojaInstance = null;

// ==========================================
// 2. MONITOR DE SESSÃO LOCAL E ROTEAMENTO
// ==========================================
function verificarSessao() {
    const usuarioLogado = localStorage.getItem('usuarioRuptura');
    const isLogin = paginaAtual.includes('index.html') || paginaAtual === '/' || paginaAtual.endsWith('/');

    if (usuarioLogado) {
        if (isLogin) {
            window.location.href = 'home.html';
        } else {
            configurarInterface(usuarioLogado);
            if (paginaAtual.includes('incluir.html')) carregarOpcoesInclusao(usuarioLogado);
            if (paginaAtual.includes('dashboard.html')) carregarDashboard(usuarioLogado);
            if (paginaAtual.includes('historico.html')) carregarHistorico(usuarioLogado);
            if (paginaAtual.includes('usuarios.html')) carregarGerenciamentoUsuarios(usuarioLogado);
            if (paginaAtual.includes('auditoria701.html')) carregarAuditoria701(usuarioLogado);
        }
    } else {
        if (!isLogin) window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', verificarSessao);

function configurarInterface(ident) {
    const userPart = ident.toUpperCase();
    const isRegional = ident === 'regional';
    
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
// 3. LOGIN E LOGOUT
// ==========================================
const formLogin = document.getElementById('formLogin');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ident = document.getElementById('emailInput').value.trim().toLowerCase();
        const btn = document.getElementById('btnEntrar');
        btn.innerText = "Verificando...";
        
        try {
            const res = await fetch(API_URL + "?action=usuarios");
            const usuarios = await res.json();
            
            let usuarioValido = false;
            if (ident === 'regional') {
                usuarioValido = true;
            } else {
                usuarioValido = usuarios.some(u => String(u.identificador).toLowerCase() === ident);
            }

            if (usuarioValido) {
                localStorage.setItem('usuarioRuptura', ident);
                window.location.href = 'home.html';
            } else {
                document.getElementById('msgErroLogin').classList.remove('hidden');
                document.getElementById('msgErroLogin').innerHTML = '<span class="material-icons-round">error_outline</span> Usuário não cadastrado na planilha.';
                btn.innerText = "Entrar no Sistema";
            }
        } catch (err) {
            alert("Erro de conexão com o banco de dados. Tente novamente.");
            btn.innerText = "Entrar no Sistema";
        }
    });
}

const btnSair = document.getElementById('btnSair');
if (btnSair) {
    btnSair.addEventListener('click', () => {
        localStorage.removeItem('usuarioRuptura');
        window.location.href = 'index.html';
    });
}

// ==========================================
// 4. INCLUIR RUPTURA (MANUAL)
// ==========================================
async function carregarOpcoesInclusao(ident) {
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
    } catch (err) {}

    const formRup = document.getElementById('formRuptura');
    if (formRup) {
        document.getElementById('dataAuditoria').valueAsDate = new Date();
        formRup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.innerText = "Salvando...";
            
            const filialCalculada = ident.toUpperCase().replace('H', 'H-');

            const qtdR = parseInt(document.getElementById('qtdRuptura').value) || 0;
            const qtdD = parseInt(document.getElementById('qtdDeposito').value) || 0;
            const qtdL = parseInt(document.getElementById('qtdLoja').value) || 0;
            const perc = qtdR > 0 ? parseFloat(((qtdD / qtdR) * 100).toFixed(2)) : 0;
            const totalAudit = qtdR + qtdL;
            
            try {
                const registro = {
                    tipo: "auditoria",
                    data: document.getElementById('dataAuditoria').value,
                    filial: filialCalculada,
                    departamento: document.getElementById('departamento').value,
                    secao: document.getElementById('secao').value,
                    qtdRuptura: qtdR,
                    qtdLoja: qtdL,
                    qtdDeposito: qtdD,
                    qtdSujeira: parseInt(document.getElementById('qtdSujeira').value) || 0,
                    indicadorLogistico: perc,
                    registradoPor: "Manual - " + ident,
                    totalAuditado: totalAudit
                };

                const resposta = await fetch(API_URL, { method: 'POST', body: JSON.stringify(registro) });
                const resultado = await resposta.json();
                
                if(resultado.status === "sucesso") {
                    document.getElementById('msgSucesso').classList.remove('hidden');
                    setTimeout(() => document.getElementById('msgSucesso').classList.add('hidden'), 3000);
                    e.target.reset();
                    document.getElementById('dataAuditoria').valueAsDate = new Date();
                    document.getElementById('secao').disabled = true;
                    document.getElementById('secao').style.backgroundColor = '#e2e8f0';
                } else {
                    alert("Erro ao salvar na planilha.");
                }
            } catch (err) { alert("Erro de conexão ao salvar."); }
            finally { btn.innerText = "Salvar Auditoria"; }
        });
    }
}

// ==========================================
// 5. DASHBOARD EXECUTIVO
// ==========================================
async function carregarDashboard(ident) {
    const isReg = ident === 'regional';
    const lojaBase = ident.toUpperCase().replace('H', 'H-');
    
    const tipoPeriodo = document.getElementById('dashTipoPeriodo');
    const dataInput = document.getElementById('dashData');
    const labelData = document.getElementById('labelData');
    const filialInput = document.getElementById('dashFilial');
    const containerFilial = document.getElementById('containerDashFilial');
    
    if(!dataInput) return;
    
    dataInput.value = new Date().toISOString().slice(0, 7);

    tipoPeriodo.addEventListener('change', (e) => {
        if (e.target.value === 'dia') {
            dataInput.type = 'date';
            labelData.innerText = 'Selecione o Dia';
            dataInput.value = new Date().toISOString().slice(0, 10);
        } else {
            dataInput.type = 'month';
            labelData.innerText = 'Selecione o Mês';
            dataInput.value = new Date().toISOString().slice(0, 7);
        }
        processarDados();
    });

    if (isReg) {
        try {
            const resU = await fetch(API_URL + "?action=usuarios");
            const snapUsers = await resU.json();
            
            filialInput.innerHTML = '<option value="">Visão Regional (Todas as Lojas)</option>';
            let lojasCadastradas = [];
            snapUsers.forEach(u => {
                if (u.permissao !== 'regional') lojasCadastradas.push(String(u.identificador).toUpperCase().replace('H', 'H-'));
            });
            lojasCadastradas.sort().forEach(lojaID => {
                filialInput.innerHTML += `<option value="${lojaID}">${lojaID}</option>`;
            });
        } catch (e) {}
    } else {
        containerFilial.style.display = 'none';
        filialInput.value = lojaBase;
    }

    let cacheDadosBrutos = null; 

    async function processarDados() {
        const m = dataInput.value; 
        const f = isReg ? filialInput.value : lojaBase;
        
        if (!cacheDadosBrutos) {
            document.getElementById('kpiOfensor').innerText = "Baixando da planilha...";
            try {
                const res = await fetch(API_URL);
                cacheDadosBrutos = await res.json();
            } catch (error) { return; }
        }

        let stats = { tr: 0, td: 0, totalVerificados: 0, deptos: {}, lojas: {}, evolucao: {} };

        cacheDadosBrutos.forEach(v => {
            let dataLida = String(v.data).split("T")[0]; 

            if ((!m || dataLida.startsWith(m)) && (!f || v.filial === f)) {
                let qR = Number(v.qtdRuptura) || 0;
                let qD = Number(v.qtdDeposito) || 0;
                let totalItens = Number(v.totalAuditado) || (qR + (Number(v.qtdLoja) || 0));

                stats.tr += qR;
                stats.td += qD;
                stats.totalVerificados += totalItens;

                const d = v.departamento || 'Outros';
                if (!stats.deptos[d]) stats.deptos[d] = { total: 0, r: 0, d: 0 };
                stats.deptos[d].total += totalItens;
                stats.deptos[d].r += qR;
                stats.deptos[d].d += qD;

                if (!stats.lojas[v.filial]) stats.lojas[v.filial] = { r: 0, d: 0 };
                stats.lojas[v.filial].r += qR;
                stats.lojas[v.filial].d += qD;

                if (!stats.evolucao[dataLida]) stats.evolucao[dataLida] = { r: 0, d: 0 };
                stats.evolucao[dataLida].r += qR;
                stats.evolucao[dataLida].d += qD;
            }
        });

        atualizarUI(stats, f, isReg);
    }

    function atualizarUI(s, filtroAtivo, isReg) {
        document.getElementById('kpiPercentual').innerText = s.tr > 0 ? `${((s.td/s.tr)*100).toFixed(2)}%` : "0%";
        document.getElementById('kpiRupturaVolume').innerText = s.totalVerificados;
        
        const piorDep = Object.keys(s.deptos).length > 0 ? Object.keys(s.deptos).reduce((a, b) => (s.deptos[a].d / s.deptos[a].r) > (s.deptos[b].d / s.deptos[b].r) ? a : b) : "---";
        document.getElementById('kpiOfensor').innerText = piorDep;

        const piorLj = Object.keys(s.lojas).length > 0 ? Object.keys(s.lojas).reduce((a, b) => (s.lojas[a].d / s.lojas[a].r) > (s.lojas[b].d / s.lojas[b].r) ? a : b) : "---";
        document.getElementById('kpiPiorLoja').innerText = isReg && !filtroAtivo ? piorLj : (filtroAtivo || "---");

        const melhorLj = Object.keys(s.lojas).length > 0 ? Object.keys(s.lojas).reduce((a, b) => (s.lojas[a].d / s.lojas[a].r) < (s.lojas[b].d / s.lojas[b].r) ? a : b) : "---";
        const elMelhorLoja = document.getElementById('kpiMelhorLoja');
        if (elMelhorLoja) {
            elMelhorLoja.innerText = isReg && !filtroAtivo ? melhorLj : (filtroAtivo || "---");
        }

        const corpo = document.getElementById('tabelaDepto');
        corpo.innerHTML = '';
        Object.keys(s.deptos).sort().forEach(d => {
            const total = s.deptos[d].total;
            const r = s.deptos[d].r;
            const dep = s.deptos[d].d;
            
            // CORREÇÃO: Tabela gerando apenas as 5 colunas do cabeçalho
            const ef = r > 0 ? (dep / r * 100).toFixed(2) : 0;
            const status = ef <= 5 ? 'good' : 'danger';
            const textoStatus = ef <= 5 ? 'OK' : 'Crítico';
            
            corpo.innerHTML += `<tr>
                <td><strong>${d}</strong></td>
                <td>${total}</td>
                <td style="color: #dc2626; font-weight: 600;">${dep}</td>
                <td>${ef}%</td>
                <td><span class="badge-kpi ${status}">${textoStatus}</span></td>
            </tr>`;
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

    dataInput.addEventListener('change', processarDados);
    filialInput.addEventListener('change', processarDados);
    processarDados(); 
}

// ==========================================
// 6. HISTÓRICO 
// ==========================================
async function carregarHistorico(ident) {
    const isReg = ident === 'regional';
    const loja = ident.toUpperCase().replace('H', 'H-');
    
    const containerFilial = document.getElementById('containerFiltroFilial');
    const filialInput = document.getElementById('filtroFilial');
    const btnBuscar = document.getElementById('btnBuscarHistorico');
    
    if(!btnBuscar) return;

    if (!isReg) {
        containerFilial.style.display = 'none';
    } else {
        try {
            const resU = await fetch(API_URL + "?action=usuarios");
            const snapUsers = await resU.json();
            
            filialInput.innerHTML = '<option value="">Todas as Lojas</option>';
            let lojasCadastradas = [];
            snapUsers.forEach(u => {
                if (u.permissao !== 'regional') lojasCadastradas.push(String(u.identificador).toUpperCase().replace('H', 'H-'));
            });
            lojasCadastradas.sort().forEach(lojaID => {
                filialInput.innerHTML += `<option value="${lojaID}">${lojaID}</option>`;
            });
        } catch (e) {}
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
    } catch(e) {}

    async function buscar() {
        const textoOriginal = btnBuscar.innerHTML;
        btnBuscar.innerHTML = `<span class="material-icons-round">sync</span> Buscando...`;
        btnBuscar.disabled = true;

        const corpo = document.getElementById('corpoTabela');
        corpo.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px;">Lendo dados...</td></tr>`;

        try {
            const res = await fetch(API_URL);
            const dadosPlanilha = await res.json();
            
            const m = mesInput.value;
            const dpto = document.getElementById('filtroDepartamento').value;
            const s = document.getElementById('filtroSecao').value;
            const f = isReg ? filialInput.value : loja;
            
            corpo.innerHTML = '';
            
            let dadosFiltrados = dadosPlanilha.filter(v => {
                let dataLida = String(v.data).split("T")[0];
                return ((!m || dataLida.startsWith(m)) && (!dpto || v.departamento === dpto) && (!s || v.secao === s) && (!f || v.filial === f));
            });

            dadosFiltrados.sort((a, b) => {
                let dataA = String(a.data).split("T")[0];
                let dataB = String(b.data).split("T")[0];
                return dataB.localeCompare(dataA);
            });

            let dadosLimitados = dadosFiltrados.slice(0, 500);
            
            if (dadosLimitados.length === 0) {
                corpo.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: var(--text-muted);">Nenhum lançamento encontrado.</td></tr>`;
                return;
            }

            dadosLimitados.forEach(v => {
                let dataLida = String(v.data).split("T")[0];
                let indic = Number(v.indicadorLogistico) || 0;
                const badgeClass = indic <= 5 ? 'good' : 'danger';
                
                corpo.innerHTML += `<tr>
                    <td>${dataLida.split('-').reverse().join('/')}</td>
                    <td>${v.filial}</td>
                    <td><strong>${v.departamento || '-'}</strong></td>
                    <td>${v.secao}</td>
                    <td>${v.qtdRuptura}/${v.qtdDeposito}</td>
                    <td><span class="badge-kpi ${badgeClass}">${indic.toFixed(2)}%</span></td>
                </tr>`;
            });

            if (dadosFiltrados.length > 500) {
                corpo.innerHTML += `<tr>
                    <td colspan="6" class="text-center" style="padding: 15px; background: #f8fafc; color: var(--text-muted); font-size: 0.85rem; font-weight: 600;">
                        ⚠️ Exibindo os 500 lançamentos mais recentes de um total de ${dadosFiltrados.length}.
                    </td>
                </tr>`;
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
// 7. GERENCIAMENTO DE USUÁRIOS
// ==========================================
async function carregarGerenciamentoUsuarios(ident) {
    if (ident !== 'regional') { window.location.href = 'home.html'; return; }
    
    const listar = async () => {
        const corpo = document.getElementById('listaUsuariosCadastrados');
        if(!corpo) return;
        corpo.innerHTML = '<tr><td colspan="3" class="text-center">Lendo planilha...</td></tr>';
        
        try {
            const res = await fetch(API_URL + "?action=usuarios");
            const usuarios = await res.json();
            corpo.innerHTML = '';
            
            if(usuarios.length === 0) {
                 corpo.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum usuário cadastrado.</td></tr>';
                 return;
            }

            usuarios.forEach(u => {
                corpo.innerHTML += `<tr><td><strong>${u.identificador}</strong></td><td>${u.permissao === 'regional' ? 'Regional' : 'Unidade'}</td><td><span class="badge-kpi good">Ativo</span></td></tr>`;
            });
        } catch(e) {
            corpo.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Erro ao ler aba Usuarios.</td></tr>';
        }
    };

    const form = document.getElementById('formUsuario');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const novoIdent = document.getElementById('emailNovoUser').value.trim().toLowerCase();
            const nivel = document.getElementById('nivelAcesso').value;
            const btn = document.getElementById('btnCriarUser');
            btn.innerText = "Salvando...";

            try {
                const registroUser = { tipo: "usuario", identificador: novoIdent, permissao: nivel };
                await fetch(API_URL, { method: 'POST', body: JSON.stringify(registroUser) });
                
                document.getElementById('msgSucessoUser').classList.remove('hidden');
                form.reset();
                listar(); 
                setTimeout(() => document.getElementById('msgSucessoUser').classList.add('hidden'), 3000);
            } catch (err) { 
                alert("Erro ao enviar dados."); 
            } finally { 
                btn.innerText = "Autorizar"; 
            }
        });
    }
    
    listar();
}

// ==========================================
// 8. AUDITORIA 701 - MOBILE (100% NUVEM E MODAL)
// ==========================================
async function carregarAuditoria701(ident) {
    if (!paginaAtual.includes('auditoria701.html')) return;

    let dadosAgrupados = {}; 
    const filialCalculada = ident.toUpperCase().replace('H', 'H-');

    const telaImportar = document.getElementById('telaImportar');
    const telaTarefas = document.getElementById('telaTarefas');
    const telaItens = document.getElementById('telaItens');

    function mostrarModal(titulo, mensagem, tipo = 'info') {
        const overlay = document.getElementById('customModal');
        const elTitulo = document.getElementById('modalTitle');
        const elMensagem = document.getElementById('modalMessage');
        const elIcone = document.getElementById('modalIconSpan');
        const elIconBg = document.getElementById('modalIconBg');

        if(!overlay) { alert(mensagem); return; }

        elTitulo.innerText = titulo;
        elMensagem.innerText = mensagem;

        if (tipo === 'sucesso') {
            elIcone.innerText = 'check_circle';
            elIconBg.style.backgroundColor = '#d1fae5';
            elIconBg.style.color = '#059669';
        } else if (tipo === 'erro') {
            elIcone.innerText = 'error';
            elIconBg.style.backgroundColor = '#fee2e2';
            elIconBg.style.color = '#dc2626';
        } else {
            elIcone.innerText = 'info';
            elIconBg.style.backgroundColor = 'var(--primary-light)';
            elIconBg.style.color = 'var(--primary)';
        }

        overlay.classList.add('show');
    }

    const btnFecharModal = document.getElementById('btnFecharModal');
    if(btnFecharModal) {
        btnFecharModal.addEventListener('click', () => {
            document.getElementById('customModal').classList.remove('show');
        });
    }

    function gerenciarCache() {
        const dataHoje = new Date().toISOString().slice(0, 10); 
        const dataSalva = localStorage.getItem('audit701_data');
        const cacheSalvo = localStorage.getItem('audit701_cache_' + ident);

        if (dataSalva === dataHoje && cacheSalvo) {
            dadosAgrupados = JSON.parse(cacheSalvo);
            if (Object.keys(dadosAgrupados).length > 0) {
                document.getElementById('resumoTarefas').innerText = `${Object.keys(dadosAgrupados).length} Seções para Auditar`;
                renderizarListaTarefas();
                telaImportar.classList.remove('ativa');
                telaTarefas.classList.add('ativa');
            }
        } else {
            localStorage.removeItem('audit701_data');
            localStorage.removeItem('audit701_cache_' + ident);
        }
    }

    function salvarProgressoLocal() {
        const dataHoje = new Date().toISOString().slice(0, 10);
        localStorage.setItem('audit701_data', dataHoje);
        localStorage.setItem('audit701_cache_' + ident, JSON.stringify(dadosAgrupados));
    }

    document.getElementById('btnBaixarNuvem').addEventListener('click', async () => {
        const btn = document.getElementById('btnBaixarNuvem');
        const textoAntigo = btn.innerHTML;
        btn.innerHTML = `<span class="material-icons-round">sync</span> Aguarde...`;
        
        try {
            const res = await fetch(API_URL + "?action=nuvem701&filial=" + filialCalculada);
            const resposta = await res.json();
            
            if (resposta.json_data) {
                dadosAgrupados = JSON.parse(resposta.json_data);
                salvarProgressoLocal();
                
                telaImportar.classList.remove('ativa');
                telaTarefas.classList.add('ativa');
                
                renderizarListaTarefas();
                mostrarModal("Sincronizado", "Tarefas baixadas com sucesso da prancheta virtual!", "sucesso");
            } else {
                mostrarModal("Nuvem Vazia", "Nenhuma tarefa encontrada na nuvem para a sua loja hoje.", "info");
            }
        } catch (e) { mostrarModal("Falha na Conexão", "Erro ao tentar se comunicar com a planilha.", "erro"); }
        btn.innerHTML = textoAntigo;
    });

    document.getElementById('btnSubirNuvem').addEventListener('click', async () => {
        const btn = document.getElementById('btnSubirNuvem');
        const textoAntigo = btn.innerHTML;
        btn.innerHTML = `<span class="material-icons-round">sync</span> Subindo...`;
        
        try {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    tipo: "nuvem701",
                    filial: filialCalculada,
                    json_data: JSON.stringify(dadosAgrupados)
                })
            });
            mostrarModal("Progresso Salvo", "Dados na nuvem atualizados! A equipe já pode puxar as novidades.", "sucesso");
        } catch (e) { mostrarModal("Erro no Envio", "Não foi possível enviar o progresso para a planilha.", "erro"); }
        btn.innerHTML = textoAntigo;
    });

    gerenciarCache();

    document.getElementById('btnGerarTarefas').addEventListener('click', () => {
        const texto = document.getElementById('dados701').value.trim();
        if (!texto) { mostrarModal("Atenção", "Cole os dados do relatório do Excel antes de continuar.", "erro"); return; }

        const linhas = texto.split('\n');

        linhas.forEach(linha => {
            const colunas = linha.split('\t');
            if (colunas.length >= 4) {
                const cod = colunas[0].trim();
                const desc = colunas[1].trim();
                const depto = colunas[2].trim().toUpperCase();
                const secao = colunas[3].trim().toUpperCase();
                
                const chaveAgrupamento = `${depto}|${secao}`;

                if (!dadosAgrupados[chaveAgrupamento]) {
                    dadosAgrupados[chaveAgrupamento] = { depto: depto, secao: secao, itens: [], finalizada: false, enviado: false };
                }
                
                const produtoJaExiste = dadosAgrupados[chaveAgrupamento].itens.some(i => i.cod === cod);
                if (!produtoJaExiste) {
                    dadosAgrupados[chaveAgrupamento].itens.push({ cod: cod, desc: desc, resposta: null });
                }
            }
        });

        document.getElementById('dados701').value = '';
        const qtdSecoes = Object.keys(dadosAgrupados).length;
        if (qtdSecoes === 0) { mostrarModal("Formato Inválido", "Certifique-se de copiar as colunas separadas diretamente do Excel.", "erro"); return; }

        salvarProgressoLocal(); 
        document.getElementById('btnSubirNuvem').click();

        document.getElementById('resumoTarefas').innerText = `${qtdSecoes} Seções para Auditar`;
        renderizarListaTarefas();

        telaImportar.classList.remove('ativa');
        telaTarefas.classList.add('ativa');
    });

    document.getElementById('btnImportarMais').addEventListener('click', () => {
        telaTarefas.classList.remove('ativa');
        telaImportar.classList.add('ativa');
    });

    function renderizarListaTarefas() {
        const lista = document.getElementById('listaSecoes');
        lista.innerHTML = '';
        let todasEnviadas = true;
        let temDeposito = false;

        Object.keys(dadosAgrupados).forEach(chave => {
            const grupo = dadosAgrupados[chave];
            const concluidos = grupo.itens.filter(i => i.resposta !== null).length;
            const total = grupo.itens.length;
            const isConcluido = concluidos === total;
            
            if(typeof grupo.enviado === 'undefined') grupo.enviado = false;
            if (!grupo.enviado) todasEnviadas = false;
            
            if (grupo.itens.some(i => i.resposta === 'deposito')) {
                temDeposito = true;
            }
            
            grupo.finalizada = isConcluido;

            let actionHtml = '';
            if (grupo.enviado) {
                actionHtml = '';
            } else if (isConcluido) {
                actionHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary" onclick="abrirSecao('${chave}')" style="padding: 8px; background: #64748b;" title="Revisar">
                            <span class="material-icons-round" style="font-size: 1.2rem;">visibility</span>
                        </button>
                        <button class="btn-primary" id="btnEnv_${chave}" onclick="enviarSecao('${chave}')" style="padding: 8px 15px; background: #10b981;">
                            <span class="material-icons-round" style="font-size: 1.2rem;">send</span> Enviar
                        </button>
                    </div>
                `;
            } else {
                actionHtml = `<button class="btn-primary" onclick="abrirSecao('${chave}')" style="padding: 8px 15px; font-size: 0.85rem;">Auditar</button>`;
            }

            lista.innerHTML += `
                <div class="task-card ${grupo.enviado ? 'enviado' : ''}">
                    <div class="task-info">
                        <h3>${grupo.secao}</h3>
                        <p>${grupo.depto} • ${concluidos}/${total} verificados</p>
                    </div>
                    ${actionHtml}
                    ${grupo.enviado ? `<div class="enviado-overlay"><span class="material-icons-round">task_alt</span> Enviado</div>` : ''}
                </div>
            `;
        });

        const btnSalvar = document.getElementById('btnFinalizar701');
        if (todasEnviadas && Object.keys(dadosAgrupados).length > 0) {
            btnSalvar.classList.remove('hidden');
            btnSalvar.innerHTML = `<span class="material-icons-round">done_all</span> Encerrar Sessão`;
        } else {
            btnSalvar.classList.add('hidden');
        }

        const btnImprimir = document.getElementById('btnImprimirDeposito');
        if (temDeposito) {
            btnImprimir.classList.remove('hidden');
        } else {
            btnImprimir.classList.add('hidden');
        }
    }

    window.abrirSecao = function(chave) {
        const grupo = dadosAgrupados[chave];
        document.getElementById('tituloSecaoAtiva').innerText = grupo.secao;
        
        const lista = document.getElementById('listaItens');
        lista.innerHTML = '';

        grupo.itens.forEach((item, index) => {
            lista.innerHTML += `
                <div class="item-card">
                    <div class="item-header">
                        <div class="item-cod">CÓD: ${item.cod}</div>
                        <div class="item-desc">${item.desc}</div>
                    </div>
                    <div class="btn-group-audit">
                        <button class="btn-opt opt-loja ${item.resposta === 'loja' ? 'selecionado' : ''}" onclick="marcarResposta('${chave}', ${index}, 'loja')">
                            <span class="material-icons-round">check_circle</span> Na Loja
                        </button>
                        <button class="btn-opt opt-deposito ${item.resposta === 'deposito' ? 'selecionado' : ''}" onclick="marcarResposta('${chave}', ${index}, 'deposito')">
                            <span class="material-icons-round">inventory_2</span> Depósito
                        </button>
                        <button class="btn-opt opt-sujeira ${item.resposta === 'sujeira' ? 'selecionado' : ''}" onclick="marcarResposta('${chave}', ${index}, 'sujeira')">
                            <span class="material-icons-round">delete_sweep</span> Sujeira Sist.
                        </button>
                    </div>
                </div>
            `;
        });

        telaTarefas.classList.remove('ativa');
        telaItens.classList.add('ativa');
    };

    window.marcarResposta = function(chave, indexItem, resposta) {
        dadosAgrupados[chave].itens[indexItem].resposta = resposta;
        salvarProgressoLocal(); 
        abrirSecao(chave); 
    };

    document.getElementById('btnVoltarTarefas').addEventListener('click', () => {
        renderizarListaTarefas();
        telaItens.classList.remove('ativa');
        telaTarefas.classList.add('ativa');
        document.getElementById('btnSubirNuvem').click();
    });

    window.enviarSecao = async function(chave) {
        const grupo = dadosAgrupados[chave];
        const btn = document.getElementById('btnEnv_' + chave);
        const txtOriginal = btn.innerHTML;
        
        btn.innerHTML = `<span class="material-icons-round">sync</span>...`;
        btn.disabled = true;

        const dataHoje = new Date().toISOString().slice(0, 10);
        let qtdLoja = 0, qtdDeposito = 0, qtdSujeira = 0;
        
        grupo.itens.forEach(i => {
            if(i.resposta === 'loja') qtdLoja++;
            if(i.resposta === 'deposito') qtdDeposito++;
            if(i.resposta === 'sujeira') qtdSujeira++;
        });

        const totalAuditado = grupo.itens.length;
        const qtdRuptura = qtdDeposito + qtdSujeira; 
        const perc = qtdRuptura > 0 ? parseFloat(((qtdDeposito / qtdRuptura) * 100).toFixed(2)) : 0;

        const registro = {
            tipo: "auditoria",
            data: dataHoje,
            filial: filialCalculada,
            departamento: grupo.depto,
            secao: grupo.secao,
            qtdRuptura: qtdRuptura,
            qtdLoja: qtdLoja,
            qtdDeposito: qtdDeposito,
            qtdSujeira: qtdSujeira,
            indicadorLogistico: perc,
            registradoPor: "App701 - " + ident,
            totalAuditado: totalAuditado
        };

        try {
            await fetch(API_URL, { method: 'POST', body: JSON.stringify(registro) });
            grupo.enviado = true; 
            salvarProgressoLocal();
            document.getElementById('btnSubirNuvem').click(); 
            renderizarListaTarefas(); 
        } catch (err) {
            mostrarModal("Erro no Envio", "Não foi possível enviar a seção " + grupo.secao, "erro");
            btn.innerHTML = txtOriginal;
            btn.disabled = false;
        }
    };

    document.getElementById('btnFinalizar701').addEventListener('click', async () => {
        localStorage.removeItem('audit701_data');
        localStorage.removeItem('audit701_cache_' + ident);

        try {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ tipo: "nuvem701", filial: filialCalculada, json_data: JSON.stringify({}) })
            });
        } catch (e) {}

        window.location.href = 'home.html';
    });

    const btnImprimir = document.getElementById('btnImprimirDeposito');
    if (btnImprimir) {
        btnImprimir.addEventListener('click', () => {
            let itensDeposito = [];

            Object.keys(dadosAgrupados).forEach(chave => {
                const grupo = dadosAgrupados[chave];
                grupo.itens.forEach(item => {
                    if (item.resposta === 'deposito') {
                        itensDeposito.push({ secao: grupo.secao, cod: item.cod, desc: item.desc });
                    }
                });
            });

            if (itensDeposito.length === 0) return;

            const printWindow = window.open('', '_blank', 'width=400,height=600');
            
            let htmlStr = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Lista de Busca - Depósito</title>
                    <style>
                        @page { margin: 0; }
                        body { font-family: 'Courier New', Courier, monospace; width: 78mm; padding: 10px; margin: 0; color: #000; background: #fff; }
                        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                        .header h2 { margin: 0; font-size: 18px; font-weight: 900; }
                        .header p { margin: 5px 0 0 0; font-size: 13px; font-weight: bold; }
                        .item { border-bottom: 1px dashed #999; padding: 12px 0; overflow: hidden; }
                        .secao { font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; border: 1px solid #000; display: inline-block; padding: 2px 5px;}
                        .check-box { float: right; width: 25px; height: 25px; border: 2px solid #000; border-radius: 4px; }
                        .cod { font-size: 22px; font-weight: 900; margin: 0; letter-spacing: 1px; }
                        .desc { font-size: 15px; margin: 6px 0 0 0; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>BUSCA NO DEPÓSITO</h2>
                        <p>Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
                        <p>Filial: ${filialCalculada}</p>
                        <p>Itens para Separar: ${itensDeposito.length}</p>
                    </div>
            `;

            itensDeposito.forEach(i => {
                htmlStr += `
                    <div class="item">
                        <div class="check-box"></div>
                        <div class="secao">${i.secao}</div>
                        <p class="cod">${i.cod}</p>
                        <p class="desc">${i.desc}</p>
                    </div>
                `;
            });

            htmlStr += `
                    <div style="text-align: center; margin-top: 30px; font-size: 14px; font-weight: bold;">
                        <p>_______________________</p>
                        <p>Visto Repositor</p>
                    </div>
                    <script>
                        window.onload = function() { window.print(); setTimeout(() => { window.close(); }, 500); }
                    <\/script>
                </body>
                </html>
            `;

            printWindow.document.write(htmlStr);
            printWindow.document.close();
        });
    }
}