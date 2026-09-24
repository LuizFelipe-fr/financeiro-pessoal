/* ==========================================================================
   MEU DINHEIRO — tela-planejar.js
   Desenha a aba "Planejar": quanto deve sobrar nos próximos meses, segundo
   o que está na planilha, e o simulador de "será que cabe se eu comprar
   isso parcelado?".

   Mês já preenchido na grade = número seu, sem chute. Mês em branco = média
   dos últimos meses preenchidos. As parcelas do cartão entram sempre pelo
   valor exato.
   ========================================================================== */

MD.TelaPlanejar = (function () {
    "use strict";

    var C = MD.Calculos;
    var E = MD.Estado;
    var UI = MD.UI;

    var ultimaSimulacao = null;

    function $(seletor) {
        return document.querySelector(seletor);
    }

    /* ======================================================================
       Ponto de entrada
       ====================================================================== */
    function desenhar(mesChave) {
        desenharProjecao(mesChave);
        desenharBaseDaEstimativa();
        if (ultimaSimulacao) {
            mostrarSimulacao(ultimaSimulacao.valor, ultimaSimulacao.parcelas, ultimaSimulacao.descricao);
        }
    }

    /* ======================================================================
       1. Projeção dos próximos 6 meses
       ====================================================================== */
    function desenharProjecao(mesChave) {
        var alvo = $("#tabelaProjecao");
        alvo.innerHTML = "";

        var meses = C.projecaoDeVariosMeses(mesChave, 6);
        var acumulado = 0;

        meses.forEach(function (p, indice) {
            acumulado += p.sobra;

            var linha = document.createElement("div");
            linha.className = "linha-simples" + (indice === 0 ? " destaque" : "");

            var detalhe = (p.estimado ? "estimado" : "pela planilha") +
                " &middot; entra " + C.moeda(p.entradas) +
                " &middot; sai " + C.moeda(p.saidasPlanilha) +
                (p.parcelas ? " &middot; parcelas " + C.moeda(p.parcelas) : "");

            var esquerda = document.createElement("div");
            esquerda.innerHTML =
                '<div class="principal">' + C.nomeDoMes(p.mes) + "</div>" +
                '<div class="rotulo-linha">' + detalhe + "</div>";

            var direita = document.createElement("div");
            direita.className = "valor-dir num " + (p.sobra < 0 ? "negativo" : "positivo");
            direita.innerHTML = C.moeda(p.sobra) +
                "<small>acumulado " + C.moeda(acumulado) + "</small>";

            linha.appendChild(esquerda);
            linha.appendChild(direita);
            alvo.appendChild(linha);
        });

        var total = document.createElement("div");
        total.className = "linha-simples";
        total.innerHTML =
            '<div class="principal">Em 6 meses você deve juntar</div>' +
            '<div class="valor-dir num ' + (acumulado < 0 ? "negativo" : "positivo") + '">' +
                C.moeda(acumulado) + "</div>";
        alvo.appendChild(total);
    }

    /* ======================================================================
       2. Explicação de onde vieram os números
       ====================================================================== */
    function desenharBaseDaEstimativa() {
        var base = C.baseDaEstimativa();
        var alvo = $("#baseEstimativa");

        if (!base.mesesUsados.length) {
            alvo.innerHTML = "Preencha alguns meses da planilha para a estimativa " +
                             "começar a fazer sentido.";
            return;
        }

        var nomes = base.mesesUsados.map(function (mk) { return C.mesCurto(mk); }).join(", ");

        alvo.innerHTML =
            "Mês que você já preencheu na planilha entra do jeito que está — " +
            "é o seu plano, não um chute.<br><br>" +
            "Mês em branco usa <b>" + nomes + "</b> como referência: " +
            "entradas de <b>" + C.moeda(base.mediaEntradas) + "</b> e " +
            "gastos de <b>" + C.moeda(base.mediaSaidas) + "</b> por mês.<br><br>" +
            "As parcelas do cartão entram pelo valor exato, sem estimativa. " +
            "Quanto mais meses da grade você preencher, mais certeira fica a conta.";
    }

    /* ======================================================================
       3. Simulador
       ====================================================================== */
    function simularDoFormulario() {
        var valor = C.lerValor($("#simValor").value);
        var parcelas = Math.max(1, parseInt($("#simParcelas").value, 10) || 1);
        var descricao = $("#simDescricao").value.trim();

        if (valor <= 0) {
            $("#resultadoSimulacao").innerHTML =
                '<div class="explicacao">Informe o valor total da compra para simular.</div>';
            return;
        }

        ultimaSimulacao = { valor: valor, parcelas: parcelas, descricao: descricao };
        mostrarSimulacao(valor, parcelas, descricao);
    }

    function mostrarSimulacao(valor, parcelas, descricao) {
        var mesInicial = C.mesDeslocado(C.mesAtual(), 1);
        var s = C.simularCompra(valor, parcelas, mesInicial);
        var alvo = $("#resultadoSimulacao");
        var nome = descricao || "essa compra";

        alvo.innerHTML = "";

        /* --- veredito --- */
        var veredito = document.createElement("div");
        veredito.className = "veredito " + s.veredito;

        var titulo, explicacao;
        if (s.veredito === "cabe") {
            titulo = "Cabe no orçamento";
            explicacao = "Mesmo no mês mais apertado sobram " + C.moeda(s.margemMinima) +
                         " depois de pagar a parcela.";
        } else if (s.veredito === "aperta") {
            titulo = "Cabe, mas aperta";
            explicacao = "No mês mais apertado sobram só " + C.moeda(s.margemMinima) +
                         ", abaixo da sua meta de " + C.moeda(E.obter().meta) + ".";
        } else {
            titulo = "Não fecha a conta";
            explicacao = s.mesesApertados +
                         (s.mesesApertados === 1 ? " mês ficaria" : " meses ficariam") +
                         " no vermelho com essa parcela.";
        }

        veredito.innerHTML =
            "<b>" + titulo + "</b>" +
            UI.escapar(nome.charAt(0).toUpperCase() + nome.slice(1)) +
            " em " + s.parcelas + "x de " + C.moeda(s.parcelaValor) + ". " + explicacao;
        alvo.appendChild(veredito);

        /* --- mês a mês --- */
        s.linhas.slice(0, 8).forEach(function (l) {
            var linha = document.createElement("div");
            linha.className = "linha-simples";

            var esquerda = document.createElement("div");
            esquerda.innerHTML =
                '<div class="principal">' + C.nomeDoMes(l.mes) + "</div>" +
                '<div class="rotulo-linha">' +
                    (l.parcela > 0
                        ? "sobrava " + C.moeda(l.sobraAntes) + " &middot; parcela " + C.moeda(l.parcela)
                        : "sem parcela neste mês") +
                "</div>";

            var direita = document.createElement("div");
            direita.className = "valor-dir num " + (l.sobraDepois < 0 ? "negativo" : "positivo");
            direita.textContent = C.moeda(l.sobraDepois);

            linha.appendChild(esquerda);
            linha.appendChild(direita);
            alvo.appendChild(linha);
        });

        /* --- transformar em compra de verdade --- */
        var acao = document.createElement("div");
        acao.className = "rodape-tab";

        var botao = document.createElement("button");
        botao.className = "mini";
        botao.type = "button";
        botao.textContent = "Registrar como compra de verdade";
        botao.addEventListener("click", function () {
            E.criarCompra({
                descricao: descricao || "Compra simulada",
                categoria: "Compras",
                cartao: "",
                valorTotal: valor,
                parcelas: parcelas,
                mesInicio: mesInicial
            });
            ultimaSimulacao = null;
            $("#simDescricao").value = "";
            $("#simValor").value = "";
            MD.app.redesenhar();
            MD.app.avisar("Compra registrada. As parcelas já entraram nos próximos meses.");
        });

        acao.appendChild(botao);
        alvo.appendChild(acao);
    }

    return {
        desenhar: desenhar,
        simularDoFormulario: simularDoFormulario
    };
}());
