/* ==========================================================================
   MEU DINHEIRO — estado.js
   O formato dos dados e todas as funções que MUDAM esses dados.
   Nada aqui mexe na tela: quem desenha são os arquivos tela-*.js.

   Formato guardado:
   {
     v: 4,
     planilhas: [ { id, titulo, linhas: [ { id, nome, tipo: "ent"|"sai" } ] } ],
     celulas:   { "planilhaId|linhaId|AAAA-MM": 1197 },
     saldos:    { "planilhaId|AAAA-MM": 171.48 },
     compras:   [ { id, descricao, categoria, cartao, valorTotal, parcelas, mesInicio } ],
     cats:      [ { nome, tipo: "ent"|"sai", cor } ],
     meta:      500,
     anotacoes: [ { id, texto } ],
     atualizadoEm: 1726700000000
   }

   A PLANILHA é o coração do programa. Cada planilha é uma grade: você
   escreve as linhas (Salário, Aluguel, Faculdade...) e preenche o valor mês
   a mês, inclusive meses futuros — é um plano, não um extrato.

   Vêm duas planilhas de fábrica, uma para cada pagamento do mês, para dar
   para ver separado quanto sobra de cada salário. "celulas" guarda cada
   valor da grade; "saldos" guarda o saldo real do banco, quando você quiser
   conferir.
   ========================================================================== */

