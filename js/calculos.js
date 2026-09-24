/* ==========================================================================
   MEU DINHEIRO — calculos.js
   Funções puras: recebem dados, devolvem números. Não tocam na tela.
   É aqui que mora a lógica da planilha, das parcelas e da projeção.
   ========================================================================== */

MD.Calculos = (function () {
    "use strict";

    var MESES_DE_HISTORICO = 3;   // quantos meses preenchidos a média olha

    /* ======================================================================
       1. DINHEIRO
       ====================================================================== */

    var formatador = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    /** 1234.5  ->  "R$ 1.234,50" */
    function moeda(n) {
        return formatador.format(n || 0);
    }

    /** 1234.5  ->  "1.234,50" (sem o R$, para dentro de campos) */
    function numero(n) {
        return (n || 0).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /** Aceita "1.234,56", "1234.56", "R$ 50" e devolve número. */
    function lerValor(entrada) {
        if (typeof entrada === "number") { return entrada; }

        var texto = String(entrada || "").trim();
        if (!texto) { return 0; }

        texto = texto.replace(/[^\d,.-]/g, "");
        if (texto.indexOf(",") > -1) {
            texto = texto.replace(/\./g, "").replace(",", ".");
        }

        var n = parseFloat(texto);
        return isNaN(n) ? 0 : Math.round(n * 100) / 100;
    }

    /* ======================================================================
       2. DATAS
       Meses são sempre a string "AAAA-MM". Simples de comparar e ordenar.
       ====================================================================== */

    function chaveDoMes(data) {
        return data.getFullYear() + "-" + String(data.getMonth() + 1).padStart(2, "0");
    }

    function mesAtual() {
        return chaveDoMes(new Date());
    }

    /** "2026-09" + 3  ->  "2026-12" */
    function mesDeslocado(mesChave, quantos) {
        var ano = parseInt(mesChave.slice(0, 4), 10);
        var mes = parseInt(mesChave.slice(5, 7), 10) - 1 + quantos;
        return chaveDoMes(new Date(ano, mes, 1));
    }

    /** Quantos meses de "2026-09" até "2026-12"? -> 3 */
    function distanciaEntreMeses(de, ate) {
        var a = parseInt(de.slice(0, 4), 10) * 12 + parseInt(de.slice(5, 7), 10);
        var b = parseInt(ate.slice(0, 4), 10) * 12 + parseInt(ate.slice(5, 7), 10);
        return b - a;
    }

    /** Os 12 meses de um ano, em ordem. */
    function mesesDoAno(ano) {
        var lista = [];
        for (var m = 1; m <= 12; m++) {
            lista.push(String(ano) + "-" + String(m).padStart(2, "0"));
        }
        return lista;
    }

    /** "2026-09" -> "Setembro de 2026" */
    function nomeDoMes(mesChave) {
        var d = new Date(
            parseInt(mesChave.slice(0, 4), 10),
            parseInt(mesChave.slice(5, 7), 10) - 1,
            1
        );
        var texto = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }

    /** "2026-09" -> "set" */
    function mesCurto(mesChave) {
        var d = new Date(
            parseInt(mesChave.slice(0, 4), 10),
            parseInt(mesChave.slice(5, 7), 10) - 1,
            1
        );
        return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    }

    /* ======================================================================
       3. PARCELAS DO CARTÃO
       ====================================================================== */

    /**
     * Valor de cada parcela. A última absorve a sobra dos centavos, para
     * que a soma bata exatamente com o valor total da compra.
     */
    function valorDaParcela(compra, numeroDaParcela) {
        var base = Math.round((compra.valorTotal / compra.parcelas) * 100) / 100;
        if (numeroDaParcela < compra.parcelas) { return base; }
        return Math.round((compra.valorTotal - base * (compra.parcelas - 1)) * 100) / 100;
    }

    /** Todas as parcelas que caem num mês: [{ compra, numero, valor }]. */
    function parcelasDoMes(mesChave) {
        var lista = [];

        MD.Estado.obter().compras.forEach(function (compra) {
            if (!compra.mesInicio) { return; }

            var indice = distanciaEntreMeses(compra.mesInicio, mesChave);
            if (indice < 0 || indice >= compra.parcelas) { return; }

            lista.push({
                compra: compra,
                numero: indice + 1,
                valor: valorDaParcela(compra, indice + 1)
            });
        });

        return lista;
    }

    function totalDeParcelas(mesChave) {
        return parcelasDoMes(mesChave).reduce(function (soma, p) {
            return soma + p.valor;
        }, 0);
    }

    /** Quanto ainda falta pagar de todas as compras, a partir de um mês. */
    function saldoDevedor(aPartirDe) {
        var total = 0;
        MD.Estado.obter().compras.forEach(function (compra) {
            var jaPagas = Math.max(0, distanciaEntreMeses(compra.mesInicio, aPartirDe));
            for (var n = jaPagas + 1; n <= compra.parcelas; n++) {
                total += valorDaParcela(compra, n);
            }
        });
        return total;
    }

    /* ======================================================================
       4. A PLANILHA
       Cada grade é uma tabela de linhas (+ entra / − sai) por mês.
       ====================================================================== */

    /** Entradas, saídas e sobra de UMA planilha num mês. */
    function totaisDaPlanilha(planilha, mesChave) {
        var entradas = 0;
        var saidas = 0;
        var preenchido = false;

        planilha.linhas.forEach(function (linha) {
            var valor = MD.Estado.celula(planilha.id, linha.id, mesChave);
            if (!valor) { return; }
            preenchido = true;
            if (linha.tipo === "ent") { entradas += valor; } else { saidas += valor; }
        });

        return {
            planilha: planilha,
            entradas: entradas,
            saidas: saidas,
            sobra: entradas - saidas,
            preenchido: preenchido
        };
    }

    /** Só o número da linha "Total" da grade. */
    function sobraDaPlanilha(planilha, mesChave) {
        return totaisDaPlanilha(planilha, mesChave).sobra;
    }

    /** Soma de uma linha no ano inteiro — a coluna "Ano" da grade. */
    function totalDaLinhaNoAno(planilha, linha, ano) {
        return mesesDoAno(ano).reduce(function (soma, mk) {
            return soma + MD.Estado.celula(planilha.id, linha.id, mk);
        }, 0);
    }

    /**
     * Resumo do mês inteiro: soma todas as planilhas e desconta as parcelas
     * do cartão, que são calculadas na aba "Cartão" e não ficam na grade.
     */
    function resumoDoMes(mesChave) {
        var porPlanilha = MD.Estado.obter().planilhas.map(function (p) {
            return totaisDaPlanilha(p, mesChave);
        });

        var entradas = 0;
        var saidasPlanilha = 0;
        var preenchido = false;

        porPlanilha.forEach(function (t) {
            entradas += t.entradas;
            saidasPlanilha += t.saidas;
            if (t.preenchido) { preenchido = true; }
        });

        var parcelas = totalDeParcelas(mesChave);

        return {
            porPlanilha: porPlanilha,
            entradas: entradas,
            saidasPlanilha: saidasPlanilha,
            parcelas: parcelas,
            saidas: saidasPlanilha + parcelas,
            sobra: entradas - saidasPlanilha - parcelas,
            preenchido: preenchido || parcelas > 0
        };
    }

    /** Meses que já têm algum valor digitado na grade, em ordem. */
    function mesesPreenchidos(ate) {
        var celulas = MD.Estado.obter().celulas;
        var vistos = {};

        Object.keys(celulas).forEach(function (chave) {
            if (!celulas[chave]) { return; }
            var mk = chave.split("|")[2];
            if (!mk) { return; }
            if (!ate || mk <= ate) { vistos[mk] = true; }
        });

        return Object.keys(vistos).sort();
    }

    /* ======================================================================
       5. PROJEÇÃO

       A grade já é o plano: se o mês tem valores digitados, ele é usado do
       jeito que está. Só quando o mês está em branco é que entra a média dos
       últimos meses preenchidos. As parcelas do cartão entram sempre pelo
       valor exato, sem chute.
       ====================================================================== */

    function mediaDosMesesPreenchidos(ate) {
        var meses = mesesPreenchidos(ate).slice(-MESES_DE_HISTORICO);
        if (!meses.length) {
            return { meses: [], entradas: 0, saidas: 0 };
        }

        var entradas = 0;
        var saidas = 0;

        meses.forEach(function (mk) {
            var r = resumoDoMes(mk);
            entradas += r.entradas;
            saidas += r.saidasPlanilha;
        });

        return {
            meses: meses,
            entradas: entradas / meses.length,
            saidas: saidas / meses.length
        };
    }

    function projecaoDoMes(mesChave) {
        var real = resumoDoMes(mesChave);

        if (real.preenchido) {
            return {
                mes: mesChave,
                estimado: false,
                entradas: real.entradas,
                saidasPlanilha: real.saidasPlanilha,
                parcelas: real.parcelas,
                saidas: real.saidas,
                sobra: real.sobra
            };
        }

        var media = mediaDosMesesPreenchidos(mesDeslocado(mesChave, -1));
        var parcelas = totalDeParcelas(mesChave);

        return {
            mes: mesChave,
            estimado: true,
            entradas: media.entradas,
            saidasPlanilha: media.saidas,
            parcelas: parcelas,
            saidas: media.saidas + parcelas,
            sobra: media.entradas - media.saidas - parcelas
        };
    }

    /** Projeção de vários meses seguidos, começando no mês informado. */
    function projecaoDeVariosMeses(mesInicial, quantidade) {
        var lista = [];
        for (var i = 0; i < quantidade; i++) {
            lista.push(projecaoDoMes(mesDeslocado(mesInicial, i)));
        }
        return lista;
    }

    /** Texto explicando de onde saíram os números da projeção. */
    function baseDaEstimativa() {
        var media = mediaDosMesesPreenchidos(mesAtual());
        return {
            mesesUsados: media.meses,
            mediaEntradas: media.entradas,
            mediaSaidas: media.saidas
        };
    }

    /* ======================================================================
       6. SIMULAÇÃO
       ====================================================================== */

    /**
     * "E se eu comprar isso em N vezes?"
     * Compara a sobra prevista de cada mês com e sem a nova parcela.
     */
    function simularCompra(valorTotal, parcelas, mesInicial) {
        parcelas = Math.max(1, parseInt(parcelas, 10) || 1);
        var fake = { valorTotal: valorTotal, parcelas: parcelas };
        var horizonte = Math.max(6, Math.min(parcelas, 24));
        var linhas = [];

        for (var i = 0; i < horizonte; i++) {
            var mk = mesDeslocado(mesInicial, i);
            var base = projecaoDoMes(mk);
            var parcela = (i < parcelas) ? valorDaParcela(fake, i + 1) : 0;

            linhas.push({
                mes: mk,
                sobraAntes: base.sobra,
                parcela: parcela,
                sobraDepois: base.sobra - parcela,
                estimado: base.estimado
            });
        }

        var mesesApertados = linhas.filter(function (l) {
            return l.parcela > 0 && l.sobraDepois < 0;
        }).length;

        var margemMinima = Math.min.apply(null, linhas
            .filter(function (l) { return l.parcela > 0; })
            .map(function (l) { return l.sobraDepois; }));

        var veredito;
        if (mesesApertados > 0) {
            veredito = "nao-cabe";
        } else if (margemMinima < (MD.Estado.obter().meta || 0)) {
            veredito = "aperta";
        } else {
            veredito = "cabe";
        }

        return {
            parcelaValor: valorDaParcela(fake, 1),
            parcelas: parcelas,
            linhas: linhas,
            mesesApertados: mesesApertados,
            margemMinima: margemMinima,
            veredito: veredito
        };
    }

    return {
        moeda: moeda,
        numero: numero,
        lerValor: lerValor,

        chaveDoMes: chaveDoMes,
        mesAtual: mesAtual,
        mesDeslocado: mesDeslocado,
        distanciaEntreMeses: distanciaEntreMeses,
        mesesDoAno: mesesDoAno,
        nomeDoMes: nomeDoMes,
        mesCurto: mesCurto,

        valorDaParcela: valorDaParcela,
        parcelasDoMes: parcelasDoMes,
        totalDeParcelas: totalDeParcelas,
        saldoDevedor: saldoDevedor,

        totaisDaPlanilha: totaisDaPlanilha,
        sobraDaPlanilha: sobraDaPlanilha,
        totalDaLinhaNoAno: totalDaLinhaNoAno,
        resumoDoMes: resumoDoMes,
        mesesPreenchidos: mesesPreenchidos,

        projecaoDoMes: projecaoDoMes,
        projecaoDeVariosMeses: projecaoDeVariosMeses,
        baseDaEstimativa: baseDaEstimativa,
        simularCompra: simularCompra
    };
}());
