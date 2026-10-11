# Diagnóstico da comunicação com o Aluno Online

Diagnóstico realizado em 11/10/2026 usando `AO_MATRICULA` e `AO_PASSWORD` do `.env`, sem gravar credenciais, cookies ou HTML autenticado em arquivos de teste.

## Causa reproduzida no portal real

O login inicial funciona. A perda do cookie de sessão faz uma consulta autenticada retornar **HTTP 200 com uma página de erro**, cujo título é “Sistema de Graduação da UERJ” e cujo conteúdo informa “Página não encontrada!”. O corpo observado tinha 2.083 caracteres e não continha formulário de login.

O interceptor anterior só detectava respostas vazias ou menores que 100 caracteres. Assim, essa página chegava aos parsers como se fosse uma consulta bem-sucedida. Na reprodução com o interceptor anterior, a consulta de notas passou de três disciplinas para uma lista vazia após descartar o cookie.

Há uma segunda falha: o novo login muda tanto `_token` quanto os códigos `requisicao`. O interceptor anterior reenviava a configuração antiga. No teste real, esse reenvio retornou HTTP 500 com corpo vazio; a consulta com os valores novos retornou HTTP 200 e as três disciplinas esperadas.

Os parsers de notas, horários, histórico e currículo processaram as respostas autenticadas atuais. Isso não permite atribuir o problema a uma mudança geral do layout do portal nem datar quando a recuperação de sessão começou a falhar.

## Correções

- Reconhecer a página específica de sessão inválida, o formulário de login e respostas vazias, inclusive com HTTP 200.
- Associar a consulta à chave semântica da requisição e resolver novamente seu código e token antes do envio. Para detalhes de disciplina, obter novamente o código derivado do formulário do currículo.
- Compartilhar a renovação entre chamadas concorrentes e limitar a repetição após uma resposta de sessão inválida. Propagar falhas de autenticação sem converter erros em listas vazias.
- Validar os campos obrigatórios do login e o menu antes de persistir a sessão; apresentar uma mensagem na tela quando o login lança uma exceção.
- Restringir o parser do RID à tabela de resultado provisório. O seletor anterior misturava disciplinas com outra tabela de recibos e avisos: retornava sete registros onde havia três disciplinas.

## Verificação reproduzível

As suítes Jest usam dados fictícios e não fazem requisições externas:

```powershell
pnpm test --runInBand
pnpm type-check
```

O diagnóstico real executa os módulos do app, substituindo apenas armazenamento e cookies nativos por implementações em memória para Node:

```powershell
pnpm diagnose:ao --expire-session
```

Esse comando autentica, consulta notas, horários, histórico, currículo, RID e detalhes de disciplina. Depois descarta seus cookies e verifica que tanto uma consulta comum quanto uma consulta com código derivado são recuperadas com um único novo login por expiração. As saídas contêm apenas etapas, contagens e códigos de erro. As contagens dependem da conta e do período acadêmico.

Na validação real da correção, todas essas consultas passaram; as duas recuperações de sessão fizeram exatamente um novo login cada. O diagnóstico completo realizou 23 requisições e três logins (o inicial e as duas renovações).

O diagnóstico exige Node.js 20.12+, dependências de desenvolvimento e `.env` local. Não deve ser colocado no CI comum nem usar credenciais em fixtures. Em instalações existentes, `npm test -- --runInBand`, `npm run type-check` e `npm run diagnose:ao -- --expire-session` também executam os comandos sem reinstalar dependências.

Testes Node/Jest e consultas ao portal não substituem uma execução em aparelho ou emulador: a camada de cookies e o transporte nativo de Android/iOS precisam dessa validação separada.
