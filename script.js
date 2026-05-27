// =========================================================================
// 1. CONFIGURAÇÕES DA API (ADEUS FIREBASE!)
// =========================================================================

// ⚠️ COLE AQUI A URL DO SEU APP DA WEB DO GOOGLE SHEETS ⚠️
const API_URL = "https://script.google.com/macros/s/AKfycbwKhNBDsJ8PcTi43mqqFLneRX1yvvjKKiORs2vY89k9ulJSTUDfegF3bFEigHhQddjunQ/exec"; 

const paginaAtual = window.location.pathname;

let chartEvoInstance = null;
let chartLojaInstance = null;

// ==========================================
// 2. MONITOR DE SESSÃO LOCAL
// ==========================================
function verificarSessao() {
    // Puxa quem está logado diretamente da memória do navegador
    const usuarioLogado = localStorage.getItem('usuarioRuptura');
    const isLogin = paginaAtual.includes('index.html') || paginaAtual === '/' || paginaAtual.endsWith('/');

    if (usuarioLogado) {
        if (isLogin) {
            window.location.href = 'home.html';
        } else {
            configurarInterface(usuarioLogado);
            if (paginaAtual.includes('incluir.html')) carregarOpcoesInclusao();
            if (paginaAtual.includes('dashboard.html')) carregarDashboard(usuarioLogado);
            if (paginaAtual.includes('historico.html')) carregarHistorico(usuarioLogado);
            if (paginaAtual.includes('usuarios.html')) carregarGerenciamentoUsuarios(usuarioLogado);
        }
    } else {
        if (!isLogin) window.location.href = 'index.html';
    }
}

// Executa a verificação assim que a página carrega
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
// 3. LOGIN E LOGOUT DIRETOS NA PLANILHA
// ==========================================
const formLogin = document.getElementById('formLogin');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ident = document.getElementById('emailInput').value.trim().toLowerCase();
        const btn = document.getElementById('btnEntrar');
        btn.innerText = "Verificando permissão...";
        
        try {
            // Busca a lista de usuários na aba "Usuarios" da planilha
            const res = await fetch(API_URL + "?action=usuarios");
            const usuarios = await res.json();
            
            let usuarioValido = false;
            
            // O acesso 'regional' é fixo. Outras lojas devem estar na planilha.
            if (ident === 'regional') {
                usuarioValido = true;
            } else {
                usuarioValido = usuarios.some(u => String(u.identificador).toLowerCase() === ident);
            }

            if (usuarioValido) {
                // Salva a sessão na memória do navegador e entra
                localStorage.setItem('usuarioRuptura', ident);
                window.location.href = 'home.html';
            } else {
                document.getElementById('msgErroLogin').classList.remove('hidden');
                document.getElementById('msgErroLogin').innerHTML = '<span class="material-icons-round">error_outline</span> Usuário não cadastrado.';
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
// 4. INCLUIR RUPTURA (GRAVANDO NO SHEETS)
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
        
        const identLogado = localStorage.getItem('usuarioRuptura');
        const filialCalculada = identLogado.toUpperCase().replace('H', 'H-');

        const qtdR = parseInt(document.getElementById('qtdRuptura').value);
        const qtdD = parseInt(document.getElementById('qtdDeposito').value);
        const perc = qtdR > 0 ? parseFloat(((qtdD / qtdR) * 100).toFixed(2)) : 0;
        
        try {
            const registro = {
                tipo: "auditoria",
                data: document.getElementById('dataAuditoria').value,
                filial: filialCalculada,
                departamento: document.getElementById('departamento').value,
                secao: document.getElementById('secao').value,
                qtdRuptura: qtdR,
                qtdLoja: parseInt(document.getElementById('qtdLoja').value),
                qtdDeposito: qtdD,
                qtdSujeira: parseInt(document.getElementById('qtdSujeira').value),
                indicadorLogistico: perc,
                registradoPor: identLogado
            };

            const resposta = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(registro)
            });

            const resultado = await resposta.json();
            
            if(resultado.status === "sucesso") {
                document.getElementById('msgSucesso').classList.remove('hidden');
                setTimeout(() => document.getElementById('msgSucesso').classList.add('hidden'), 3000);
                e.target.reset();
                document.getElementById('dataAuditoria').valueAsDate = new Date();
                document.getElementById('secao').disabled = true;
                document.getElementById('secao').style.backgroundColor = '#e2e8f0';
            } else {
                alert("Erro ao salvar.");
            }
        } catch (err) { alert("Erro de conexão ao salvar."); }
        finally { btn.innerText = "Salvar Auditoria"; }
    });
}