MD.Estado = (function () {
    "use strict";

    var CATEGORIAS_PADRAO = [
        { nome: "Moradia",     tipo: "sai", cor: "#6B7FB3" },
        { nome: "Mercado",     tipo: "sai", cor: "#4E9A6B" },
        { nome: "Transporte",  tipo: "sai", cor: "#C99141" },
        { nome: "Saúde",       tipo: "sai", cor: "#B4657A" },
        { nome: "Lazer",       tipo: "sai", cor: "#7D6AA8" },
        { nome: "Assinaturas", tipo: "sai", cor: "#8A7A66" },
        { nome: "Educação",    tipo: "sai", cor: "#3F8E9B" },
        { nome: "Compras",     tipo: "sai", cor: "#A4664A" },
        { nome: "Outros",      tipo: "sai", cor: "#8E8E8E" }
    ];

    var PALETA_EXTRA = [
        "#6B7FB3", "#4E9A6B", "#C99141", "#B4657A",
        "#7D6AA8", "#3F8E9B", "#8A7A66", "#A4664A"
    ];

    /* As linhas que toda planilha nova já traz. É só um ponto de partida:
       dá para renomear, apagar e criar quantas quiser. */
    var LINHAS_PADRAO = [
        { nome: "Salário",    tipo: "ent" },
        { nome: "Moradia",    tipo: "sai" },
        { nome: "Mercado",    tipo: "sai" },
        { nome: "Contas",     tipo: "sai" },
        { nome: "Transporte", tipo: "sai" }
    ];

    var dados = vazio();

    function vazio() {
        return {
            v: 4,
            planilhas: planilhasPadrao(),
            celulas: {},
            saldos: {},
            compras: [],
            cats: CATEGORIAS_PADRAO.slice(),
            meta: 0,
            anotacoes: [],
            atualizadoEm: 0
        };
    }

    /** Duas grades iguais, uma para cada pagamento do mês. */
    function planilhasPadrao() {
        return [
            montarPlanilhaPadrao("Salário do dia 20"),
            montarPlanilhaPadrao("Salário do 5º dia útil")
        ];
    }

    function montarPlanilhaPadrao(titulo) {
        return {
            id: novoId(),
            titulo: titulo,
            linhas: LINHAS_PADRAO.map(function (l) {
                return { id: novoId(), nome: l.nome, tipo: l.tipo };
            })
        };
    }

    /* ----------------------------------------------------------------------
       Normalização — aceita arquivos antigos sem quebrar. Os lançamentos
       saíram do programa: se vierem num backup velho, são ignorados.
       ---------------------------------------------------------------------- */
    function normalizar(bruto) {
        if (!bruto || typeof bruto !== "object") { return vazio(); }

        return {
            v: 4,
            planilhas: (Array.isArray(bruto.planilhas) && bruto.planilhas.length)
                ? bruto.planilhas.map(normalizarPlanilha)
                : planilhasPadrao(),
            celulas: (bruto.celulas && typeof bruto.celulas === "object") ? bruto.celulas : {},
            saldos: (bruto.saldos && typeof bruto.saldos === "object") ? bruto.saldos : {},
            compras: Array.isArray(bruto.compras) ? bruto.compras.map(normalizarCompra) : [],
            cats: (Array.isArray(bruto.cats) && bruto.cats.length)
                ? bruto.cats
                : CATEGORIAS_PADRAO.slice(),
            meta: Number(bruto.meta) || 0,
            anotacoes: Array.isArray(bruto.anotacoes) ? bruto.anotacoes.map(normalizarAnotacao) : [],
            atualizadoEm: Number(bruto.atualizadoEm) || 0
        };
    }

    function normalizarPlanilha(t) {
        return {
            id: t.id || novoId(),
            titulo: t.titulo || "Planilha",
            linhas: Array.isArray(t.linhas) ? t.linhas.map(normalizarLinha) : []
        };
    }

    function normalizarLinha(l) {
        return {
            id: l.id || novoId(),
            nome: l.nome || "",
            tipo: l.tipo === "ent" ? "ent" : "sai"
        };
    }

    function normalizarAnotacao(a) {
        if (typeof a === "string") { return { id: novoId(), texto: a }; }
        return { id: a.id || novoId(), texto: a.texto || "" };
    }

    function normalizarCompra(c) {
        return {
            id: c.id || novoId(),
            descricao: c.descricao || "",
            categoria: c.categoria || "Compras",
            cartao: c.cartao || "",
            valorTotal: Math.abs(Number(c.valorTotal) || 0),
            parcelas: Math.max(1, parseInt(c.parcelas, 10) || 1),
            mesInicio: c.mesInicio || ""
        };
    }

    function novoId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    /* ----------------------------------------------------------------------
       Acesso
       ---------------------------------------------------------------------- */
    function obter() {
        return dados;
    }

    function definir(novos) {
        dados = normalizar(novos);
    }

    function salvar() {
        dados.atualizadoEm = Date.now();
        MD.Armazenamento.salvar(dados);
    }

    function categoria(nome) {
        for (var i = 0; i < dados.cats.length; i++) {
            if (dados.cats[i].nome === nome) { return dados.cats[i]; }
        }
        return { nome: nome || "Outros", tipo: "sai", cor: "#8E8E8E" };
    }

    function categoriasDeSaida() {
        return dados.cats.filter(function (c) { return c.tipo === "sai"; });
    }

    function cartoesConhecidos() {
        var vistos = [];
        dados.compras.forEach(function (c) {
            if (c.cartao && vistos.indexOf(c.cartao) === -1) { vistos.push(c.cartao); }
        });
        return vistos;
    }

    /* ----------------------------------------------------------------------
       Mutações — planilha (a grade principal)
       ---------------------------------------------------------------------- */
    function chaveCelula(planilhaId, linhaId, mesChave) {
        return planilhaId + "|" + linhaId + "|" + mesChave;
    }

    function chaveSaldo(planilhaId, mesChave) {
        return planilhaId + "|" + mesChave;
    }

    /** Planilha nova já nasce com as linhas padrão — é quase sempre o que
     *  se quer ao criar a segunda, a terceira, etc. */
    function planilhaCriar(titulo) {
        var nova = montarPlanilhaPadrao(titulo || "Nova planilha");
        dados.planilhas.push(nova);
        salvar();
        return nova;
    }

    function planilhaApagar(planilhaId) {
        dados.planilhas = dados.planilhas.filter(function (t) { return t.id !== planilhaId; });

        Object.keys(dados.celulas).forEach(function (chave) {
            if (chave.indexOf(planilhaId + "|") === 0) { delete dados.celulas[chave]; }
        });
        Object.keys(dados.saldos).forEach(function (chave) {
            if (chave.indexOf(planilhaId + "|") === 0) { delete dados.saldos[chave]; }
        });
        salvar();
    }

    function planilhaRenomear(planilhaId, titulo) {
        var planilha = planilhaObter(planilhaId);
        if (planilha) { planilha.titulo = titulo; salvar(); }
    }

    function planilhaObter(planilhaId) {
        for (var i = 0; i < dados.planilhas.length; i++) {
            if (dados.planilhas[i].id === planilhaId) { return dados.planilhas[i]; }
        }
        return null;
    }

    /** Copia só os nomes das linhas de uma planilha para outra — serve para
     *  deixar as duas grades com a mesma cara sem redigitar tudo. */
    function planilhaCopiarLinhas(deId, paraId) {
        var origem = planilhaObter(deId);
        var destino = planilhaObter(paraId);
        if (!origem || !destino) { return 0; }

        var jaTem = destino.linhas.map(function (l) {
            return (l.nome || "").toLowerCase();
        });
        var copiadas = 0;

        origem.linhas.forEach(function (l) {
            if (jaTem.indexOf((l.nome || "").toLowerCase()) > -1) { return; }
            destino.linhas.push({ id: novoId(), nome: l.nome, tipo: l.tipo });
            copiadas++;
        });

        if (copiadas) { salvar(); }
        return copiadas;
    }

    function linhaCriar(planilhaId, nome, tipo) {
        var planilha = planilhaObter(planilhaId);
        if (!planilha) { return null; }

        var linha = { id: novoId(), nome: nome || "", tipo: tipo === "ent" ? "ent" : "sai" };
        planilha.linhas.push(linha);
        salvar();
        return linha;
    }

    function linhaApagar(planilhaId, linhaId) {
        var planilha = planilhaObter(planilhaId);
        if (!planilha) { return; }

        planilha.linhas = planilha.linhas.filter(function (l) { return l.id !== linhaId; });
        Object.keys(dados.celulas).forEach(function (chave) {
            if (chave.indexOf(planilhaId + "|" + linhaId + "|") === 0) { delete dados.celulas[chave]; }
        });
        salvar();
    }

    function linhaRenomear(planilhaId, linhaId, nome) {
        var linha = linhaObter(planilhaId, linhaId);
        if (linha) { linha.nome = nome; salvar(); }
    }

    function linhaAlternarTipo(planilhaId, linhaId) {
        var linha = linhaObter(planilhaId, linhaId);
        if (linha) { linha.tipo = (linha.tipo === "ent") ? "sai" : "ent"; salvar(); }
    }

    function linhaObter(planilhaId, linhaId) {
        var planilha = planilhaObter(planilhaId);
        if (!planilha) { return null; }
        return planilha.linhas.filter(function (l) { return l.id === linhaId; })[0] || null;
    }

    function celula(planilhaId, linhaId, mesChave) {
        return dados.celulas[chaveCelula(planilhaId, linhaId, mesChave)] || 0;
    }

    function celulaDefinir(planilhaId, linhaId, mesChave, valor) {
        var chave = chaveCelula(planilhaId, linhaId, mesChave);
        if (valor) { dados.celulas[chave] = valor; } else { delete dados.celulas[chave]; }
        salvar();
    }

    /** Repete o valor de um mês nos meses seguintes do mesmo ano.
     *  Aluguel, internet, faculdade: digita uma vez e puxa para o ano todo. */
    function linhaRepetirNoAno(planilhaId, linhaId, mesChave) {
        var valor = celula(planilhaId, linhaId, mesChave);
        var ano = mesChave.slice(0, 4);
        var mes = parseInt(mesChave.slice(5, 7), 10);
        var mudou = 0;

        for (var m = mes + 1; m <= 12; m++) {
            var alvo = ano + "-" + String(m).padStart(2, "0");
            var chave = chaveCelula(planilhaId, linhaId, alvo);
            if (valor) { dados.celulas[chave] = valor; } else { delete dados.celulas[chave]; }
            mudou++;
        }

        if (mudou) { salvar(); }
        return mudou;
    }

    /** Repete o mês inteiro (todas as linhas) nos meses seguintes do ano.
     *  Preenche janeiro uma vez e o ano fica montado. */
    function planilhaRepetirMesNoAno(planilhaId, mesChave) {
        var planilha = planilhaObter(planilhaId);
        if (!planilha) { return 0; }

        planilha.linhas.forEach(function (linha) {
            linhaRepetirNoAno(planilhaId, linha.id, mesChave);
        });

        return planilha.linhas.length;
    }

    function saldoManual(planilhaId, mesChave) {
        var chave = chaveSaldo(planilhaId, mesChave);
        return Object.prototype.hasOwnProperty.call(dados.saldos, chave) ? dados.saldos[chave] : null;
    }

    function saldoDefinir(planilhaId, mesChave, valor) {
        var chave = chaveSaldo(planilhaId, mesChave);
        if (valor !== null && valor !== "") {
            dados.saldos[chave] = (typeof valor === "number") ? valor : MD.Calculos.lerValor(valor);
        } else {
            delete dados.saldos[chave];
        }
        salvar();
    }

    /* ----------------------------------------------------------------------
       Mutações — compras parceladas, categorias, meta e anotações
       ---------------------------------------------------------------------- */
    function criarCompra(compra) {
        var nova = normalizarCompra(compra);
        nova.id = novoId();
        dados.compras.push(nova);
        salvar();
        return nova;
    }

    function apagarCompra(id) {
        dados.compras = dados.compras.filter(function (c) { return c.id !== id; });
        salvar();
    }

    function criarCategoria(nome, tipo) {
        nome = String(nome || "").trim();
        if (!nome) { return false; }

        var repetida = dados.cats.some(function (c) {
            return c.nome.toLowerCase() === nome.toLowerCase();
        });
        if (repetida) { return false; }

        dados.cats.push({
            nome: nome,
            tipo: tipo === "ent" ? "ent" : "sai",
            cor: PALETA_EXTRA[dados.cats.length % PALETA_EXTRA.length]
        });
        salvar();
        return true;
    }

    function definirMeta(valor) {
        dados.meta = valor;
        salvar();
    }

    function anotacaoCriar(texto) {
        texto = String(texto || "").trim();
        if (!texto) { return null; }
        var nota = { id: novoId(), texto: texto };
        dados.anotacoes.push(nota);
        salvar();
        return nota;
    }

    function anotacaoApagar(id) {
        dados.anotacoes = dados.anotacoes.filter(function (a) { return a.id !== id; });
        salvar();
    }

    return {
        CATEGORIAS_PADRAO: CATEGORIAS_PADRAO,
        vazio: vazio,
        normalizar: normalizar,
        novoId: novoId,

        obter: obter,
        definir: definir,
        salvar: salvar,

        categoria: categoria,
        categoriasDeSaida: categoriasDeSaida,
        cartoesConhecidos: cartoesConhecidos,

        planilhaCriar: planilhaCriar,
        planilhaApagar: planilhaApagar,
        planilhaRenomear: planilhaRenomear,
        planilhaObter: planilhaObter,
        planilhaCopiarLinhas: planilhaCopiarLinhas,

        linhaCriar: linhaCriar,
        linhaApagar: linhaApagar,
        linhaRenomear: linhaRenomear,
        linhaAlternarTipo: linhaAlternarTipo,
        linhaRepetirNoAno: linhaRepetirNoAno,
        planilhaRepetirMesNoAno: planilhaRepetirMesNoAno,

        celula: celula,
        celulaDefinir: celulaDefinir,
        saldoManual: saldoManual,
        saldoDefinir: saldoDefinir,

        criarCompra: criarCompra,
        apagarCompra: apagarCompra,
        criarCategoria: criarCategoria,
        definirMeta: definirMeta,
        anotacaoCriar: anotacaoCriar,
        anotacaoApagar: anotacaoApagar
    };
}());
