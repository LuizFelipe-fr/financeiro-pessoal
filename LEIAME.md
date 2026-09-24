# Meu dinheiro

Organizador financeiro pessoal. Roda no seu computador, com banco de dados local.
Nada é enviado para a internet.

---

## Como rodar

**Windows** — dois cliques em `iniciar.bat`
**Mac / Linux** — dois cliques em `iniciar.sh` (ou `python3 servidor.py` no terminal)

O navegador abre sozinho em `http://localhost:8777`. Para parar, feche a janela preta.

Precisa ter Python instalado (https://python.org/downloads). No Windows, marque
**"Add Python to PATH"** durante a instalação. Nenhuma outra biblioteca é necessária.

Se abrir o `index.html` direto, sem o servidor, o site funciona igual — mas guarda
os dados no navegador em vez do banco. Use o servidor para valer.

---

## Onde ficam seus dados

| Arquivo | O que é |
|---|---|
| `meu-dinheiro.db` | O banco de dados. É **este** arquivo que você copia para um pendrive ou backup na nuvem. |
| `backups/` | Uma cópia em `.json` a cada gravação. Guarda as 30 mais recentes automaticamente. |

Nunca apague o `.db` sem ter uma cópia. Se algo der errado, o botão
**"Restaurar backup"** no rodapé do site aceita qualquer arquivo da pasta `backups/`.

---

## Estrutura do projeto

```
meu-dinheiro/
├── index.html              só a estrutura da página, sem estilo nem script
├── css/
│   ├── base.css            cores, tipografia, layout geral
│   └── componentes.css     grade, formulários, cartões, gráficos
├── js/
│   ├── armazenamento.js    decide onde salvar (servidor / nuvem / navegador)
│   ├── interface.js        pecinhas de tela usadas por todo mundo
│   ├── estado.js           o formato dos dados e tudo que os altera
│   ├── calculos.js         dinheiro, datas, planilha, parcelas, projeção
│   ├── tela-planilha.js    desenha a tela principal (as grades)
│   ├── tela-cartoes.js     desenha a aba "Cartão e parcelas"
│   ├── tela-planejar.js    desenha a aba "Planejar"
│   └── app.js              topo da página, navegação, backup, tema
├── servidor.py             servidor local + banco SQLite
├── iniciar.bat             lançador do Windows
└── iniciar.sh              lançador do Mac/Linux
```

A regra de divisão: **`calculos.js` nunca toca na tela** e **`tela-*.js` nunca
faz conta**. Se precisar mudar uma fórmula, é em `calculos.js`. Se precisar mudar
a aparência de algo, é no CSS ou no `tela-*.js` correspondente.

Os arquivos JS se comunicam pelo objeto global `MD`. A ordem dos `<script>` no
final do `index.html` importa — cada um usa o anterior.

---

## Como funciona cada parte

### O topo da página
O número grande é o resultado do mês escolhido: soma de todas as planilhas,
menos as parcelas do cartão. As setas ao lado do nome do mês trocam o mês; clicar
no nome volta para o mês atual. Esse mês escolhido é o que manda no site inteiro
— é a coluna destacada nas grades e o ponto de partida da projeção.

### Aba Planilha (a principal)
Cada planilha é uma grade no estilo Excel: você escreve as linhas (Salário,
Aluguel, Faculdade, Conta de luz...) e preenche o valor de cada uma mês a mês —
inclusive meses que ainda não chegaram. Não é um extrato do que já aconteceu, é o
seu plano: você decide os números.

Vêm duas grades prontas, uma para cada pagamento do mês (**Salário do dia 20** e
**Salário do 5º dia útil**), com as mesmas linhas e a mesma função. Cada uma fecha
sozinha, então dá para ver quanto sobra de cada salário sem misturar as contas.

- O sinal ao lado do nome da linha (verde **+** ou vermelho **−**) diz se ela
  soma ou desconta. Clique nele para trocar.
- A linha **Sobra**, no rodapé, é calculada sozinha, mês a mês.
- A linha **Saldo na conta** é livre e opcional — digite o número real que está
  no banco quando quiser conferir se o plano bateu com a realidade.
- A coluna **Ano**, na ponta direita, soma a linha inteira.
- **Repetir mês** copia todos os valores do mês escolhido para os meses seguintes
  do ano. A setinha que aparece ao lado de cada linha faz o mesmo para uma linha
  só — útil para aluguel, internet, faculdade.
- **Copiar linhas** leva os nomes das linhas desta grade para a outra, para manter
  as duas iguais sem redigitar.
- **+ Nova planilha** cria outra grade, já com as linhas padrão.
- Ao lado ficam o resumo do mês (aberto por planilha), o gráfico dos últimos
  meses, a meta e as **anotações**, um bloco de notas livre para lembretes como
  "fulano me deve X".

### Aba Cartão e parcelas
Cadastre a compra pelo **valor total** e o número de parcelas. O sistema calcula
cada parcela (a última absorve os centavos, então a soma bate exata) e espalha
pelos meses. As parcelas são descontadas sozinhas do resultado de cada mês — por
isso **não crie uma linha de "fatura do cartão" na grade**, ou o valor entra duas
vezes.

A coluna da direita mostra quanto de fatura cai em cada um dos próximos 12 meses.

### Aba Planejar
A projeção de cada mês é:

```
  entradas do mês na planilha
− gastos do mês na planilha
− parcelas do cartão          (valor exato, sem chute)
= sobra prevista
```

Mês que você já preencheu na grade entra do jeito que está — é o seu plano, não
um chute. Só mês em branco cai na média dos últimos 3 meses preenchidos.

O **simulador** responde "se eu comprar isso em N vezes, ainda sobra dinheiro?".
Ele compara a sobra de cada mês com e sem a parcela nova, e dá um veredito: cabe,
aperta (fica abaixo da sua meta) ou não fecha a conta. Se você gostar do
resultado, um botão transforma a simulação em compra de verdade.

---

## Atalhos

- `Enter` ou `↓` / `↑` dentro da grade — pula para a célula de cima ou de baixo
- Clicar no nome do mês — volta para o mês atual
- Valores aceitam `1.234,56`, `1234.56` ou só `50`

---

## Gerar um .exe de verdade (opcional)

O `iniciar.bat` já funciona como executável: dois cliques e pronto. Se você quiser
um `.exe` único, que rode em um PC sem Python instalado:

```
pip install pyinstaller
pyinstaller --onefile --add-data "index.html;." --add-data "css;css" --add-data "js;js" --name MeuDinheiro servidor.py
```

O arquivo sai em `dist/MeuDinheiro.exe`. Rode o comando na pasta do projeto, no
Windows (no Mac/Linux troque os `;` por `:`). O banco `meu-dinheiro.db` é criado
ao lado do executável.
