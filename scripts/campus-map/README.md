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
| [room-model.cjs](room-model.cjs)                                 | Divisões de salas, portas, pilares e trajetos gerados a partir dessas medidas. |

O app carrega somente o atlas. O modelo de geração não contém telas, renderizador ou código de demonstração. Alterações nas fontes devem ser acompanhadas de regeneração e revisão dos testes em `src/adapters/outbound/campus-map/__tests__` e `src/modules/campus-map/domain/__tests__`.

O Lago dos Peixinhos usa um símbolo original gerado por [schematic-lake.cjs](schematic-lake.cjs), sob a GPL-3.0 do projeto. O octógono é calculado apenas a partir da extensão do pátio A–B: sua forma, seu tamanho e seu centro não representam medidas ou a posição exata do lago. O contorno anteriormente traçado sobre ortofotos foi removido das fontes atuais e do atlas. O GeoJSON mantém uma cópia do símbolo em WGS84, verificada pelos testes contra o atlas; ao mudar a geometria do pátio, essa cópia também precisa ser atualizada.

A [proveniência das medidas](PLANTA.md) registra o levantamento de 13/10/2026, suas fontes e limites. Os dados preservam a atribuição do IPP/Prefeitura do Rio (CC BY 4.0) e do OpenStreetMap (ODbL). As cinco salas numeradas na planta DAENG têm limites documentados; as demais divisões são modeladas. As bibliotecas do C são zonas, sem porta confirmada. Mudanças posteriores no prédio exigem nova conferência.
