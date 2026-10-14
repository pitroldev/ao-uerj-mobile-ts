# Diretrizes visuais do AO UERJ

O app preserva sua identidade: azul institucional no cabeçalho e menu, painel com canto superior esquerdo amplo, logo AO e canto superior direito reto em campos e cards. O visual deve continuar reconhecível como AO UERJ.

As fontes atuais são [PRODUCT.md](../PRODUCT.md), os [tokens](../src/themes/tokens.ts), os temas [claro](../src/themes/light.ts) e [escuro](../src/themes/dark.ts), e os componentes em `src/components/ui`. Os dados fictícios de desenvolvimento ficam em [demo/data.ts](../src/adapters/outbound/demo/data.ts).

- Dar prioridade à informação que responde à tarefa: próxima aula, nota, sala, posição no RID ou progresso.
- Usar português brasileiro direto, vocabulário acadêmico da UERJ e status identificáveis por texto ou ícone além da cor.
- Reutilizar campos, botões, chips, listas, folhas inferiores e estados do app. Reservar cards para agrupamentos reais.
- Manter claro e escuro com contraste legível, alvos de pelo menos 48 dp e texto que respeite a fonte do sistema.
- Validar telas entre 320 e 390 dp, inclusive fonte ampliada, nomes longos, teclado, carregamento, vazio, falha e dados salvos.
- Preservar o caráter não oficial do app e a indicação de CR aproximado; não inventar dados ou alegações.
- Usar movimento apenas para comunicar estado e respeitar a preferência por movimento reduzido.

As decisões de cada tela ficam nos arquivos `DESIGN.md` locais. O [mapa](../src/pages/CampusMap/DESIGN.md) também documenta fidelidade geométrica, origem das posições e limites das fontes.
