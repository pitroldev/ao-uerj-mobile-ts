# Fontes do mapa offline

Na raiz do repositório:

```sh
node scripts/generate-campus-map.cjs
node scripts/generate-campus-map.cjs --check
```

O primeiro comando escreve `src/adapters/outbound/campus-map/atlas.json`. O segundo compara o resultado sem alterar arquivos e falha se o atlas estiver desatualizado. Ambos funcionam sem rede, navegador ou dependências externas.

| Arquivo                                                          | Função                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [data/esquema-pavilhao.json](data/esquema-pavilhao.json)         | Medidas em metros, referencial geográfico, contornos, ruas e circulação.       |
| [data/pavilhao-e-campus.geojson](data/pavilhao-e-campus.geojson) | Geometria WGS84, caminhos e proveniência de cada feição.                       |
| [data/salas-pavilhao.json](data/salas-pavilhao.json)             | Numeração por andar, exceções, âncoras e medidas oficiais do 9º andar do D.    |
| [data/places.json](data/places.json)                             | Lugares e unidades exibidos no app, com coordenadas e URLs das fontes.         |
| [data/pontos-onibus.json](data/pontos-onibus.json)               | Pontos de ônibus perto dos portões: parada da SMTR, rua, posição e linhas.     |
| [room-model.cjs](room-model.cjs)                                 | Divisões de salas, portas, pilares e trajetos gerados a partir dessas medidas. |

O app carrega somente o atlas. O modelo de geração não contém telas, renderizador ou código de demonstração. Alterações nas fontes devem ser acompanhadas de regeneração e revisão dos testes em `src/adapters/outbound/campus-map/__tests__` e `src/modules/campus-map/domain/__tests__`.

O Lago dos Peixinhos usa um símbolo original gerado por [schematic-lake.cjs](schematic-lake.cjs), sob a GPL-3.0 do projeto. O octógono é calculado apenas a partir da extensão do pátio A–B: sua forma, seu tamanho e seu centro não representam medidas ou a posição exata do lago. O contorno anteriormente traçado sobre ortofotos foi removido das fontes atuais e do atlas. O GeoJSON mantém uma cópia do símbolo em WGS84, verificada pelos testes contra o atlas; ao mudar a geometria do pátio, essa cópia também precisa ser atualizada.

## Pontos de ônibus

Os 12 pontos do lado da UERJ, a até uns 200 m de um portão, vêm da camada [Pontos de Parada da rede de ônibus (SPPO)](https://www.arcgis.com/home/item.html?id=fd07613c9a1c45299389c0f7cff8e2a0) da Prefeitura do Rio/SMTR (CC BY 4.0), conferida em 19/11/2026. Os pontos do outro lado da linha do trem, na Mangueira, ficaram de fora. O código da parada e a rua de cada um ficam à mão em `data/pontos-onibus.json`; a rua veio do eixo de via mais perto no OpenStreetMap. O portão mais perto é calculado na geração.

As linhas e os destinos vêm do [GTFS dos ônibus](https://www.arcgis.com/home/item.html?id=b577e4c4c0924888823b630bbdb2c6fd) da SMTR (CC BY 4.0). Para atualizar, baixe o `gtfs.zip` de `https://dados.mobilidade.rio/gtfs/schedule`, extraia numa pasta à parte e rode, com a data dos arquivos do zip:

```sh
node scripts/campus-map/import-bus-stops.cjs --gtfs <pasta> --data AAAA-MM-DD
node scripts/generate-campus-map.cjs
```

O importador grava o nome oficial, a posição e, para cada linha, os destinos das viagens que passam ali (as que terminam no ponto não contam). Ele falha se uma parada sumir do GTFS ou ficar sem linhas. A tela do mapa mostra as duas datas e pede para conferir no ponto.

Para os pontos aparecerem sobre uma rua, a Av. Prof. Manoel de Abreu e o trecho do Boulevard 28 de Setembro (com a continuação da R. Radialista Waldir Amaral) vão além da janela das outras ruas em `data/esquema-pavilhao.json`, com os eixos do OpenStreetMap.

## Proveniência

A [proveniência das medidas](PLANTA.md) registra o levantamento de 13/10/2026, suas fontes e limites. Os dados preservam a atribuição do IPP/Prefeitura do Rio (CC BY 4.0), da SMTR/Prefeitura do Rio (CC BY 4.0) e do OpenStreetMap (ODbL). As cinco salas numeradas na planta DAENG têm limites documentados; as demais divisões são modeladas. As bibliotecas do C são zonas, sem porta confirmada. Mudanças posteriores no prédio exigem nova conferência.
