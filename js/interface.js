/* ==========================================================================
   MEU DINHEIRO — interface.js
   Pecinhas de tela usadas por mais de um arquivo: botão de apagar, estado
   vazio, escapar texto. Nada aqui faz conta nem conhece os dados.
   ========================================================================== */

MD.UI = (function () {
    "use strict";

    function escapar(texto) {
        var div = document.createElement("div");
        div.textContent = texto == null ? "" : String(texto);
        return div.innerHTML;
    }

    function botaoApagar(rotulo, aoClicar) {
        var botao = document.createElement("button");
        botao.className = "apagar";
        botao.innerHTML = "&times;";
        botao.type = "button";
        botao.title = rotulo;
        botao.setAttribute("aria-label", rotulo);
        botao.addEventListener("click", aoClicar);
        return botao;
    }

    function estadoVazio(titulo, texto) {
        var div = document.createElement("div");
        div.className = "vazio";
        div.innerHTML = "<b>" + escapar(titulo) + "</b>" + escapar(texto);
        return div;
    }

    /** Cria um elemento com classe e texto/HTML numa linha só. */
    function el(tag, classe, html) {
        var node = document.createElement(tag);
        if (classe) { node.className = classe; }
        if (html != null) { node.innerHTML = html; }
        return node;
    }

    /* ======================================================================
       Janela (modal)
       Substitui prompt() e confirm() do navegador por uma caixa nossa, com
       a cara do site, campos de verdade e Esc / Enter funcionando.

       MD.UI.janela({
           titulo: "Nova planilha",
           texto: "…",                         (opcional)
           campos: [
               { id: "nome", rotulo: "Nome", valor: "", dica: "…" },
               { id: "tipo", rotulo: "Tipo", tipo: "opcoes",
                 valor: "sai",
                 opcoes: [ { valor: "ent", texto: "Entra" },
                           { valor: "sai", texto: "Sai" } ] },
               { id: "onde", rotulo: "Para onde", tipo: "lista",
                 opcoes: [ { valor: "id1", texto: "Planilha A" } ] }
           ],
           textoOk: "Criar",
           perigo: false,
           aoConfirmar: function (valores) { … }
       });
       ====================================================================== */
    var janelaAberta = null;

    function janela(opcoes) {
        fecharJanela();

        var fundo = el("div", "janela-fundo");
        var caixa = el("div", "janela");
        caixa.setAttribute("role", "dialog");
        caixa.setAttribute("aria-modal", "true");

        var form = el("form", "janela-corpo");
        form.appendChild(el("h3", "janela-titulo", escapar(opcoes.titulo || "")));

        if (opcoes.texto) {
            form.appendChild(el("p", "janela-texto", opcoes.texto));
        }

        var campos = opcoes.campos || [];
        var leitores = [];

        campos.forEach(function (campo, indice) {
            var bloco = el("div", "janela-campo");
            var idHtml = "janela-campo-" + indice;

            if (campo.rotulo) {
                var rotulo = el("label", null, escapar(campo.rotulo));
                rotulo.setAttribute("for", idHtml);
                bloco.appendChild(rotulo);
            }

            if (campo.tipo === "opcoes") {
                leitores.push(montarOpcoes(bloco, campo, idHtml));
            } else if (campo.tipo === "lista") {
                leitores.push(montarLista(bloco, campo, idHtml));
            } else {
                leitores.push(montarTexto(bloco, campo, idHtml));
            }

            if (campo.dica) {
                bloco.appendChild(el("span", "janela-dica", campo.dica));
            }

            form.appendChild(bloco);
        });

        var acoes = el("div", "janela-acoes");

        var cancelar = el("button", "janela-btn", "Cancelar");
        cancelar.type = "button";
        cancelar.addEventListener("click", fecharJanela);

        var confirmar = el("button",
            "janela-btn principal" + (opcoes.perigo ? " perigo" : ""),
            escapar(opcoes.textoOk || "Confirmar"));
        confirmar.type = "submit";

        acoes.appendChild(cancelar);
        acoes.appendChild(confirmar);
        form.appendChild(acoes);

        form.addEventListener("submit", function (evento) {
            evento.preventDefault();

            var valores = {};
            campos.forEach(function (campo, indice) {
                valores[campo.id] = leitores[indice]();
            });

            fecharJanela();
            if (opcoes.aoConfirmar) { opcoes.aoConfirmar(valores); }
        });

        caixa.appendChild(form);
        fundo.appendChild(caixa);

        fundo.addEventListener("mousedown", function (evento) {
            if (evento.target === fundo) { fecharJanela(); }
        });

        document.addEventListener("keydown", aoTeclar);
        document.body.appendChild(fundo);
        janelaAberta = fundo;

        var primeiro = form.querySelector("input, select, button.principal");
        if (primeiro) { primeiro.focus(); if (primeiro.select) { primeiro.select(); } }
    }

    function montarTexto(bloco, campo, idHtml) {
        var entrada = document.createElement("input");
        entrada.type = "text";
        entrada.id = idHtml;
        entrada.value = campo.valor || "";
        entrada.placeholder = campo.placeholder || "";
        if (campo.numero) { entrada.inputMode = "decimal"; }
        bloco.appendChild(entrada);

        return function () { return entrada.value.trim(); };
    }

    function montarLista(bloco, campo, idHtml) {
        var lista = document.createElement("select");
        lista.id = idHtml;

        (campo.opcoes || []).forEach(function (o) {
            var opcao = document.createElement("option");
            opcao.value = o.valor;
            opcao.textContent = o.texto;
            if (o.valor === campo.valor) { opcao.selected = true; }
            lista.appendChild(opcao);
        });

        bloco.appendChild(lista);
        return function () { return lista.value; };
    }

    /** Botões lado a lado, tipo "Entra dinheiro / Sai dinheiro". */
    function montarOpcoes(bloco, campo, idHtml) {
        var grupo = el("div", "janela-opcoes");
        grupo.id = idHtml;

        var escolhido = campo.valor;

        (campo.opcoes || []).forEach(function (o) {
            var botao = el("button", "janela-opcao", escapar(o.texto));
            botao.type = "button";
            botao.dataset.valor = o.valor;
            botao.setAttribute("aria-pressed", o.valor === escolhido ? "true" : "false");

            botao.addEventListener("click", function () {
                escolhido = o.valor;
                grupo.querySelectorAll(".janela-opcao").forEach(function (b) {
                    b.setAttribute("aria-pressed", b.dataset.valor === escolhido ? "true" : "false");
                });
            });

            grupo.appendChild(botao);
        });

        bloco.appendChild(grupo);
        return function () { return escolhido; };
    }

    function aoTeclar(evento) {
        if (evento.key === "Escape") {
            evento.preventDefault();
            fecharJanela();
        }
    }

    function fecharJanela() {
        if (!janelaAberta) { return; }
        document.removeEventListener("keydown", aoTeclar);
        janelaAberta.remove();
        janelaAberta = null;
    }

    /** Atalho para "tem certeza?" — sem campos, só sim ou não. */
    function perguntar(opcoes) {
        janela({
            titulo: opcoes.titulo,
            texto: opcoes.texto,
            textoOk: opcoes.textoOk || "Apagar",
            perigo: opcoes.perigo !== false,
            aoConfirmar: opcoes.aoConfirmar
        });
    }

    return {
        escapar: escapar,
        botaoApagar: botaoApagar,
        estadoVazio: estadoVazio,
        el: el,
        janela: janela,
        perguntar: perguntar,
        fecharJanela: fecharJanela
    };
}());
