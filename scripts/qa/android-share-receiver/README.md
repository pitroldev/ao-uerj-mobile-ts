# Receptor local de PNG para teste Android

Aplicativo auxiliar independente, sem dependências do AO UERJ, Gradle ou bibliotecas externas. Recebe `ACTION_SEND` com `image/png` para validar o compartilhamento até outro aplicativo Android. O manifest não solicita permissões de rede, armazenamento ou contatos; a imagem é lida e exibida em memória, sem upload nem cópia persistida.

## Compilar

Requisitos: Node.js, JDK 17, Android SDK Platform 36 e Build Tools 36.0.0. Configure `JAVA_HOME` e `ANDROID_SDK_ROOT` (ou `ANDROID_HOME`). A partir da raiz do repositório:

```sh
node scripts/qa/android-share-receiver/build.cjs --check
node scripts/qa/android-share-receiver/build.cjs
```

O script funciona em Windows, Linux e macOS por meio dos executáveis do SDK/JDK, sem shell intermediário. Compila Java e DEX, empacota, alinha e assina o APK com uma chave de teste gerada naquela execução. Todos os artefatos ficam em uma pasta temporária indicada na saída; nada é instalado automaticamente e nenhuma chave ou APK deve ser versionado. A senha pública `android` protege somente essa chave descartável de teste.

## Executar a jornada

1. Se houver uma versão anterior do receptor assinada por outro build, remova somente o helper com `adb -s SERIAL uninstall dev.aouerj.shareprobe`. Cada compilação gera uma chave diferente.
2. Instale o APK cujo caminho foi informado: `adb -s SERIAL install --no-incremental CAMINHO_DO_APK`. Use aspas se o caminho contiver espaços.
3. No AO UERJ, abra o horário e compartilhe a imagem. No seletor Android, escolha **AO PNG local**. Nenhuma opção de envio para terceiros é necessária.
4. Aguarde pelo menos 1,5 segundo. O receptor deve mostrar **PNG RECEBIDO E VALIDADO**, os metadados e a imagem. Confira visualmente se o horário aparece completo.
5. Toque em **Concluir teste local** para fechar o receptor e voltar ao app de origem.

Identificadores: pacote `dev.aouerj.shareprobe`, activity `dev.aouerj.shareprobe.ShareReceiverActivity`. A abertura pelo launcher mostra instruções; o teste exige a ação de compartilhamento do AO UERJ.

## Critérios e evidência

O receptor exige URI `content://`, MIME `image/png` no intent e `FLAG_GRANT_READ_URI_PERMISSION`. Lê no máximo 32 MiB, verifica os oito bytes da assinatura PNG, dimensões positivas e decodificação da imagem. Reabre a mesma URI após 1,5 segundo e compara os bytes; isso exercita a disponibilidade do arquivo depois de a escolha do destinatário resolver a promise de compartilhamento do app.

O resultado contém `ok: true`, `delayedReadMatches: true`, tamanho, dimensões e SHA-256. `providerMime` também é registrado para inspeção. A tag `AOShareProbe` do logcat registra esse JSON, sem bytes da imagem nem seu caminho completo:

```sh
adb -s SERIAL logcat -d -s AOShareProbe:I
```

Isso confirma entrega e leitura por um segundo aplicativo local. A conferência do conteúdo visual continua manual; o teste não verifica impressão, salvamento em galeria ou envio por aplicativos de terceiros. Depois da jornada, o helper pode ser removido com `adb -s SERIAL uninstall dev.aouerj.shareprobe`.
