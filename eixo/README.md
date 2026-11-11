# Eixo

Um único lugar para o dia inteiro — trabalho, estudos, família, lazer, saúde e dinheiro — de acordar a ir dormir.

## Colocar num servidor da rede (dados sincronizados)

Só precisa de Python 3. No servidor, dentro desta pasta:

```bash
sudo bash instalar-servidor.sh        # Linux com systemd: instala como serviço na porta 8080
python3 server.py                     # qualquer sistema (Windows: python server.py): roda enquanto a janela ficar aberta
```

Com Docker (Portainer, etc.), use `docker compose up -d` nesta pasta e veja a chave com `docker compose logs eixo`.

O comando mostra o **endereço** (`http://IP-DO-SERVIDOR:8080/`) e a **chave de acesso**. Abra o endereço em qualquer aparelho da rede e digite a chave uma vez; todos passam a ver os mesmos dados, guardados no servidor em `eixo-dados.json`.

Sem HTTPS a chave trafega em texto puro: use só em rede de confiança e não exponha a porta para a internet.

## Abrir sem servidor próprio

Também funciona como site estático (GitHub Pages ou `python3 -m http.server`), mas aí os dados ficam só no navegador de cada aparelho.

## Como usar

| Momento | O que fazer |
|---|---|
| Manhã (1 min) | **Planejar o dia**: marque até 3 essenciais com ★ |
| Durante o dia | Escreva na barra de captura, do seu jeito |
| Noite (1 min) | **Fechar o dia**: humor, uma linha, pendentes vão para amanhã |
| Domingo (5 min) | **Revisão**: onde foi sua energia, e planejar a próxima semana |

Exemplos de captura:

- `reunião com cliente amanhã 14h`
- `academia toda seg qua sex 6h`
- `estudar inglês 30min todo dia`
- `dentista sexta às 9 #saúde`
- `gastei 45 mercado` · `recebi 3000 salário`
- `aprender violão algum dia` (vai para a Caixa de entrada)

## Dados

- **Com `server.py`:** ficam no servidor e sincronizam entre aparelhos. Se dois aparelhos alterarem ao mesmo tempo, o app pergunta qual versão manter.
- **Como site estático:** ficam só no navegador (`localStorage`).

Em ambos os casos, **Ajustes → Exportar backup** gera um arquivo com tudo.
