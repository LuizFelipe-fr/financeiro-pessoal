/* ==========================================================================
   MEU DINHEIRO — tela-cartoes.js
   Desenha a aba "Cartão e parcelas": o formulário de compra parcelada,
   a lista do que ainda está sendo pago e quanto cai de fatura por mês.
   ========================================================================== */

MD.TelaCartoes = (function () {
    "use strict";

    var C = MD.Calculos;
    var E = MD.Estado;

    function $(seletor) {
        return document.querySelector(seletor);
    }

    /* ======================================================================
       Ponto de entrada
       ====================================================================== */
    function desenhar(mesChave) {
        preencherFormulario(mesChave);
        desenharListaDeCompras(mesChave);
        desenharFaturaPorMes(mesChave);
        atualizarResumoDoTopo(mesChave);
    }

    /* ======================================================================
       1. Formulário
       ====================================================================== */
    function preencherFormulario(mesChave) {
        var seletor = $("#compraCategoria");
        var escolhida = seletor.value;

        seletor.innerHTML = "";
        E.categoriasDeSaida().forEach(function (c) {
            var opcao = document.createElement("option");
            opcao.value = c.nome;
            opcao.textContent = c.nome;
            seletor.appendChild(opcao);
        });
        seletor.value = escolhida || "Compras";
        if (!seletor.value) { seletor.selectedIndex = 0; }

        var lista = $("#listaCartoes");
        lista.innerHTML = "";
        E.cartoesConhecidos().forEach(function (nome) {
            var opcao = document.createElement("option");
            opcao.value = nome;
            lista.appendChild(opcao);
        });

        var campoInicio = $("#compraInicio");
        if (!campoInicio.value) { campoInicio.value = mesChave; }

        atualizarDicaDaParcela();
    }

    /** Mostra em tempo real quanto vai ficar cada parcela. */
    function atualizarDicaDaParcela() {
        var total = C.lerValor($("#compraValor").value);
        var vezes = Math.max(1, parseInt($("#compraParcelas").value, 10) || 1);
        var dica = $("#dicaParcela");

        if (!total) {
            dica.innerHTML = "A parcela é calculada sozinha e entra no total de cada mês.";
            return;
        }

        var parcela = C.valorDaParcela({ valorTotal: total, parcelas: vezes }, 1);
        dica.innerHTML = vezes === 1
            ? "Vai entrar como uma cobrança única de <b>" + C.moeda(total) + "</b>."
            : vezes + "x de <b>" + C.moeda(parcela) + "</b> &mdash; até " +
              C.nomeDoMes(C.mesDeslocado($("#compraInicio").value || C.mesAtual(), vezes - 1)) + ".";
    }

    /** Lê o formulário e cria a compra. Devolve true se deu certo. */
    function enviarFormulario() {
        var descricao = $("#compraDescricao").value.trim();
        var total = C.lerValor($("#compraValor").value);
        var vezes = Math.max(1, parseInt($("#compraParcelas").value, 10) || 1);
        var inicio = $("#compraInicio").value || C.mesAtual();

        if (!descricao || total <= 0) { return false; }

        E.criarCompra({
            descricao: descricao,
            categoria: $("#compraCategoria").value,
            cartao: $("#compraCartao").value.trim(),
            valorTotal: total,
            parcelas: vezes,
            mesInicio: inicio
        });

        $("#compraDescricao").value = "";
        $("#compraValor").value = "";
        $("#compraParcelas").value = "1";
        return true;
    }

    /* ======================================================================
       2. Lista de compras em andamento
       ====================================================================== */
    function desenharListaDeCompras(mesChave) {
        var alvo = $("#listaCompras");
        var compras = E.obter().compras.slice().sort(function (a, b) {
            return a.mesInicio < b.mesInicio ? 1 : -1;
        });

        alvo.innerHTML = "";

        if (!compras.length) {
            alvo.appendChild(MD.UI.estadoVazio(
                "Nenhuma compra parcelada",
                "Cadastre acima e as parcelas aparecem sozinhas em cada mês."
            ));
            return;
        }

        compras.forEach(function (compra) {
            alvo.appendChild(montarCompra(compra, mesChave));
        });
    }

    function montarCompra(compra, mesChave) {
        var indiceAtual = C.distanciaEntreMeses(compra.mesInicio, mesChave);
        var pagas = Math.min(compra.parcelas, Math.max(0, indiceAtual));
        var quitada = indiceAtual >= compra.parcelas;
        var parcela = C.valorDaParcela(compra, Math.min(compra.parcelas, Math.max(1, indiceAtual + 1)));

        var item = document.createElement("div");
        item.className = "compra";

        var titulo = document.createElement("div");
        titulo.className = "titulo";
        titulo.textContent = compra.descricao || "Compra";

        var info = document.createElement("div");
        info.className = "meta-info";
        info.innerHTML =
            C.moeda(compra.valorTotal) + " em " + compra.parcelas + "x" +
            (compra.cartao ? " &middot; " + MD.UI.escapar(compra.cartao) : "") +
            " &middot; começou em " + C.nomeDoMes(compra.mesInicio);

        var valor = document.createElement("div");
        valor.className = "parcela num";
        if (quitada) {
            valor.innerHTML = '<span style="color:var(--tinta-fraca)">quitada</span>' +
                              "<small>" + compra.parcelas + " de " + compra.parcelas + "</small>";
        } else if (indiceAtual < 0) {
            valor.innerHTML = C.moeda(parcela) + "<small>começa depois</small>";
        } else {
            valor.innerHTML = C.moeda(parcela) +
                              "<small>parcela " + (pagas + 1) + " de " + compra.parcelas + "</small>";
        }

        var progresso = document.createElement("div");
        progresso.className = "progresso-parcelas";
        for (var n = 0; n < compra.parcelas; n++) {
            var marca = document.createElement("i");
            if (n < pagas) { marca.className = "paga"; }
            else if (n === pagas && !quitada && indiceAtual >= 0) { marca.className = "atual"; }
            progresso.appendChild(marca);
        }

        var apagar = MD.UI.botaoApagar("Apagar compra", function () {
            MD.UI.perguntar({
                titulo: "Apagar esta compra?",
                texto: "<b>" + MD.UI.escapar(compra.descricao || "Esta compra") + "</b> e todas " +
                       "as parcelas dela saem da conta de cada mês.",
                textoOk: "Apagar compra",
                aoConfirmar: function () {
                    E.apagarCompra(compra.id);
                    MD.app.redesenhar();
                    MD.app.avisar("Compra apagada.");
                }
            });
        });

        item.appendChild(titulo);
        item.appendChild(valor);
        item.appendChild(apagar);
        item.appendChild(info);
        item.appendChild(progresso);

        return item;
    }

    /* ======================================================================
       3. Fatura por mês (próximos 12 meses com alguma parcela)
       ====================================================================== */
    function desenharFaturaPorMes(mesChave) {
        var alvo = $("#faturaPorMes");
        alvo.innerHTML = "";

        var linhas = [];
        for (var i = 0; i < 12; i++) {
            var mk = C.mesDeslocado(mesChave, i);
            var total = C.totalDeParcelas(mk);
            if (total > 0) {
                linhas.push({ mes: mk, total: total, quantas: C.parcelasDoMes(mk).length });
            }
        }

        if (!linhas.length) {
            alvo.appendChild(MD.UI.estadoVazio(
                "Nenhuma fatura pela frente",
                "Sem parcelas cadastradas a partir deste mês."
            ));
            return;
        }

        linhas.forEach(function (l, indice) {
            var linha = document.createElement("div");
            linha.className = "linha-simples" + (indice === 0 ? " destaque" : "");

            var esquerda = document.createElement("div");
            esquerda.innerHTML =
                '<div class="principal">' + C.nomeDoMes(l.mes) + "</div>" +
                '<div class="rotulo-linha">' + l.quantas +
                    (l.quantas === 1 ? " parcela" : " parcelas") + "</div>";

            var direita = document.createElement("div");
            direita.className = "valor-dir negativo num";
            direita.textContent = C.moeda(l.total);

            linha.appendChild(esquerda);
            linha.appendChild(direita);
            alvo.appendChild(linha);
        });
    }

    /* ======================================================================
       4. Resumo no cabeçalho do bloco
       ====================================================================== */
    function atualizarResumoDoTopo(mesChave) {
        var devedor = C.saldoDevedor(mesChave);
        $("#resumoCompromisso").innerHTML = devedor > 0
            ? "ainda falta pagar <b class=\"num\">" + C.moeda(devedor) + "</b>"
            : "";
    }

    return {
        desenhar: desenhar,
        enviarFormulario: enviarFormulario,
        atualizarDicaDaParcela: atualizarDicaDaParcela
    };
}());
