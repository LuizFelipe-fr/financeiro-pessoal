/* ==========================================================================
   MEU DINHEIRO — tela-planilha.js
   Desenha a tela principal: as grades estilo Excel, uma por pagamento do
   mês. Você escreve as linhas (Salário, Aluguel, Faculdade...) e preenche o
   valor mês a mês — inclusive meses futuros, porque isso aqui é um plano.

   Cada grade fecha sozinha: tem a própria linha de Total e o próprio
   "Saldo na conta". Assim dá para saber quanto sobrou do salário do dia 20
   sem misturar com o do quinto dia útil.
   ========================================================================== */

MD.TelaPlanilha = (function () {
    "use strict";

    var C = MD.Calculos;
    var E = MD.Estado;
    var UI = MD.UI;

    var mesSelecionado = C.mesAtual();

    function $(seletor) {
        return document.querySelector(seletor);
    }

    function ano() {
        return parseInt(mesSelecionado.slice(0, 4), 10);
    }

    /* ======================================================================
       Ponto de entrada
       ====================================================================== */
    function desenhar(mesChave) {
        mesSelecionado = mesChave || C.mesAtual();

        $("#rotuloAnoPlanilha").textContent = String(ano());
        desenharGrades();
        desenharPainel();
        desenharAnotacoes();
    }

    /** Redesenha só o que fica ao lado das grades (resumo, gráfico, meta).
     *  Usado depois de editar uma célula, para não perder o foco. */
    function desenharPainel() {
        desenharResumoPorPlanilha();
        desenharGraficoMeses();
        desenharMeta();
    }

    /* ======================================================================
       1. As grades
       ====================================================================== */
    function desenharGrades() {
        var alvo = $("#listaGrades");
        alvo.innerHTML = "";

        var planilhas = E.obter().planilhas;

        if (!planilhas.length) {
            alvo.appendChild(UI.estadoVazio(
                "Nenhuma planilha ainda",
                'Clique em "+ Nova planilha" para começar.'
            ));
            return;
        }

        planilhas.forEach(function (planilha) {
            alvo.appendChild(montarGrade(planilha));
        });

        mostrarMesEscolhido(alvo);
    }

    /** Rola cada grade de lado até a coluna do mês que está no topo da
     *  página — é a coluna que interessa quando a tela abre. */
    function mostrarMesEscolhido(alvo) {
        requestAnimationFrame(function () { rolarAteOMes(alvo); });
    }

    function rolarAteOMes(alvo) {
        alvo.querySelectorAll(".grade-scroll").forEach(function (caixa) {
            var coluna = caixa.querySelector("thead th.mes-atual");
            if (!coluna) { return; }

            var repetirCol = caixa.querySelector("thead th.grade-repetir-col");
            var rotulo = caixa.querySelector("thead th.grade-rotulo");
            var margem = (repetirCol ? repetirCol.offsetWidth : 0) +
                         (rotulo ? rotulo.offsetWidth : 0) + 40;
            caixa.scrollLeft = Math.max(0, coluna.offsetLeft - margem);
        });
    }

    function montarGrade(planilha) {
        var meses = C.mesesDoAno(ano());

        var bloco = document.createElement("section");
        bloco.className = "bloco";
        bloco.dataset.planilha = planilha.id;

        bloco.appendChild(montarCabecalhoDaGrade(planilha));

        var envolvedor = document.createElement("div");
        envolvedor.className = "grade-scroll";

        var tabela = document.createElement("table");
        tabela.className = "grade";
        tabela.appendChild(montarCabecalhoDeMeses(meses));

        var corpo = document.createElement("tbody");
        planilha.linhas.forEach(function (linha, indice) {
            corpo.appendChild(montarLinha(planilha, linha, meses, indice));
        });
        tabela.appendChild(corpo);

        var rodape = document.createElement("tfoot");
        rodape.appendChild(montarLinhaTotal(planilha, meses));
        rodape.appendChild(montarLinhaSaldo(planilha, meses));
        tabela.appendChild(rodape);

        envolvedor.appendChild(tabela);
        bloco.appendChild(envolvedor);

        if (!planilha.linhas.length) {
            bloco.appendChild(UI.estadoVazio(
                "Sem linhas ainda",
                'Use "+ Linha" para colocar Salário, Aluguel, Mercado…'
            ));
        }

        bloco.appendChild(montarRodapeDaGrade(planilha));
        return bloco;
    }

    /* --- cabeçalho do bloco: nome da planilha + sobra do mês + ações --- */
    function montarCabecalhoDaGrade(planilha) {
        var topo = document.createElement("div");
        topo.className = "bloco-topo";

        var titulo = document.createElement("input");
        titulo.type = "text";
        titulo.className = "titulo-planilha";
        titulo.value = planilha.titulo;
        titulo.setAttribute("aria-label", "Nome da planilha");
        titulo.addEventListener("change", function () {
            E.planilhaRenomear(planilha.id, titulo.value.trim() || "Planilha");
            desenharPainel();
        });

        var repetirMes = document.createElement("button");
        repetirMes.className = "mini";
        repetirMes.type = "button";
        repetirMes.textContent = "Repetir mês";
        repetirMes.title = "Copia todos os valores de " + C.nomeDoMes(mesSelecionado) +
                           " para os meses seguintes deste ano";
        repetirMes.addEventListener("click", function () {
            UI.perguntar({
                titulo: "Repetir " + C.nomeDoMes(mesSelecionado) + "?",
                texto: "Todos os valores deste mês vão ser copiados para os meses " +
                       "seguintes de <b>" + ano() + "</b>, em <b>" +
                       UI.escapar(planilha.titulo) + "</b>. O que já estiver escrito " +
                       "nesses meses será substituído.",
                textoOk: "Repetir até dezembro",
                perigo: false,
                aoConfirmar: function () {
                    E.planilhaRepetirMesNoAno(planilha.id, mesSelecionado);
                    desenharGrades();
                    atualizarTudo();
                    MD.app.avisar("Mês repetido até dezembro.");
                }
            });
        });

        var copiar = document.createElement("button");
        copiar.className = "mini";
        copiar.type = "button";
        copiar.textContent = "Copiar linhas";
        copiar.title = "Copia os nomes das linhas desta planilha para a outra";
        copiar.addEventListener("click", function () { copiarLinhasPara(planilha); });

        var apagar = document.createElement("button");
        apagar.className = "mini";
        apagar.type = "button";
        apagar.textContent = "Apagar";
        apagar.addEventListener("click", function () {
            UI.perguntar({
                titulo: "Apagar esta planilha?",
                texto: "A planilha <b>" + UI.escapar(planilha.titulo) + "</b> e todos os " +
                       "valores digitados nela somem. Isso não dá para desfazer.",
                textoOk: "Apagar planilha",
                aoConfirmar: function () {
                    E.planilhaApagar(planilha.id);
                    MD.app.redesenhar();
                    MD.app.avisar("Planilha apagada.");
                }
            });
        });

        topo.appendChild(titulo);
        topo.appendChild(repetirMes);
        topo.appendChild(copiar);
        topo.appendChild(apagar);
        return topo;
    }

    /** Copia as linhas desta planilha para outra (pergunta qual, se houver
     *  mais de uma opção). Serve para manter as duas grades iguais. */
    function copiarLinhasPara(origem) {
        var outras = E.obter().planilhas.filter(function (p) { return p.id !== origem.id; });

        if (!outras.length) {
            MD.app.avisar("Não há outra planilha para copiar.");
            return;
        }

        UI.janela({
            titulo: "Copiar linhas",
            texto: "Leva os nomes das linhas de <b>" + UI.escapar(origem.titulo) +
                   "</b> para outra planilha. Só os nomes — nenhum valor é copiado, " +
                   "e linhas repetidas são puladas.",
            campos: [{
                id: "destino",
                rotulo: "Copiar para",
                tipo: "lista",
                valor: outras[0].id,
                opcoes: outras.map(function (p) {
                    return { valor: p.id, texto: p.titulo };
                })
            }],
            textoOk: "Copiar",
            aoConfirmar: function (valores) {
                var destino = E.planilhaObter(valores.destino);
                if (!destino) { return; }

                var copiadas = E.planilhaCopiarLinhas(origem.id, destino.id);
                MD.app.redesenhar();
                MD.app.avisar(copiadas
                    ? copiadas + (copiadas === 1 ? " linha copiada para " : " linhas copiadas para ") +
                      destino.titulo
                    : "A outra planilha já tem essas linhas.");
            }
        });
    }

    /* --- rodapé do bloco: adicionar linha --- */
    function montarRodapeDaGrade(planilha) {
        var rodape = document.createElement("div");
        rodape.className = "rodape-tab";

        var botao = document.createElement("button");
        botao.className = "add";
        botao.type = "button";
        botao.textContent = "+ Linha";
        botao.addEventListener("click", function () {
            UI.janela({
                titulo: "Nova linha",
                texto: "Em <b>" + UI.escapar(planilha.titulo) + "</b>.",
                campos: [
                    {
                        id: "nome",
                        rotulo: "Nome da linha",
                        placeholder: "Ex.: Internet, Faculdade, Academia"
                    },
                    {
                        id: "tipo",
                        rotulo: "Essa linha",
                        tipo: "opcoes",
                        valor: "sai",
                        opcoes: [
                            { valor: "ent", texto: "+ Entra dinheiro" },
                            { valor: "sai", texto: "− Sai dinheiro" }
                        ],
                        dica: "Dá para trocar depois clicando no sinal ao lado do nome."
                    }
                ],
                textoOk: "Criar linha",
                aoConfirmar: function (valores) {
                    var criada = E.linhaCriar(planilha.id, valores.nome, valores.tipo);
                    desenharGrades();
                    atualizarTudo();

                    var campo = document.querySelector(
                        '[data-planilha="' + planilha.id + '"] ' +
                        '[data-linha-nome="' + criada.id + '"]'
                    );
                    if (campo) { campo.focus(); }
                }
            });
        });

        var dica = document.createElement("span");
        dica.className = "total-pe";
        dica.innerHTML = "o sinal <b>+</b> / <b>−</b> ao lado do nome decide se a linha soma ou desconta";

        rodape.appendChild(botao);
        rodape.appendChild(dica);
        return rodape;
    }

    /* --- linha de cabeçalho com os meses --- */
    function montarCabecalhoDeMeses(meses) {
        var cabecalho = document.createElement("thead");
        var tr = document.createElement("tr");

        var colRepetir = document.createElement("th");
        colRepetir.className = "grade-repetir-col";
        tr.appendChild(colRepetir);

        var primeira = document.createElement("th");
        primeira.className = "grade-rotulo";
        primeira.textContent = "Linha";
        tr.appendChild(primeira);

        meses.forEach(function (mk) {
            var th = document.createElement("th");
            th.className = "grade-mes" + (mk === mesSelecionado ? " mes-atual" : "");
            th.textContent = C.mesCurto(mk);
            th.title = C.nomeDoMes(mk);
            tr.appendChild(th);
        });

        var totalAno = document.createElement("th");
        totalAno.className = "col-ano";
        totalAno.textContent = "Ano";
        tr.appendChild(totalAno);

        tr.appendChild(document.createElement("th"));
        tr.lastChild.className = "grade-acao";
        cabecalho.appendChild(tr);
        return cabecalho;
    }

    /* --- uma linha da grade --- */
    function montarLinha(planilha, linha, meses, indiceLinha) {
        var tr = document.createElement("tr");
        tr.dataset.linha = linha.id;

        /* botão de repetir, numa tira própria fora da área de nomes/valores */
        var celRepetir = document.createElement("td");
        celRepetir.className = "grade-repetir-col";

        var repetir = document.createElement("button");
        repetir.className = "grade-repetir";
        repetir.type = "button";
        repetir.innerHTML = "&rarr;";
        repetir.title = "Repetir o valor de " + C.nomeDoMes(mesSelecionado) +
                        " nos meses seguintes deste ano";
        repetir.addEventListener("click", function () {
            E.linhaRepetirNoAno(planilha.id, linha.id, mesSelecionado);
            desenharGrades();
            atualizarTudo();
            MD.app.avisar("Valor repetido até dezembro.");
        });

        celRepetir.appendChild(repetir);
        tr.appendChild(celRepetir);

        /* nome + sinal */
        var celNome = document.createElement("td");
        celNome.className = "grade-rotulo";

        var conteudo = document.createElement("div");
        conteudo.className = "celula-rotulo";

        var marca = document.createElement("button");
        marca.className = "grade-sinal " + (linha.tipo === "ent" ? "ent" : "sai");
        marca.type = "button";
        marca.textContent = linha.tipo === "ent" ? "+" : "−";
        marca.title = "Clique para trocar entre entrada e gasto";
        marca.addEventListener("click", function () {
            E.linhaAlternarTipo(planilha.id, linha.id);
            desenharGrades();
            atualizarTudo();
        });

        var nome = document.createElement("input");
        nome.type = "text";
        nome.className = "grade-nome";
        nome.value = linha.nome;
        nome.placeholder = "Nome da linha";
        nome.dataset.linhaNome = linha.id;
        nome.setAttribute("aria-label", "Nome da linha");
        nome.addEventListener("change", function () {
            E.linhaRenomear(planilha.id, linha.id, nome.value.trim());
        });

        conteudo.appendChild(marca);
        conteudo.appendChild(nome);
        celNome.appendChild(conteudo);
        tr.appendChild(celNome);

        /* uma célula por mês */
        meses.forEach(function (mk, indiceMes) {
            tr.appendChild(montarCelula(planilha, linha, mk, meses, indiceLinha, indiceMes));
        });

        /* total do ano */
        var celAno = document.createElement("td");
        celAno.className = "grade-cel col-ano num";
        celAno.dataset.anoDe = linha.id;
        celAno.textContent = textoDoAno(planilha, linha);
        tr.appendChild(celAno);

        /* apagar */
        var celApagar = document.createElement("td");
        celApagar.className = "grade-acao";
        celApagar.appendChild(UI.botaoApagar("Apagar linha", function () {
            function apagar() {
                E.linhaApagar(planilha.id, linha.id);
                desenharGrades();
                atualizarTudo();
            }

            if (!linha.nome) { apagar(); return; }

            UI.perguntar({
                titulo: "Apagar a linha?",
                texto: "<b>" + UI.escapar(linha.nome) + "</b> e todos os valores dela, " +
                       "nos 12 meses, vão sumir desta planilha.",
                textoOk: "Apagar linha",
                aoConfirmar: apagar
            });
        }));
        tr.appendChild(celApagar);

        return tr;
    }

    /** Um pisca rápido de destaque, para mostrar que aquele número mudou. */
    function piscar(elemento) {
        elemento.classList.remove("pisca");
        void elemento.offsetWidth;
        elemento.classList.add("pisca");
    }

    /** Espaço vazio na tira do botão de repetir, para as linhas de Total e
     *  Saldo — elas não repetem nada, mas a coluna precisa continuar alinhada. */
    function celulaRepetirVazia() {
        var td = document.createElement("td");
        td.className = "grade-repetir-col";
        return td;
    }

    /** A primeira célula de uma linha da grade (nome fixo, sem campo). */
    function celulaDeRotulo(texto, ajuda) {
        var td = document.createElement("td");
        td.className = "grade-rotulo";
        td.title = ajuda || "";

        var conteudo = document.createElement("div");
        conteudo.className = "celula-rotulo";
        conteudo.textContent = texto;

        td.appendChild(conteudo);
        return td;
    }

    function textoDoAno(planilha, linha) {
        var total = C.totalDaLinhaNoAno(planilha, linha, ano());
        return total ? C.numero(total) : "";
    }

    function montarCelula(planilha, linha, mk, meses, indiceLinha, indiceMes) {
        var td = document.createElement("td");
        td.className = "grade-cel" + (mk === mesSelecionado ? " mes-atual" : "");

        var campo = document.createElement("input");
        campo.type = "text";
        campo.inputMode = "decimal";
        campo.className = "num";
        campo.placeholder = "—";
        campo.dataset.l = indiceLinha;
        campo.dataset.m = indiceMes;

        var valor = E.celula(planilha.id, linha.id, mk);
        campo.value = valor ? C.numero(valor) : "";
        campo.setAttribute("aria-label", (linha.nome || "Linha") + " em " + C.nomeDoMes(mk));

        campo.addEventListener("focus", function () { campo.select(); });

        campo.addEventListener("change", function () {
            var novo = C.lerValor(campo.value);
            E.celulaDefinir(planilha.id, linha.id, mk, novo);
            campo.value = novo ? C.numero(novo) : "";

            piscar(td);
            atualizarTotais(planilha, meses);
            var celAno = document.querySelector(
                '[data-planilha="' + planilha.id + '"] [data-ano-de="' + linha.id + '"]'
            );
            if (celAno) { piscar(celAno); celAno.textContent = textoDoAno(planilha, linha); }
            atualizarTudo();
        });

        /* Enter e setas andam pela grade, como numa planilha de verdade. */
        campo.addEventListener("keydown", function (evento) {
            var passo = 0;
            if (evento.key === "Enter" || evento.key === "ArrowDown") { passo = 1; }
            else if (evento.key === "ArrowUp") { passo = -1; }
            else { return; }

            evento.preventDefault();
            campo.blur();

            var tabela = campo.closest("table");
            var proximo = tabela && tabela.querySelector(
                'input[data-l="' + (indiceLinha + passo) + '"][data-m="' + indiceMes + '"]'
            );
            if (proximo) { proximo.focus(); }
        });

        td.appendChild(campo);
        return td;
    }

    /* --- linha de Total --- */
    function montarLinhaTotal(planilha, meses) {
        var tr = document.createElement("tr");
        tr.className = "grade-total";
        tr.dataset.total = planilha.id;

        tr.appendChild(celulaRepetirVazia());
        tr.appendChild(celulaDeRotulo(
            "Sobra",
            "Entradas menos gastos desta planilha, em cada mês"
        ));

        var somaAno = 0;

        meses.forEach(function (mk) {
            var td = document.createElement("td");
            td.className = "grade-cel total-cel num" + (mk === mesSelecionado ? " mes-atual" : "");

            var total = C.sobraDaPlanilha(planilha, mk);
            somaAno += total;

            td.textContent = total ? C.numero(total) : "";
            td.classList.toggle("negativo", total < 0);
            td.classList.toggle("positivo", total > 0);
            tr.appendChild(td);
        });

        var celAno = document.createElement("td");
        celAno.className = "grade-cel col-ano total-cel num " +
                           (somaAno < 0 ? "negativo" : "positivo");
        celAno.textContent = somaAno ? C.numero(somaAno) : "";
        tr.appendChild(celAno);

        tr.appendChild(document.createElement("td"));
        return tr;
    }

    /* --- linha de Saldo na conta --- */
    function montarLinhaSaldo(planilha, meses) {
        var tr = document.createElement("tr");
        tr.className = "grade-saldo";

        tr.appendChild(celulaRepetirVazia());
        tr.appendChild(celulaDeRotulo(
            "Saldo na conta",
            "Opcional: o saldo real do banco, para conferir"
        ));

        meses.forEach(function (mk) {
            var td = document.createElement("td");
            td.className = "grade-cel" + (mk === mesSelecionado ? " mes-atual" : "");

            var campo = document.createElement("input");
            campo.type = "text";
            campo.inputMode = "decimal";
            campo.className = "num";
            campo.placeholder = "—";

            var valor = E.saldoManual(planilha.id, mk);
            campo.value = (valor === null) ? "" : C.numero(valor);
            campo.setAttribute("aria-label", "Saldo real da conta em " + C.nomeDoMes(mk));

            campo.addEventListener("focus", function () { campo.select(); });
            campo.addEventListener("change", function () {
                E.saldoDefinir(planilha.id, mk, campo.value);
                var novo = E.saldoManual(planilha.id, mk);
                campo.value = (novo === null) ? "" : C.numero(novo);
            });

            td.appendChild(campo);
            tr.appendChild(td);
        });

        tr.appendChild(document.createElement("td"));
        tr.appendChild(document.createElement("td"));
        return tr;
    }

    /** Troca só a linha de total daquela grade, sem redesenhar tudo. */
    function atualizarTotais(planilha, meses) {
        var antiga = document.querySelector('[data-total="' + planilha.id + '"]');
        if (antiga) {
            var nova = montarLinhaTotal(planilha, meses);
            antiga.parentNode.replaceChild(nova, antiga);
            var celDoMes = nova.querySelector("td.mes-atual");
            if (celDoMes) { piscar(celDoMes); }
        }
    }

    /** Atualiza o que vive fora da grade: topo da página e painel lateral. */
    function atualizarTudo() {
        MD.app.atualizarTopo();
        desenharPainel();
        MD.TelaPlanejar.desenhar(mesSelecionado);
    }

    /* ======================================================================
       2. Painel lateral — resumo do mês, gráfico e meta
       ====================================================================== */
    function desenharResumoPorPlanilha() {
        var alvo = $("#resumoPorPlanilha");
        alvo.innerHTML = "";

        var resumo = C.resumoDoMes(mesSelecionado);

        resumo.porPlanilha.forEach(function (t) {
            var linha = document.createElement("div");
            linha.className = "linha-simples";

            var esquerda = document.createElement("div");
            esquerda.innerHTML =
                '<div class="principal">' + UI.escapar(t.planilha.titulo) + "</div>" +
                '<div class="rotulo-linha">entrou ' + C.moeda(t.entradas) +
                " &middot; saiu " + C.moeda(t.saidas) + "</div>";

            var direita = document.createElement("div");
            direita.className = "valor-dir num " + (t.sobra < 0 ? "negativo" : "positivo");
            direita.textContent = C.moeda(t.sobra);

            linha.appendChild(esquerda);
            linha.appendChild(direita);
            alvo.appendChild(linha);
        });

        if (resumo.parcelas > 0) {
            var parcelas = document.createElement("div");
            parcelas.className = "linha-simples";

            var textoEsq = document.createElement("div");
            textoEsq.innerHTML =
                '<div class="principal">Parcelas do cartão</div>' +
                '<div class="rotulo-linha">vêm da aba Cartão &middot; não precisa digitar na grade</div>';

            var textoDir = document.createElement("div");
            textoDir.className = "valor-dir num negativo";
            textoDir.textContent = "− " + C.moeda(resumo.parcelas);

            parcelas.appendChild(textoEsq);
            parcelas.appendChild(textoDir);
            alvo.appendChild(parcelas);
        }

        var total = document.createElement("div");
        total.className = "linha-simples destaque";
        total.innerHTML =
            '<div class="principal">Sobra de ' + C.nomeDoMes(mesSelecionado) + "</div>" +
            '<div class="valor-dir num ' + (resumo.sobra < 0 ? "negativo" : "positivo") + '">' +
                C.moeda(resumo.sobra) + "</div>";
        alvo.appendChild(total);
    }

    function desenharGraficoMeses() {
        var alvo = $("#graficoMeses");
        alvo.innerHTML = "";

        var dados = [];
        for (var i = 5; i >= 0; i--) {
            var mk = C.mesDeslocado(mesSelecionado, -i);
            dados.push({ mes: mk, sobra: C.resumoDoMes(mk).sobra });
        }

        var pico = Math.max.apply(null, dados
            .map(function (d) { return Math.abs(d.sobra); })
            .concat([1]));

        dados.forEach(function (d, indice) {
            var coluna = document.createElement("div");
            coluna.className = "mcol" + (indice === 5 ? " atual" : "");

            var caixa = document.createElement("div");
            caixa.className = "mbar";

            var barra = document.createElement("i");
            barra.style.height = Math.max(2, (Math.abs(d.sobra) / pico) * 88) + "px";
            if (d.sobra < 0) { barra.className = "neg"; }
            barra.title = C.nomeDoMes(d.mes) + ": " + C.moeda(d.sobra);
            caixa.appendChild(barra);

            var rotulo = document.createElement("div");
            rotulo.className = "mrot";
            rotulo.textContent = C.mesCurto(d.mes);

            coluna.appendChild(caixa);
            coluna.appendChild(rotulo);
            alvo.appendChild(coluna);
        });
    }

    function desenharMeta() {
        var campo = $("#campoMeta");
        var meta = E.obter().meta;

        if (document.activeElement !== campo) {
            campo.value = meta ? C.numero(meta) : "";
        }

        var sobra = C.resumoDoMes(mesSelecionado).sobra;
        var texto = $("#textoMeta");

        if (!meta) {
            texto.textContent = "Defina um valor e acompanhe quanto do mês já está garantido.";
        } else if (sobra >= meta) {
            texto.textContent = "Meta batida: " + C.moeda(sobra - meta) + " acima do combinado.";
        } else {
            texto.textContent = "Faltam " + C.moeda(meta - sobra) + " para bater a meta deste mês.";
        }
    }

    /* ======================================================================
       3. Anotações
       ====================================================================== */
    function desenharAnotacoes() {
        var alvo = $("#listaAnotacoes");
        alvo.innerHTML = "";

        var notas = E.obter().anotacoes;

        if (!notas.length) {
            alvo.appendChild(UI.estadoVazio(
                "Sem anotações",
                "Anote combinados, dívidas de terceiros, o que for."
            ));
            return;
        }

        notas.forEach(function (nota) {
            var linha = document.createElement("div");
            linha.className = "nota-linha";

            var texto = document.createElement("span");
            texto.className = "nota-texto";
            texto.textContent = nota.texto;

            var apagar = UI.botaoApagar("Apagar anotação", function () {
                E.anotacaoApagar(nota.id);
                desenharAnotacoes();
            });

            linha.appendChild(texto);
            linha.appendChild(apagar);
            alvo.appendChild(linha);
        });
    }

    function adicionarAnotacao(texto) {
        if (!E.anotacaoCriar(texto)) { return false; }
        desenharAnotacoes();
        return true;
    }

    function criarPlanilha(titulo) {
        E.planilhaCriar(titulo || "Nova planilha");
        MD.app.redesenhar();
    }

    return {
        desenhar: desenhar,
        desenharPainel: desenharPainel,
        criarPlanilha: criarPlanilha,
        adicionarAnotacao: adicionarAnotacao
    };
}());
