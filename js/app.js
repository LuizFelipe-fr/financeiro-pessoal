/* ==========================================================================
   MEU DINHEIRO — app.js
   Junta tudo: carrega os dados, liga os botões, troca de aba e cuida de
   backup, tema e navegação por mês. É o único arquivo que conhece os outros.

   O topo da página mostra o resultado da planilha: quanto sobra no mês
   escolhido, somando todas as grades e descontando as parcelas do cartão.
   ========================================================================== */

MD.app = (function () {
    "use strict";

    var C = MD.Calculos;
    var E = MD.Estado;

    var mesEscolhido = C.mesAtual();
    var telaAtiva = "planilha";

    function $(seletor) {
        return document.querySelector(seletor);
    }

    /* ======================================================================
       Topo — o resultado do mês
       ====================================================================== */
    function atualizarTopo() {
        var r = C.resumoDoMes(mesEscolhido);

        $("#totalEntradas").textContent = C.moeda(r.entradas);
        $("#totalSaidas").textContent = C.moeda(r.saidas);

        var saldo = $("#saldoValor");
        if (saldo.textContent !== C.moeda(r.sobra)) {
            saldo.classList.remove("pisca");
            void saldo.offsetWidth;
            saldo.classList.add("pisca");
        }
        saldo.textContent = C.moeda(r.sobra);
        saldo.classList.toggle("neg", r.sobra < 0);
        $("#saldoRotulo").textContent = r.sobra < 0
            ? "Falta em " + C.nomeDoMes(mesEscolhido)
            : "Sobra em " + C.nomeDoMes(mesEscolhido);

        var base = Math.max(r.entradas, r.saidas, 1);
        $("#barraGasto").style.width = Math.min(100, (r.saidas / base) * 100) + "%";
        $("#barraSobra").style.width =
            (r.entradas > r.saidas ? ((r.entradas - r.saidas) / base) * 100 : 0) + "%";

        var esquerda = $("#legendaEsquerda");
        var direita = $("#legendaDireita");

        if (!r.preenchido) {
            esquerda.textContent = "Preencha a planilha abaixo para o número aparecer";
        } else if (r.entradas === 0) {
            esquerda.textContent = "Nenhuma entrada neste mês";
        } else {
            esquerda.textContent = "Você já comprometeu " +
                Math.round((r.saidas / r.entradas) * 100) + "% do que entrou";
        }

        direita.textContent = r.parcelas > 0
            ? "inclui " + C.moeda(r.parcelas) + " de parcelas do cartão"
            : "";
    }

    /* ======================================================================
       Desenho geral
       ====================================================================== */
    function redesenhar() {
        $("#rotuloMes").textContent = C.nomeDoMes(mesEscolhido);

        atualizarTopo();
        MD.TelaPlanilha.desenhar(mesEscolhido);
        MD.TelaCartoes.desenhar(mesEscolhido);
        MD.TelaPlanejar.desenhar(mesEscolhido);
    }

    function trocarTela(nome) {
        telaAtiva = nome;

        document.querySelectorAll(".aba").forEach(function (aba) {
            aba.setAttribute("aria-selected", aba.dataset.tela === nome ? "true" : "false");
        });
        document.querySelectorAll(".tela").forEach(function (tela) {
            var ativa = tela.id === "tela-" + nome;
            tela.classList.toggle("oculta", !ativa);
            if (ativa) {
                tela.classList.remove("tela-entra");
                void tela.offsetWidth;
                tela.classList.add("tela-entra");
            }
        });
    }

    function atualizarStatus() {
        $("#statusArmazenamento").textContent = MD.Armazenamento.descricaoDoModo();
    }

    function avisar(texto) {
        var caixa = document.createElement("div");
        caixa.className = "aviso";
        caixa.textContent = texto;
        document.body.appendChild(caixa);

        setTimeout(function () {
            caixa.classList.add("aviso-sai");
            caixa.addEventListener("animationend", function () { caixa.remove(); });
        }, 2600);
    }

    function irParaMes(deslocamento) {
        mesEscolhido = C.mesDeslocado(mesEscolhido, deslocamento);
        redesenhar();
    }

    function irParaAno(deslocamento) {
        mesEscolhido = C.mesDeslocado(mesEscolhido, deslocamento * 12);
        redesenhar();
    }

    /* ======================================================================
       Backup: exportar e importar
       ====================================================================== */
    function baixarArquivo(nome, conteudo, tipo) {
        var blob = new Blob([conteudo], { type: tipo });
        var url = URL.createObjectURL(blob);

        var link = document.createElement("a");
        link.href = url;
        link.download = nome;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function exportarJson() {
        baixarArquivo(
            "meu-dinheiro-backup.json",
            JSON.stringify(E.obter(), null, 2),
            "application/json"
        );
    }

    /** Exporta as grades do ano que está na tela, do jeito que aparecem. */
    function exportarCsv() {
        var ano = parseInt(mesEscolhido.slice(0, 4), 10);
        var meses = C.mesesDoAno(ano);
        var linhas = [];

        var cabecalho = ["Planilha", "Linha", "Tipo"]
            .concat(meses.map(function (mk) { return C.mesCurto(mk); }))
            .concat(["Ano"]);
        linhas.push(cabecalho);

        E.obter().planilhas.forEach(function (planilha) {
            planilha.linhas.forEach(function (linha) {
                var valores = meses.map(function (mk) {
                    return formatarCsv(E.celula(planilha.id, linha.id, mk));
                });
                linhas.push([
                    planilha.titulo,
                    linha.nome,
                    linha.tipo === "ent" ? "Entrada" : "Gasto"
                ].concat(valores).concat([
                    formatarCsv(C.totalDaLinhaNoAno(planilha, linha, ano))
                ]));
            });

            var totais = meses.map(function (mk) {
                return formatarCsv(C.sobraDaPlanilha(planilha, mk));
            });
            var somaAno = meses.reduce(function (s, mk) {
                return s + C.sobraDaPlanilha(planilha, mk);
            }, 0);
            linhas.push([planilha.titulo, "Sobra", ""].concat(totais).concat([formatarCsv(somaAno)]));
        });

        var parcelas = meses.map(function (mk) { return formatarCsv(C.totalDeParcelas(mk)); });
        var somaParcelas = meses.reduce(function (s, mk) { return s + C.totalDeParcelas(mk); }, 0);
        linhas.push(["Cartão", "Parcelas", "Gasto"].concat(parcelas).concat([formatarCsv(somaParcelas)]));

        var sobras = meses.map(function (mk) { return formatarCsv(C.resumoDoMes(mk).sobra); });
        var somaSobras = meses.reduce(function (s, mk) { return s + C.resumoDoMes(mk).sobra; }, 0);
        linhas.push(["Total", "Sobra do mês", ""].concat(sobras).concat([formatarCsv(somaSobras)]));

        var csv = "\uFEFF" + linhas.map(function (linha) {
            return linha.map(function (celula) {
                return '"' + String(celula).replace(/"/g, '""') + '"';
            }).join(";");
        }).join("\n");

        baixarArquivo("meu-dinheiro-" + ano + ".csv", csv, "text/csv;charset=utf-8");
    }

    function formatarCsv(valor) {
        return valor ? String(Math.round(valor * 100) / 100).replace(".", ",") : "";
    }

    function importarArquivo(arquivo) {
        var leitor = new FileReader();

        leitor.onload = function () {
            try {
                var dados = JSON.parse(leitor.result);
                if (!dados || typeof dados !== "object") { throw new Error("formato"); }

                MD.UI.perguntar({
                    titulo: "Restaurar este backup?",
                    texto: "Tudo que está no site agora — planilhas, valores, compras e " +
                           "anotações — é substituído pelo conteúdo do arquivo.",
                    textoOk: "Restaurar",
                    aoConfirmar: function () {
                        E.definir(dados);
                        E.salvar();
                        redesenhar();
                        avisar("Backup restaurado.");
                    }
                });
            } catch (erro) {
                avisar("Arquivo inválido. Use um backup .json gerado aqui.");
            }
        };

        leitor.readAsText(arquivo);
    }

    /* ======================================================================
       Tema
       ====================================================================== */
    var TEMAS = ["auto", "light", "dark"];
    var indiceTema = 0;

    function carregarTema() {
        try {
            var salvo = localStorage.getItem("meu-dinheiro-tema");
            if (salvo) { indiceTema = Math.max(0, TEMAS.indexOf(salvo)); }
        } catch (erro) { /* sem problema */ }
        aplicarTema();
    }

    function aplicarTema() {
        var tema = TEMAS[indiceTema];

        if (tema === "auto") {
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", tema);
        }

        $("#botaoTema").textContent = tema === "auto" ? "◐" : (tema === "light" ? "☀" : "☾");

        try { localStorage.setItem("meu-dinheiro-tema", tema); } catch (erro) { /* idem */ }
    }

    /* ======================================================================
       Ligação dos eventos
       ====================================================================== */
    function ligarEventos() {
        /* --- navegação por mês e ano --- */
        $("#mesAnterior").addEventListener("click", function () { irParaMes(-1); });
        $("#mesSeguinte").addEventListener("click", function () { irParaMes(1); });
        $("#rotuloMes").addEventListener("click", function () {
            mesEscolhido = C.mesAtual();
            redesenhar();
        });

        $("#anoAnterior").addEventListener("click", function () { irParaAno(-1); });
        $("#anoSeguinte").addEventListener("click", function () { irParaAno(1); });

        /* --- abas --- */
        document.querySelectorAll(".aba").forEach(function (aba) {
            aba.addEventListener("click", function () { trocarTela(aba.dataset.tela); });
        });

        /* --- planilha --- */
        $("#botaoNovaPlanilha").addEventListener("click", function () {
            MD.UI.janela({
                titulo: "Nova planilha",
                texto: "Uma grade separada, com as linhas padrão já prontas. " +
                       "Serve para cada pagamento do mês, ou para separar contas.",
                campos: [{
                    id: "titulo",
                    rotulo: "Nome da planilha",
                    placeholder: "Ex.: Salário do dia 5",
                    dica: "Dá para renomear depois clicando no nome, lá na grade."
                }],
                textoOk: "Criar planilha",
                aoConfirmar: function (valores) {
                    MD.TelaPlanilha.criarPlanilha(valores.titulo);
                    avisar("Planilha criada.");
                }
            });
        });

        $("#formAnotacao").addEventListener("submit", function (evento) {
            evento.preventDefault();
            var campo = $("#campoAnotacao");
            if (MD.TelaPlanilha.adicionarAnotacao(campo.value)) { campo.value = ""; }
        });

        /* --- meta --- */
        $("#campoMeta").addEventListener("change", function () {
            var valor = C.lerValor(this.value);
            E.definirMeta(valor);
            this.value = valor ? C.numero(valor) : "";
            MD.TelaPlanilha.desenharPainel();
            MD.TelaPlanejar.desenhar(mesEscolhido);
        });

        /* --- compras parceladas --- */
        $("#formCompra").addEventListener("submit", function (evento) {
            evento.preventDefault();
            if (!MD.TelaCartoes.enviarFormulario()) {
                avisar("Preencha ao menos a descrição e o valor.");
                return;
            }
            redesenhar();
            avisar("Compra cadastrada. As parcelas já entraram nos meses.");
        });

        ["#compraValor", "#compraParcelas", "#compraInicio"].forEach(function (seletor) {
            $(seletor).addEventListener("input", MD.TelaCartoes.atualizarDicaDaParcela);
        });

        $("#botaoNovaCategoria").addEventListener("click", function () {
            MD.UI.janela({
                titulo: "Nova categoria",
                texto: "As categorias servem para organizar as compras parceladas.",
                campos: [{
                    id: "nome",
                    rotulo: "Nome da categoria",
                    placeholder: "Ex.: Presentes"
                }],
                textoOk: "Criar categoria",
                aoConfirmar: function (valores) {
                    if (!valores.nome) { return; }
                    if (!E.criarCategoria(valores.nome, "sai")) {
                        avisar("Essa categoria já existe.");
                        return;
                    }
                    redesenhar();
                    avisar("Categoria criada.");
                }
            });
        });

        /* --- simulação --- */
        $("#formSimulacao").addEventListener("submit", function (evento) {
            evento.preventDefault();
            MD.TelaPlanejar.simularDoFormulario();
        });

        /* --- backup --- */
        $("#botaoExportarJson").addEventListener("click", exportarJson);
        $("#botaoExportarCsv").addEventListener("click", exportarCsv);
        $("#botaoImportar").addEventListener("click", function () { $("#arquivoBackup").click(); });
        $("#arquivoBackup").addEventListener("change", function (evento) {
            var arquivo = evento.target.files && evento.target.files[0];
            if (arquivo) { importarArquivo(arquivo); }
            evento.target.value = "";
        });

        /* --- tema --- */
        $("#botaoTema").addEventListener("click", function () {
            indiceTema = (indiceTema + 1) % TEMAS.length;
            aplicarTema();
        });
    }

    /* ======================================================================
       Início
       ====================================================================== */
    function iniciar() {
        carregarTema();
        ligarEventos();
        trocarTela("planilha");
        redesenhar();
        atualizarStatus();

        MD.Armazenamento.carregar().then(function (dados) {
            if (dados) {
                E.definir(dados);
                redesenhar();
            }
            atualizarStatus();
        }).catch(function () {
            atualizarStatus();
        });
    }

    document.addEventListener("DOMContentLoaded", iniciar);

    return {
        redesenhar: redesenhar,
        atualizarTopo: atualizarTopo,
        atualizarStatus: atualizarStatus,
        avisar: avisar,
        mesEscolhido: function () { return mesEscolhido; }
    };
}());
