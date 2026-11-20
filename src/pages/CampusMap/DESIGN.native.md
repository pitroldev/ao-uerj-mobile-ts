# Mapa do campus — registro nativo

Complemento de [DESIGN.md](DESIGN.md); descreve a implementação React Native, sem criar tokens paralelos.

## Interação

- É o único recurso disponível sem conta, pelo botão **Explorar o mapa** na tela de entrada. O visitante tem um cabeçalho com retorno ao login, sem acesso ao menu ou à tela Sobre; as rotas privadas só são registradas após autenticação.
- SVG local com arraste, pinça e botões de zoom/reenquadramento; não depende de tiles remotos.
- Pan e pinça movem uma camada em cache na thread de UI com Gesture Handler/Reanimated. O SVG tem margem de 160 dp e redesenha perto dos limites do cache; a área de toque fica limitada à janela visível. O campus atualiza seus rótulos ao finalizar o arraste; a planta conserva o cache, e a pinça finaliza com texto nítido. A planta memoiza o desenho e agrupa segmentos de degraus, sem eliminar detalhes.
- Alvos nativos e botões têm pelo menos 48 dp. Em escala densa, os blocos se agrupam num alvo do pavilhão; a lista **Escolher bloco** permite a escolha individual.
- Campus aponta o norte para cima. Andar mantém F embaixo e A à direita; corredores longos usam recortes com a extensão omitida marcada. Seletores no topo e rodapé curto preservam espaço para a planta.
- Voltar fecha a busca ou limpa o destino. Selecionar um resultado dispensa o teclado; o rodapé respeita o inset inferior. Blocos, andares e instruções abrem em folhas inferiores.
- Texto nativo acompanha a escala do sistema. Texto SVG é cartográfico e não recebe essa ampliação; destino e instruções também aparecem nos componentes nativos. Rótulos ajustam-se ao espaço e ao zoom.

## Desempenho

Cada elemento do SVG é uma view nativa, e qualquer prop que muda rasteriza a camada inteira de novo (no Android, um bitmap do tamanho da camada, na thread de UI). O que custa é montar views, mudar props e rasterizar; o desenho segue quatro regras, cobertas por [redraw.test.tsx](__tests__/redraw.test.tsx) e [FloorPlanCanvas.test.tsx](__tests__/FloorPlanCanvas.test.tsx).

- **Medir antes de desenhar.** [usePlotSize](usePlotSize.ts) mede a área no `useLayoutEffect`, antes da pintura, e o desenho só existe depois da medida: o mapa é montado e rasterizado uma vez, já no tamanho certo, também quando o rodapé muda de altura com a seleção. O `onLayout` cobre o giro do aparelho e a janela dividida, e um tamanho que chega por ele só vale quando para de mudar (80 ms). Com o teclado na tela, a medida espera ele sair (até 1,2 s): escolher um resultado da busca fechava o teclado aos poucos, e o mapa era desenhado pequeno e refeito a cada passo. Com um palpite de tamanho, cada abertura montava e rasterizava o mapa duas vezes.
- **Atualizar no lugar.** A seleção muda a `resetKey` do desenho (a câmera volta ao enquadramento inicial), e não a `key`: tocar num lugar ou trocar de andar não desmonta as views. O `MapScreen` tem de continuar compilado pelo React Compiler. Ele desiste da tela inteira com uma função usada antes de declarada, e uma função escrita direto numa prop do desenho é outra a cada render; nos dois casos, abrir uma folha volta a refazer o mapa em JavaScript.
- **A câmera é uma transformação.** No campus, ruas, terreno, prédios e o trajeto de entrada ficam em metros ([campusGeometry](campusGeometry.ts), calculado uma vez por atlas), dentro de um grupo com a transformação da câmera. Um pan não muda nenhuma prop deles, e o nativo guarda os contornos já calculados; o zoom troca só as espessuras, que são em dp. Rótulos e marcadores continuam em coordenadas de tela.
- **Não criar o que o recorte esconde.** Na planta, cada recorte desenha só o que cruza a sua faixa (`crosses`), com os pilares num caminho só. No Bloco F isso levou a planta de 979 views para cerca de 200. Formas da mesma cor só se juntam quando não se tocam: juntar as que se tocam muda o antisserrilhado da emenda.

No Android, a própria biblioteca gastava mais da metade de um redesenho do campus fora do desenho: relia o arquivo da fonte do APK para cada texto (descompactar e interpretar, antes de olhar o próprio cache) e mandava um evento de layout por elemento, com ou sem alguém ouvindo. O [patch do react-native-svg](../../../patches/react-native-svg@15.16.0.patch) guarda a fonte já carregada e deixa o evento só no grupo raiz: o `onLayout` continua valendo no `Svg`, mas não nos elementos dentro dele.

O atlas (636 KB) é lido na primeira vez que uma tela pede, pelo `require` do adaptador, e não na abertura do app.

Uma mudança no desenho se confere em três frentes: as views criadas, mudadas e destruídas por interação (o renderer de teste marca cada operação com `globalThis.TEST_RENDERER_ENABLE_PROFILING`), o desenho antes e depois, convertendo a árvore do teste em SVG e comparando os pixels no Chrome, e o tempo de quadro no emulador, com `adb shell dumpsys gfxinfo com.aouerjmobile framestats` em volta de cada interação (o trecho de `DrawStart` a `SyncQueued` é o SVG virando bitmap).

Em 20/11/2026, no AVD de Android 13 com o APK de debug, um redesenho do campus levava cerca de 320 ms com a biblioteca como vem, 195 ms com o cache de fontes e 125 ms também sem os eventos de layout. Foi uma rodada só, e o debug interpreta o Java: o release é mais rápido. Em aparelho físico o tempo de quadro não foi medido.

## Dados e fidelidade

Regenerar o atlas com `node scripts/generate-campus-map.cjs`, na raiz. O [modelo de geração](../../../scripts/campus-map/README.md) usa fontes geométricas locais, sem HTML ou rede. São 79 plantas por bloco/andar e 3.202 destinos posicionáveis, além das ruas, circulação e pilares. A numeração modelada não representa levantamento físico de cada sala.

- **Documentado:** as cinco salas numeradas do 9º andar do D mantêm os limites e portas da DAENG (2024).
- **Deduzido:** divisões e números modelados permanecem distintos. `9019` e `9020` são rótulos deduzidos em cômodos sem número impresso na prancha oficial.
- **Zona:** bibliotecas do C têm área localizada, com indicação para seguir as placas até a entrada; não recebem uma porta confirmada.
- **Sem posição:** números fora da malha, módulos ocupados e exceções conhecidas recebem trajeto até o bloco, sem sala pintada.

As instruções incluem portão, hall do C, andar, ligações e referências do corredor. A passagem da entrada do F ao hall do C no térreo exige confirmação na portaria. Fontes históricas não comprovam alterações posteriores no prédio.

## Validação

`node scripts/generate-campus-map.cjs --check` verifica a correspondência exata entre fontes e atlas. `pnpm test --runInBand campus-map CampusMap` cobre geometria, salas oficiais, exceções, trajetos, enquadramento e interação.

Para alterações visuais, conferir Android em 390 dp/claro/fonte 1,0 e 320 dp/escuro/fonte 1,3: entrada sem conta, busca, instruções, zoom, plantas B/C/D/F e retorno com teclado. O mapa público deve continuar isolado das rotas privadas e limpar o destino ao trocar de conta.

iOS, TalkBack e aparelho físico não foram verificados. A tipografia cartográfica não define a escala de novos controles.
