
const hoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dataBR = data => {
    if (!data) return "—";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
};

const escapar = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
}[c]));

const ler = chave => {
    try {
        return JSON.parse(localStorage.getItem(chave)) || [];
    } catch {
        return [];
    }
};

let maquinas = ler("industrial_maquinas");
let ordens = ler("industrial_ordens");
let proximoId = Math.max(0, ...maquinas.map(m => Number(m.id) || 0)) + 1;
let proximaOrdem = Math.max(0, ...ordens.map(o => Number(o.id) || 0)) + 1;

function salvar() {
    localStorage.setItem("industrial_maquinas", JSON.stringify(maquinas));
    localStorage.setItem("industrial_ordens", JSON.stringify(ordens));
    atualizar();
}

function abrirModalMaquina() {
    document.getElementById("formMaquina").reset();
    document.getElementById("modalMaquina").classList.add("open");
}

function abrirModalManutencao() {
    if (maquinas.length === 0) {
        alert("Cadastre uma máquina antes de criar uma ordem.");
        return;
    }

    document.getElementById("formManutencao").reset();
    document.getElementById("modalManutencao").classList.add("open");
}

function fecharModal(id) {
    document.getElementById(id).classList.remove("open");
}

function classeStatus(status) {
    return ({
        "Operacional": "status-operacional",
        "Em manutenção": "status-em-manutencao",
        "Parada": "status-parada",
        "Pendente": "status-pendente",
        "Concluída": "status-concluida",
        "Atrasada": "status-atrasada"
    })[status] || "status-pendente";
}

function etiqueta(status) {
    return `<span class="status ${classeStatus(status)}">${escapar(status)}</span>`;
}

document.getElementById("formMaquina").addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const patrimonio = f.get("patrimonio").trim();

    if (maquinas.some(m => m.patrimonio.toLowerCase() === patrimonio.toLowerCase())) {
        alert("Já existe uma máquina com esse patrimônio.");
        return;
    }

    maquinas.push({
        id: proximoId++,
        nome: f.get("nome").trim(),
        patrimonio,
        setor: f.get("setor").trim(),
        status: f.get("status"),
        ultima: f.get("ultima"),
        proxima: f.get("proxima")
    });

    salvar();
    fecharModal("modalMaquina");
    e.target.reset();
});

document.getElementById("formManutencao").addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const maquinaId = Number(f.get("maquina"));
    const maquina = maquinas.find(m => m.id === maquinaId);

    if (!maquina) {
        alert("Selecione uma máquina válida.");
        return;
    }

    ordens.push({
        id: proximaOrdem++,
        maquinaId,
        tipo: f.get("tipo"),
        tecnico: f.get("tecnico").trim(),
        data: f.get("data"),
        descricao: f.get("descricao").trim(),
        status: "Pendente"
    });

    if (f.get("tipo") === "Corretiva") {
        maquina.status = "Em manutenção";
    }

    salvar();
    fecharModal("modalManutencao");
    e.target.reset();
});

function excluirMaquina(id) {
    const possuiOrdens = ordens.some(o => o.maquinaId === id);

    if (possuiOrdens) {
        alert("Esta máquina possui ordens registradas e não pode ser excluída.");
        return;
    }

    if (!confirm("Deseja excluir esta máquina?")) return;

    maquinas = maquinas.filter(m => m.id !== id);
    salvar();
}

function concluirOrdem(id) {
    const ordem = ordens.find(o => o.id === id);
    if (!ordem || ordem.status === "Concluída") return;

    if (!confirm("Confirmar a conclusão desta ordem de serviço?")) return;

    ordem.status = "Concluída";

    const maquina = maquinas.find(m => m.id === ordem.maquinaId);

    if (maquina) {
        maquina.ultima = ordem.data || hoje();

        if (ordem.tipo === "Preventiva" || ordem.tipo === "Preditiva") {
            const dataBase = new Date(`${ordem.data || hoje()}T12:00:00`);
            dataBase.setDate(dataBase.getDate() + 30);
            maquina.proxima = [
                dataBase.getFullYear(),
                String(dataBase.getMonth() + 1).padStart(2, "0"),
                String(dataBase.getDate()).padStart(2, "0")
            ].join("-");
        }

        const outraPendente = ordens.some(o =>
            o.id !== id &&
            o.maquinaId === maquina.id &&
            o.status === "Pendente"
        );

        if (!outraPendente) {
            maquina.status = "Operacional";
        }
    }

    salvar();
}

