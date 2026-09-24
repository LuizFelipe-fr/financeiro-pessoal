#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
 MEU DINHEIRO — servidor.py
 Servidor local com banco de dados no seu próprio computador.

 O que ele faz:
   - serve o site (index.html, css/, js/) em http://localhost:8777
   - guarda tudo num arquivo SQLite chamado meu-dinheiro.db, na mesma pasta
   - salva uma cópia de segurança a cada gravação, na pasta backups/

 Como usar:
   Windows  -> dê dois cliques em iniciar.bat
   Mac/Linux-> ./iniciar.sh   (ou: python3 servidor.py)

 Não precisa instalar nada: usa só o que já vem com o Python.
==============================================================================
"""

import http.server
import json
import os
import socketserver
import sqlite3
import sys
import threading
import time
import webbrowser
from datetime import datetime

# ----------------------------------------------------------------------------
# Configuração
# ----------------------------------------------------------------------------
PORTA_PADRAO = 8777
PASTA = os.path.dirname(os.path.abspath(__file__))
BANCO = os.path.join(PASTA, "meu-dinheiro.db")
PASTA_BACKUPS = os.path.join(PASTA, "backups")
MAXIMO_DE_BACKUPS = 30

trava = threading.Lock()


# ----------------------------------------------------------------------------
# Banco de dados
# ----------------------------------------------------------------------------
def conectar():
    conexao = sqlite3.connect(BANCO)
    conexao.execute("""
        CREATE TABLE IF NOT EXISTS dados (
            id          INTEGER PRIMARY KEY CHECK (id = 1),
            conteudo    TEXT NOT NULL,
            atualizado  TEXT NOT NULL
        )
    """)
    conexao.commit()
    return conexao


def ler_dados():
    with trava:
        conexao = conectar()
        try:
            linha = conexao.execute(
                "SELECT conteudo FROM dados WHERE id = 1"
            ).fetchone()
        finally:
            conexao.close()

    if not linha:
        return {}

    try:
        return json.loads(linha[0])
    except json.JSONDecodeError:
        return {}


def gravar_dados(dados):
    texto = json.dumps(dados, ensure_ascii=False)
    agora = datetime.now().isoformat(timespec="seconds")

    with trava:
        conexao = conectar()
        try:
            conexao.execute(
                """
                INSERT INTO dados (id, conteudo, atualizado)
                VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE
                    SET conteudo = excluded.conteudo,
                        atualizado = excluded.atualizado
                """,
                (texto, agora),
            )
            conexao.commit()
        finally:
            conexao.close()

    salvar_backup(texto)


def salvar_backup(texto):
    """Guarda uma cópia datada e apaga as mais antigas."""
    os.makedirs(PASTA_BACKUPS, exist_ok=True)

    nome = "backup-" + datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + ".json"
    caminho = os.path.join(PASTA_BACKUPS, nome)

    with open(caminho, "w", encoding="utf-8") as arquivo:
        arquivo.write(texto)

    copias = sorted(
        nome for nome in os.listdir(PASTA_BACKUPS)
        if nome.startswith("backup-") and nome.endswith(".json")
    )
    for antiga in copias[:-MAXIMO_DE_BACKUPS]:
        try:
            os.remove(os.path.join(PASTA_BACKUPS, antiga))
        except OSError:
            pass


# ----------------------------------------------------------------------------
# Servidor HTTP
# ----------------------------------------------------------------------------
class Manipulador(http.server.SimpleHTTPRequestHandler):
    """Serve os arquivos do site e responde à API em /api/dados."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PASTA, **kwargs)

    # --- utilidades -------------------------------------------------------
    def responder_json(self, objeto, codigo=200):
        corpo = json.dumps(objeto, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def caminho_limpo(self):
        return self.path.split("?")[0].strip("/")

    # --- rotas ------------------------------------------------------------
    def do_GET(self):
        if self.caminho_limpo() == "api/dados":
            self.responder_json(ler_dados())
            return
        super().do_GET()

    def do_PUT(self):
        if self.caminho_limpo() != "api/dados":
            self.send_error(404)
            return

        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho <= 0 or tamanho > 20 * 1024 * 1024:
            self.responder_json({"erro": "tamanho inválido"}, 400)
            return

        try:
            dados = json.loads(self.rfile.read(tamanho).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.responder_json({"erro": "json inválido"}, 400)
            return

        if not isinstance(dados, dict):
            self.responder_json({"erro": "formato inesperado"}, 400)
            return

        gravar_dados(dados)
        self.responder_json({"ok": True})

    # --- silêncio no terminal ---------------------------------------------
    def log_message(self, formato, *args):
        pass


class ServidorLinhaUnica(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


# ----------------------------------------------------------------------------
# Inicialização
# ----------------------------------------------------------------------------
def achar_porta(inicial):
    for porta in range(inicial, inicial + 20):
        try:
            servidor = ServidorLinhaUnica(("127.0.0.1", porta), Manipulador)
            return servidor, porta
        except OSError:
            continue
    raise SystemExit("Nenhuma porta livre entre %d e %d." % (inicial, inicial + 20))


def main():
    conectar().close()  # cria o banco na primeira execução

    servidor, porta = achar_porta(PORTA_PADRAO)
    endereco = "http://localhost:%d/" % porta

    print("")
    print("  Meu dinheiro está rodando.")
    print("")
    print("  Abra no navegador:  " + endereco)
    print("  Banco de dados:     " + BANCO)
    print("  Cópias de segurança:" + PASTA_BACKUPS)
    print("")
    print("  Para parar: feche esta janela ou aperte Ctrl+C.")
    print("")

    threading.Timer(1.0, lambda: webbrowser.open(endereco)).start()

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  Encerrado. Seus dados estão salvos.\n")
        servidor.shutdown()


if __name__ == "__main__":
    main()
