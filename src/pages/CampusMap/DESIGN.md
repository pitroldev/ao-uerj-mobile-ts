---
name: AO UERJ — Mapa do campus
description: Consulta móvel do campus, plantas de andar e orientação até salas.
---

# Design System: Mapa do campus

## Overview

Registro local de [CampusMap.tsx](CampusMap.tsx), [CampusCanvas.tsx](CampusCanvas.tsx) e [FloorPlanCanvas.tsx](FloorPlanCanvas.tsx). Preserva o cabeçalho azul, o painel com curva superior esquerda e a linguagem direta do AO UERJ.

## Colors

Os temas [claro](../../themes/light.ts) e [escuro](../../themes/dark.ts) governam os controles, a seleção e a planta. A paleta cartográfica local de `CampusCanvas` distingue terreno esverdeado, edifícios azulados, ruas e água nos dois temas. `selection` destaca o bloco; `fill` e `onFill`, o destino; `accent`, o trajeto.

## Typography

Reutiliza Inter e a escala de [tokens.ts](../../themes/tokens.ts): `titleS` para o destino (18/24), `body` para resultados (15/21), `meta` para localização (13/18), `caption` para origem e escala (12/16). Os pesos vêm das famílias estáticas do Inter. As particularidades do texto SVG estão no [registro nativo](DESIGN.native.md).

## Layout

No pavilhão selecionado, **Campus / Andar** alterna a visão geral e a planta. Campus mantém ruas, estações e entradas como referências. Andar oculta a busca e coloca seletores compactos de bloco e andar no topo; o rodapé reúne destino, ação de trajeto e origem da posição. A busca substitui o desenho por uma lista com filtros de categoria.

**Regra dos controles separados.** Escala, zoom e reenquadramento ficam abaixo do desenho, junto ao norte no Campus ou à legenda do trajeto no Andar. Busca e rodapé usam margens laterais de 16 dp; o desenho ocupa a largura disponível.

## Elevation & Depth

O mapa usa superfícies e contornos planos. O painel e as folhas inferiores herdam o tratamento de profundidade dos componentes existentes.

## Shapes

O painel mantém a curva superior esquerda de 48 dp. Busca e seletores respeitam os recuos compartilhados do painel: 32 dp no topo e 20 dp nas laterais. Campo e chips preservam o canto superior direito reto do app. A planta divide corredores longos em trechos com a mesma escala e indica explicitamente a extensão omitida.

## Components

- `TextField`, `FilterChip` e `ListRow` compõem busca e filtros; o filtro marcado também recebe um check.
- `SegmentedControl` alterna Campus/Andar. Botões de bloco e andar abrem listas em `BottomSheet`; a seleção atual fica destacada.
- A folha **Como chegar** reúne entrada pelo Portão 1 ou 5, passos e acesso à planta. Créditos e confiança aparecem de forma resumida; fontes e limites ficam na folha de informações.
- A planta distingue limites documentados de divisões deduzidas tracejadas. Sem posição sustentada pelo modelo, o trajeto termina no bloco. Sala sem letra pede a escolha do bloco.

## Do's and Don'ts

- **Do:** manter os tokens e componentes compartilhados como fonte de verdade.
- **Do:** preservar rótulos, proporções e a distinção entre localização e planta documentada.
- **Don't:** apresentar uma divisão deduzida ou um número sem registro como informação da planta oficial; usar apenas o [modelo e suas fontes](../../../scripts/campus-map/README.md).