function atualizar() {
    document.getElementById("dataAtual").textContent =
        new Date().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

    document.getElementById("totalMaquinas").textContent = maquinas.length;
    document.getElementById("emOperacao").textContent =
        maquinas.filter(m => m.status === "Operacional").length;
    document.getElementById("emManutencao").textContent =
        maquinas.filter(m => m.status === "Em manutenção").length;

    const pendentes = maquinas.filter(m =>
        m.proxima && m.proxima <= hoje() &&
        m.status !== "Em manutenção"
    ).length;

    document.getElementById("pendentes").textContent = pendentes;

    const busca = document.getElementById("buscaMaquina").value.toLowerCase();
    const filtro = document.getElementById("filtroStatus").value;

    const filtradas = maquinas.filter(m => {
        const correspondeBusca =
            m.nome.toLowerCase().includes(busca) ||
            m.patrimonio.toLowerCase().includes(busca) ||
            m.setor.toLowerCase().includes(busca);

        return correspondeBusca && (!filtro || m.status === filtro);
    });

    document.getElementById("listaMaquinas").innerHTML =
        filtradas.length ? filtradas.map(m => `
            <tr>
                <td class="patrimonio">${escapar(m.patrimonio)}</td>
                <td><strong>${escapar(m.nome)}</strong></td>
                <td>${escapar(m.setor)}</td>
                <td>${dataBR(m.ultima)}</td>
                <td>${dataBR(m.proxima)}</td>
                <td>${etiqueta(m.status)}</td>
                <td>
                    <button class="action-btn"
                        onclick="alterarStatus(${m.id})">Status</button>
                    <button class="action-btn"
                        onclick="excluirMaquina(${m.id})">Excluir</button>
                </td>
            </tr>
        `).join("") : `
            <tr><td colspan="7" class="empty">Nenhuma máquina encontrada.</td></tr>
        `;

    document.getElementById("selectMaquina").innerHTML = maquinas.map(m => `
        <option value="${m.id}">
            ${escapar(m.patrimonio)} - ${escapar(m.nome)}
        </option>
    `).join("");

    document.getElementById("listaManutencoes").innerHTML =
        ordens.length ? [...ordens].reverse().map(o => {
            const maquina = maquinas.find(m => m.id === o.maquinaId);
            return `
                <tr>
                    <td>OS-${String(o.id).padStart(4, "0")}</td>
                    <td>${escapar(maquina?.nome || "Máquina removida")}</td>
                    <td>${escapar(o.tipo)}</td>
                    <td>${escapar(o.tecnico)}</td>
                    <td>${dataBR(o.data)}</td>
                    <td>${etiqueta(o.status)}</td>
                    <td>
                        ${o.status === "Pendente"
                            ? `<button class="action-btn"
                                onclick="concluirOrdem(${o.id})">Concluir</button>`
                            : "—"}
                    </td>
                </tr>
            `;
        }).join("") : `
            <tr><td colspan="7" class="empty">Nenhuma ordem registrada.</td></tr>
        `;

    const preventivas = maquinas
        .filter(m => m.proxima)
        .sort((a, b) => a.proxima.localeCompare(b.proxima));

    document.getElementById("listaPreventivas").innerHTML =
        preventivas.length ? preventivas.map(m => {
            const atrasada = m.proxima < hoje();
            const venceHoje = m.proxima === hoje();
            const texto = atrasada ? "Atrasada" : venceHoje ? "Vence hoje" : "Programada";
            const status = atrasada ? "Atrasada" : "Pendente";

            return `
                <div class="preventive-item">
                    <div>
                        <strong>${escapar(m.nome)} — ${escapar(m.patrimonio)}</strong>
                        <p>${escapar(m.setor)} · Data: ${dataBR(m.proxima)}</p>
                    </div>
                    ${etiqueta(texto === "Programada" ? status : texto)}
                </div>
            `;
        }).join("") : `<p class="empty">Nenhuma preventiva programada.</p>`;

    const concluidas = [...ordens]
        .filter(o => o.status === "Concluída")
        .reverse();

    document.getElementById("listaHistorico").innerHTML =
        concluidas.length ? concluidas.map(o => {
            const maquina = maquinas.find(m => m.id === o.maquinaId);
            return `
                <div class="history-item">
                    <strong>OS-${String(o.id).padStart(4, "0")} ·
                        ${escapar(maquina?.nome || "Máquina removida")}</strong>
                    <p>${escapar(o.tipo)} · Técnico: ${escapar(o.tecnico)}
                        · ${dataBR(o.data)}</p>
                    <p>${escapar(o.descricao)}</p>
                </div>
            `;
        }).join("") : `<p class="empty">Nenhum serviço concluído ainda.</p>`;
}

function alterarStatus(id) {
    const maquina = maquinas.find(m => m.id === id);
    if (!maquina) return;

    const opcoes = ["Operacional", "Em manutenção", "Parada"];
    const atual = opcoes.indexOf(maquina.status);
    maquina.status = opcoes[(atual + 1) % opcoes.length];
    salvar();
}

document.getElementById("buscaMaquina").addEventListener("input", atualizar);
document.getElementById("filtroStatus").addEventListener("change", atualizar);

atualizar();
