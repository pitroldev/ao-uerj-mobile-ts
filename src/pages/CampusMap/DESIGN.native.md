# Mapa do campus — registro nativo

Complemento de [DESIGN.md](DESIGN.md); descreve a implementação React Native, sem criar tokens paralelos.

## Interação

- É o único recurso disponível sem conta, pelo botão **Explorar o mapa** na tela de entrada. O visitante tem um cabeçalho com retorno ao login, sem acesso ao menu ou à tela Sobre; as rotas privadas só são registradas após autenticação.
- SVG local com arraste, pinça e botões de zoom/reenquadramento; não depende de tiles remotos.
- Alvos nativos e botões têm pelo menos 48 dp. Em escala densa, os blocos se agrupam num alvo do pavilhão; a lista **Escolher bloco** permite a escolha individual.
- Campus aponta o norte para cima. Andar mantém F embaixo e A à direita; corredores longos usam recortes com a extensão omitida marcada. Seletores no topo e rodapé curto preservam espaço para a planta.
- Voltar fecha a busca ou limpa o destino. Selecionar um resultado dispensa o teclado; o rodapé respeita o inset inferior. Blocos, andares e instruções abrem em folhas inferiores.
- Texto nativo acompanha a escala do sistema. Texto SVG é cartográfico e não recebe essa ampliação; destino e instruções também aparecem nos componentes nativos. Rótulos ajustam-se ao espaço e ao zoom.

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
