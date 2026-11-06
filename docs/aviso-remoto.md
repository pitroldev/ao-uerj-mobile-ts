# Aviso remoto

O `config/app-status.json` da `main` chega a todos os apps instalados sem release nem revisão da Play. O app o busca na abertura, ao voltar ao primeiro plano e antes das verificações em segundo plano, no máximo a cada 15 minutos (ver [Dados e armazenamento](dados-e-armazenamento.md#para-o-github-aviso-remoto)). Por isso, uma mudança chega em cerca de 15 minutos a quem está com o app aberto.

- **Formato:** `config/app-status.schema.json`. A validação no app fica em `src/modules/delivery/domain/appStatus.ts`, e o teste dela confere o esquema.
- **Documento inválido:** é ignorado, e o app segue com a última cópia válida. Um aviso inválido some sozinho, sem derrubar o resto.
- **`schemaVersion`:** hoje é 1. Campos novos e opcionais não mudam a versão; outra versão faz o app ignorar o documento.

> [!CAUTION]
> Este arquivo vale na hora para todo mundo. Um `minSupportedVersion` errado pode prender alunos numa tela de bloqueio. Revise com cuidado e só mude o que você entende.

## Campos

### `notices`

Até 10 avisos no topo do Início, cada um com `id`, `level` (`info`, `warning` ou `critical`), `title` e `message`. Opcionais: `url` do "Saiba mais", `until` (data ISO 8601 em que o aviso some) e `platforms` (`android`, `ios`; sem a lista, vale para todas).

- O aluno pode dispensar cada aviso; para mostrá-lo de novo, troque o `id`.
- **Limites:** o `id` segue `^[a-z0-9][a-z0-9-]{0,63}$`, o `title` tem até 80 caracteres e a `message` até 400.
- **Texto seguro:** um título ou uma mensagem com algo que pareça endereço (o link vai só em `url`; até um ponto sem espaço depois, como "notas.Confira") ou com a palavra "senha" ou "password" descarta o aviso. O app só pede a senha na tela de Login.
- **Links:** só `https`, host em minúsculas, sem usuário nem porta, até 300 caracteres, para `uerj.br` e subdomínios, `pitrol.dev`, `github.com/pitroldev/ao-uerj-mobile-ts` e a página do app na Play. A lista fica em `LINK_DESTINATIONS` (`appStatus.ts`); mantenha o `pattern` de `url` no esquema igual a ela. O botão mostra o domínio antes de abrir.

### `disabledFeatures`

Marca telas do menu como indisponíveis, com um aviso no lugar do conteúdo: `notifications`, `documents`, `progress`, `graduation-plan`, `schedule-generator`, `message-board`, `subjects-taken`, `curriculum-subjects`, `universal-subjects`, `subject-search`, `teacher-search`, `companion` e `campus`.

Alguns param mais que a tela:

- **`notifications`:** cancela também os lembretes de aula e para a verificação no portal, na abertura do app ou na próxima verificação em segundo plano. Só com o lembrete de aula ligado não há verificação em segundo plano, e o cancelamento espera a abertura do app. Tudo volta quando o aluno abre o app depois da correção.
- **`companion`:** para também o "Me avise se tiver mesa". As mesas e os grupos em que o aluno está continuam valendo no horário combinado.
- **`campus`:** para também as leituras do Agora no campus em segundo plano.

### `minSupportedVersion`

Abaixo dessa versão (MAJOR.MINOR.PATCH, a do `package.json`), o app fica na tela de bloqueio com "Atualizar", mesmo sem rede, porque a cópia fica salva.

- No Android instalado pela Play, o bloqueio só aparece se a Play oferecer uma versão nova para o aparelho: abaixo da mínima, mas sem nada a instalar (rollout parcial, versão ainda não promovida, mínima errada), o app não bloqueia. No iOS e fora da Play, a versão mínima vale sozinha.
- Só suba o valor para uma versão que já esteja em produção na Play com rollout de 100%. O release publica no teste interno; antes da promoção, parte dos usuários ficaria sem ter o que instalar.

### `enrollment`

A época de inscrição: de `from` até `until` (datas ISO 8601, com o fuso, como `2026-11-03T00:00:00-03:00`), o grupo Inscrição do menu ganha a etiqueta "Época de inscrição". Fora dela, ou sem o campo, nada muda. O app ignora o campo se `until` não vier depois de `from` ou se a época passar de 60 dias.

### `tokenKeys`

Lista os ids (o SHA-256 do SPKI, em hex) das chaves do emissor dos tokens anônimos de aluno, que só os apps de 2.11.1 a 2.13 usam; o app atual entra com a sessão de aluno e não lê a lista.

- Esses apps só pedem tokens a uma chave da lista e, sem ela, não pedem nenhum.
- Na troca de chave, publique o id da nova antes de o servidor emitir com ela (sem isso, a reposição espera e tenta de novo depois de uma hora), e tire o da antiga quando ela vencer: os tokens dela saem do estoque.

## Endereço fixo

O URL está embutido em todo binário publicado (`src/adapters/outbound/delivery/remoteAppStatus.ts`):

```text
https://raw.githubusercontent.com/pitroldev/ao-uerj-mobile-ts/main/config/app-status.json
```

> [!WARNING]
> Não renomeie, transfira nem apague a conta `pitroldev` ou este repositório enquanto houver versões com esse endereço em uso.

## Pendência do responsável

A busca já está ativa, sem depender do DSN do Sentry. O GitHub já está na [política de privacidade](privacidade.md); falta incluí-lo na formalização da transferência internacional da LGPD.
