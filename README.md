# AO UERJ

<!-- markdownlint-disable MD033 -->
<p align="center">
    <img src="resources/web_hi_res_512.png" alt="AO UERJ" width="128" height="128" />

</p>
<!-- markdownlint-enable MD033 -->

[![Google Play - Download](https://img.shields.io/badge/Google%20Play-Download-3DDC84?logo=google-play&logoColor=white)](https://play.google.com/store/apps/details?id=com.aouerjmobile)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.4-61dafb)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61dafb)](https://react.dev/)

Aplicativo não-oficial do Aluno Online (UERJ) para Android/iOS, escrito em TypeScript + React Native. Ele traz para o celular várias funcionalidades do portal oficial, além de recursos exclusivos como Gerador de Grade e Mural de Mensagens.

> Não-oficial • Depende do site do Aluno Online • Scraping controlado

---

## Sumário

- ℹ️ [Sobre o projeto](#sobre-o-projeto)
- ✨ [Funcionalidades](#funcionalidades)
- 🧠 [Como funciona (alto nível)](#como-funciona-alto-nível)
- 🔧 [Requisitos](#requisitos)
- ▶️ [Como rodar (dev)](#como-rodar-dev)
- 🏗️ [Arquitetura do código](#arquitetura-do-código)
- 🔐 [Privacidade e dados do usuário](#privacidade-e-dados-do-usuário)
- ⚠️ [Limitações conhecidas](#limitações-conhecidas)
- 🧰 [Troubleshooting / FAQ](#troubleshooting--faq)
- 🔗 [Links úteis](#links-úteis)

## Sobre o projeto

- Plataforma: React Native 0.81 + React 19, TypeScript
- Navegação: `@react-navigation`
- Estado: Redux Toolkit + `redux-persist`
- Dados/async: `react-query`
- UI: `styled-components`
- Parsing: `cheerio` para HTML scraping do Aluno Online.

Publicação: disponível na Google Play como “AO UERJ” — veja em: [play.google.com/store/apps/details?id=com.aouerjmobile](https://play.google.com/store/apps/details?id=com.aouerjmobile)

## Funcionalidades

Funcionalidades espelhadas do AO (via scraping):

- Início (Home):
    - RID Parcial (provisório)
    - Quadro de Notas (disciplinas em curso)
    - Quadro de Horários (disciplinas em curso)
    - Mensagens de estado (bloqueio do AO, período ainda não iniciado, dicas de recuperação de erro)
- Disciplinas Realizadas (histórico com período, créditos, carga horária, status)
- Disciplinas do Currículo (com filtros por tipo, cursadas/não cursadas, busca)
- Disciplinas Universais (com filtro por departamento/unidade)
- Pesquisa de Disciplina (detalhes, turmas, horários, professores, vagas)

Funcionalidades exclusivas do app (servidores próprios):

- Gerador de Grade (beta):
    - Recebe preferências do usuário (quantidade de disciplinas, horários ocupados, prioridades etc.)
    - Busca e processa dados do AO
    - Gera opções de grade sem salvar os dados do usuário no servidor
- Mural de Mensagens:
    - Canal de comunicação entre alunos da mesma turma
    - Mensagens trafegam por um servidor privado, não relacionadas ao AO oficial
- Relatório de Erros:
    - Reúne dados brutos de scraping para diagnóstico
    - Remove identificadores pessoais (nome, matrícula, etc.) antes do envio

## Como funciona (alto nível)

- Login/sessão: o app autentica no Aluno Online e mantém cookies/sessão.
- Coleta de dados: chamadas ao Aluno Online usam `UerjApi` com parâmetros específicos. O HTML retornado é parseado e transformado em estruturas tipadas.
- Camadas privadas: recursos de Mural de Mensagens, Gerador de Grade e Relatório de Erros utilizam `PrivateApi` apontando para um backend próprio.
- Resiliência: quando o Aluno Online muda o HTML, o app exibe mensagens de erro, sugere ações (atualizar, relogar, reinstalar) e disponibiliza reporte para ajuste rápido dos parsers.

## Requisitos

- Node.js LTS recente (>= 18 recomendado)
- Yarn ou npm
- Ambiente React Native:
    - Android: JDK 17 (ou compatível RN 0.81.4), Android SDK, emulador/dispositivo, Gradle (wrapper incluso)

## Como rodar (dev)

Instalar dependências

```pwsh
# na raiz do projeto
npm install
# ou
yarn
```

Android (emulador ou device)

```pwsh
npm run android
# ou
yarn android
```

Observação: se houver erros relacionados a SDK/NDK/Gradle/Java, ajuste localmente as versões para o ambiente RN 0.81.4.

## Arquitetura do código

- `src/pages/*`: telas de navegação (Home, Login, SubjectsTaken, CurriculumSubjects, UniversalSubjects, SubjectDetails, MessageBoard, ScheduleSimulator, About, etc.)
- `src/features/*`: módulos com lógica/coleta/parsing e UI específica (ex.: ClassGrades, PartialRID, AttendedClassesSchedule, SubjectsTaken, SubjectsToTake, CurriculumSubjects, UniversalSubjects, SubjectInfo, SubjectClassesSchedule, MessageBoard, ScheduleSimulator)
- `src/services/*`:
    - `UerjApi`: integração com AO (axios), utilitários de requisição (`getRequisitionID`, `retry`) e cookies
    - `PrivateApi`: integração com o backend próprio
- `src/reducers/*`: Redux Toolkit slices (apiConfig, userInfo, etc.)
- `src/themes/*`: tema e cores
- `src/utils/*`: normalização, horários, helpers
- `docs/*`: documentações sobre o projeto

Fluxo típico:

1. Tela dispara uma chamada HTTP por uma função `fetch*` da feature relacionada
2. `fetch*` chama `UerjApi` e recebe o HTML do Aluno Online
3. Parser transforma HTML em JSON estruturado e salva localmente ou retorna ao componente
4. UI atualiza com tratamento de erro e mensagens de estado

## Privacidade e dados do usuário

- Não há compartilhamento com terceiros.
- O app depende de scraping do Aluno Online e guarda somente o mínimo necessário em cache local.
- Mural de Mensagens, Gerador de Grade e Relatório de Erros utilizam servidores próprios do projeto.
- Relatório de Erros: remove dados identificáveis (ex.: matrícula, nome) antes de enviar para diagnóstico.
- Gerador de Grade: não persiste dados submetidos pelo usuário.

Consulte também a seção “Segurança dos dados” na página da Play Store do aplicativo.

## Limitações conhecidas

- Dependência total do HTML/fluxo do Aluno Online: alterações no site podem quebrar parsers.
- Durante bloqueios/manutenções do Aluno Online, o app pode ficar parcialmente indisponível.
- Parsers são atualizados continuamente; use o recurso de “Reportar erro” quando notar inconsistências.

## Troubleshooting / FAQ

- O app diz que o Aluno Online está indisponível. E agora?
    - Isso ocorre quando o site oficial muda o HTML ou está fora do ar. Aguarde e tente mais tarde. Se persistir, use “Reportar erro” na tela de "Sobre" do app.
- O Gerador de Grade envia meus dados para algum lugar?
    - Não. Os dados vão apenas para processamento temporário e não são salvos no servidor.

## Links úteis

- App na Google Play: [play.google.com/store/apps/details?id=com.aouerjmobile](https://play.google.com/store/apps/details?id=com.aouerjmobile)
- Site do Aluno Online (UERJ): [www.alunoonline.uerj.br](https://www.alunoonline.uerj.br/)
- Documentação React Native: [reactnative.dev](https://reactnative.dev/)
- Documentação React: [react.dev](https://react.dev/)
- TypeScript: [typescriptlang.org](https://www.typescriptlang.org/)

---

Dúvidas e suporte: abra uma issue ou utilize o recurso de relatório de erro pelo app. Sugestões são muito bem-vindas.
