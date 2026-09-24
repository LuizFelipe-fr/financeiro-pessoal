/* ==========================================================================
   MEU DINHEIRO — armazenamento.js
   Decide ONDE os dados ficam guardados, nesta ordem de preferência:

     1. Servidor local  — quando o site é aberto pelo servidor.py (banco no PC)
     2. Nuvem           — quando roda publicado dentro do Claude
     3. Navegador       — localStorage, como último recurso

   O resto do programa não precisa saber qual dos três está em uso: chama
   Armazenamento.carregar() e Armazenamento.salvar() e pronto.
   ========================================================================== */

var MD = window.MD = window.MD || {};

MD.Armazenamento = (function () {
    "use strict";

    var CHAVE_LOCAL = "meu-dinheiro-v2";

    var modo = "navegador";   // "servidor" | "nuvem" | "navegador"
    var docNuvem = null;
    var temporizador = null;
    var salvandoAgora = false;
    var pendente = null;

    /* ----------------------------------------------------------------------
       Detecção: existe um servidor local respondendo em /api/dados?
       ---------------------------------------------------------------------- */
    function testarServidor() {
        if (location.protocol === "file:") {
            return Promise.resolve(null);
        }
        return fetch("api/dados", { cache: "no-store" })
            .then(function (resposta) {
                if (!resposta.ok) { return null; }
                return resposta.json();
            })
            .catch(function () { return null; });
    }

    /* ----------------------------------------------------------------------
       Detecção: estamos publicados dentro do Claude, com banco na conta?
       ---------------------------------------------------------------------- */
    function testarNuvem() {
        if (typeof claude === "undefined" || !claude || typeof claude.use !== "function") {
            return Promise.resolve(null);
        }
        return claude.use("db")
            .then(function (db) {
                if (!db) { return null; }
                docNuvem = db.doc("financas/principal");
                return docNuvem.get();
            })
            .then(function (snap) {
                if (!snap) { return null; }
                return snap.exists ? snap.data() : {};
            })
            .catch(function () { return null; });
    }

    /* ----------------------------------------------------------------------
       Leitura do navegador
       ---------------------------------------------------------------------- */
    function lerNavegador() {
        try {
            var bruto = localStorage.getItem(CHAVE_LOCAL);
            return bruto ? JSON.parse(bruto) : null;
        } catch (erro) {
            return null;
        }
    }

    function gravarNavegador(dados) {
        try {
            localStorage.setItem(CHAVE_LOCAL, JSON.stringify(dados));
        } catch (erro) {
            /* modo anônimo ou disco cheio: segue a vida */
        }
    }

    /* ----------------------------------------------------------------------
       Carregar: tenta servidor, depois nuvem, depois navegador.
       Se o navegador tiver dados mais novos que a origem remota, ele vence
       (evita perder o que foi lançado offline).
       ---------------------------------------------------------------------- */
    function carregar() {
        var doNavegador = lerNavegador();

        return testarServidor().then(function (doServidor) {
            if (doServidor) {
                modo = "servidor";
                return escolherMaisNovo(doServidor, doNavegador);
            }
            return testarNuvem().then(function (daNuvem) {
                if (daNuvem) {
                    modo = "nuvem";
                    return escolherMaisNovo(daNuvem, doNavegador);
                }
                modo = "navegador";
                return doNavegador;
            });
        });
    }

    function escolherMaisNovo(remoto, local) {
        var tR = (remoto && remoto.atualizadoEm) || 0;
        var tL = (local && local.atualizadoEm) || 0;
        if (!remoto || !remoto.planilhas) { return local; }
        if (local && local.planilhas && tL > tR) { return local; }
        return remoto;
    }

    /* ----------------------------------------------------------------------
       Salvar: grava sempre no navegador (é instantâneo e serve de cópia)
       e manda para a origem principal com um pequeno atraso, agrupando
       várias digitações seguidas numa gravação só.
       ---------------------------------------------------------------------- */
    function salvar(dados) {
        gravarNavegador(dados);
        if (modo === "navegador") { return; }

        pendente = dados;
        clearTimeout(temporizador);
        temporizador = setTimeout(enviar, 600);
    }

    function enviar() {
        if (salvandoAgora || !pendente) { return; }

        var corpo = JSON.parse(JSON.stringify(pendente));
        pendente = null;
        salvandoAgora = true;

        var promessa;
        if (modo === "servidor") {
            promessa = fetch("api/dados", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(corpo)
            }).then(function (r) {
                if (!r.ok) { throw new Error("falha ao gravar"); }
            });
        } else {
            promessa = docNuvem.set(corpo);
        }

        promessa.then(function () {
            salvandoAgora = false;
            if (pendente) { enviar(); }
        }).catch(function () {
            salvandoAgora = false;
            modo = "navegador";
            if (MD.app && MD.app.atualizarStatus) { MD.app.atualizarStatus(); }
        });
    }

    function descricaoDoModo() {
        if (modo === "servidor") { return "Salvando no banco de dados do seu PC"; }
        if (modo === "nuvem")    { return "Salvando na sua conta"; }
        return "Salvando neste navegador";
    }

    return {
        carregar: carregar,
        salvar: salvar,
        modo: function () { return modo; },
        descricaoDoModo: descricaoDoModo
    };
}());