// ==========================================
// 5. DASHBOARD EXECUTIVO
// ==========================================
// ==========================================
// 5. DASHBOARD EXECUTIVO
// ==========================================
async function carregarDashboard(ident) {
    const isReg = ident === 'regional';
    const lojaBase = ident.toUpperCase().replace('H', 'H-');
    
    // Captura os novos campos
    const tipoPeriodo = document.getElementById('dashTipoPeriodo');
    const dataInput = document.getElementById('dashData');
    const labelData = document.getElementById('labelData');
    const filialInput = document.getElementById('dashFilial');
    const containerFilial = document.getElementById('containerDashFilial');
    
    // Define Mês por padrão ao abrir a tela
    dataInput.value = new Date().toISOString().slice(0, 7);

    // Lógica para trocar a caixinha entre "Mês" e "Dia"
    tipoPeriodo.addEventListener('change', (e) => {
        if (e.target.value === 'dia') {
            dataInput.type = 'date';
            labelData.innerText = 'Selecione o Dia';
            dataInput.value = new Date().toISOString().slice(0, 10); // Seta dia de hoje
        } else {
            dataInput.type = 'month';
            labelData.innerText = 'Selecione o Mês';
            dataInput.value = new Date().toISOString().slice(0, 7); // Seta mês atual
        }
        processarDados(); // Recalcula os gráficos na hora
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
        } catch (e) { console.error("Erro ao carregar lojas da planilha", e); }
    } else {
        containerFilial.style.display = 'none';
        filialInput.value = lojaBase;
    }

    let cacheDadosBrutos = null; 

    async function processarDados() {
        // 'm' agora pode ser "2026-05" (Mês) ou "2026-05-18" (Dia)
        const m = dataInput.value; 
        const f = isReg ? filialInput.value : lojaBase;
        
        if (!cacheDadosBrutos) {
            document.getElementById('kpiOfensor').innerText = "Baixando da planilha...";
            try {
                const res = await fetch(API_URL);
                cacheDadosBrutos = await res.json();
            } catch (error) {
                console.error("Erro ao ler da planilha.");
                return;
            }
        }

        let stats = { tr: 0, td: 0, deptos: {}, lojas: {}, evolucao: {} };

        cacheDadosBrutos.forEach(v => {
            let dataLida = String(v.data).split("T")[0]; 

            // O startsWith faz a mágica: Ele compara "2026-05" com "2026-05-18" (verdadeiro)
            // Ou compara "2026-05-18" com "2026-05-18" (verdadeiro apenas pro dia exato)
            if ((!m || dataLida.startsWith(m)) && (!f || v.filial === f)) {
                let qR = Number(v.qtdRuptura) || 0;
                let qD = Number(v.qtdDeposito) || 0;

                stats.tr += qR;
                stats.td += qD;

                const d = v.departamento || 'Outros';
                if (!stats.deptos[d]) stats.deptos[d] = { r: 0, d: 0 };
                stats.deptos[d].r += qR;
                stats.deptos[d].d += qD;

                if (!stats.lojas[v.filial]) stats.lojas[v.filial] = { r: 0, d: 0 };
                stats.lojas[v.filial].r += qR;
                stats.lojas[v.filial].d += qD;

                // Para o gráfico de evolução, sempre agrupamos pelo DIA (Mesmo se estiver vendo o mês)
                if (!stats.evolucao[dataLida]) stats.evolucao[dataLida] = { r: 0, d: 0 };
                stats.evolucao[dataLida].r += qR;
                stats.evolucao[dataLida].d += qD;
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

        // NOVO CÁLCULO: Loja Destaque (Busca a Menor Ruptura)
        const melhorLj = Object.keys(s.lojas).length > 0 ? Object.keys(s.lojas).reduce((a, b) => (s.lojas[a].d / s.lojas[a].r) < (s.lojas[b].d / s.lojas[b].r) ? a : b) : "---";
        const elMelhorLoja = document.getElementById('kpiMelhorLoja');
        if (elMelhorLoja) {
            elMelhorLoja.innerText = isReg && !filtroAtivo ? melhorLj : (filtroAtivo || "---");
        }

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

    // Escutadores de eventos para recalcular quando os filtros mudam
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
        } catch (e) { console.error("Erro ao carregar lojas", e); }
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
        corpo.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px;">Lendo dados...</td></tr>`;

        try {
            const res = await fetch(API_URL);
            const dadosPlanilha = await res.json();
            
            const m = mesInput.value;
            const dpto = document.getElementById('filtroDepartamento').value;
            const s = document.getElementById('filtroSecao').value;
            const f = isReg ? filialInput.value : loja;
            
            corpo.innerHTML = '';
            
            // 1. FILTRAGEM: Aplica os filtros selecionados na tela
            let dadosFiltrados = dadosPlanilha.filter(v => {
                let dataLida = String(v.data).split("T")[0];
                return ((!m || dataLida.startsWith(m)) && (!dpto || v.departamento === dpto) && (!s || v.secao === s) && (!f || v.filial === f));
            });

            // 2. ORDENAÇÃO: Organiza por data de forma decrescente (Mais recentes primeiro)
            dadosFiltrados.sort((a, b) => {
                let dataA = String(a.data).split("T")[0];
                let dataB = String(b.data).split("T")[0];
                return dataB.localeCompare(dataA);
            });

            // 3. LIMITAÇÃO: Extrai apenas os primeiros 500 registros ordenados
            let dadosLimitados = dadosFiltrados.slice(0, 500);
            
            if (dadosLimitados.length === 0) {
                corpo.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: var(--text-muted);">Nenhum lançamento encontrado.</td></tr>`;
                return;
            }

            // 4. RENDERIZAÇÃO: Desenha as linhas na tabela
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

            // 5. AVISO DE CORTE: Alerta o usuário caso existam mais registros ocultos
            if (dadosFiltrados.length > 500) {
                corpo.innerHTML += `<tr>
                    <td colspan="6" class="text-center" style="padding: 15px; background: #f8fafc; color: var(--text-muted); font-size: 0.85rem; font-weight: 600;">
                        ⚠️ Exibindo os 500 lançamentos mais recentes de um total de ${dadosFiltrados.length}. Use os filtros acima para refinar a busca.
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
        corpo.innerHTML = '<tr><td colspan="3" class="text-center">Lendo...</td></tr>';
        
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
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const novoIdent = document.getElementById('emailNovoUser').value.trim().toLowerCase();
        const nivel = document.getElementById('nivelAcesso').value;
        const btn = document.getElementById('btnCriarUser');
        btn.innerText = "Autorizando...";
        
        try {
            const registroUser = {
                tipo: "usuario",
                identificador: novoIdent,
                permissao: nivel
            };
            
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(registroUser)
            });
            
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
    
    listar();
}