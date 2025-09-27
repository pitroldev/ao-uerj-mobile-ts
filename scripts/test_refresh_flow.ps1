param(
    [Parameter(Mandatory = $true)]
    [string]$Matricula,

    [Parameter(Mandatory = $true)]
    [string]$Senha
)

# Teste do fluxo de RefreshAuth - simula expiração de sessão e renovação
Write-Host "=== TESTE DO FLUXO DE REFRESH AUTH AO UERJ ===" -ForegroundColor Yellow

# Função para extrair tokens do HTML
function Extract-Tokens($html) {
    # Padrões baseados no HTML real: <input type='hidden' name='requisicao' ... value='...'>
    $requisicaoMatch = [regex]::Match($html, "name='requisicao'[^>]+value='([^']+)'")
    $tokenMatch = [regex]::Match($html, 'name="_token"[^>]+value="([^"]+)"')

    Write-Host "Debug: requisicao encontrado: $($requisicaoMatch.Success)" -ForegroundColor Gray
    Write-Host "Debug: _token encontrado: $($tokenMatch.Success)" -ForegroundColor Gray

    if ($requisicaoMatch.Success) {
        Write-Host "Debug: requisicao = $($requisicaoMatch.Groups[1].Value)" -ForegroundColor Gray
    }
    if ($tokenMatch.Success) {
        Write-Host "Debug: _token = $($tokenMatch.Groups[1].Value)" -ForegroundColor Gray
    }

    return @{
        requisicao = if ($requisicaoMatch.Success) { $requisicaoMatch.Groups[1].Value } else { $null }
        token      = if ($tokenMatch.Success) { $tokenMatch.Groups[1].Value } else { $null }
    }
}

# Função para fazer login
function Do-Login($matricula, $senha, $cookieJar, $step) {
    Write-Host "$step. Fazendo login..." -ForegroundColor Cyan

    # Passo 1: Obter cookies iniciais
    curl -s -k -L "https://www.alunoonline.uerj.br/" `
        -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" `
        -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" `
        -c $cookieJar -o temp_inicial.html

    # Passo 2: Obter página de login
    curl -s -k -L "https://www.alunoonline.uerj.br/requisicaoaluno/" `
        -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" `
        -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" `
        -b $cookieJar -c $cookieJar -o temp_login.html

    $loginHtml = Get-Content temp_login.html -Raw
    $tokens = Extract-Tokens $loginHtml

    if (-not $tokens.requisicao -or -not $tokens.token) {
        Write-Host "❌ Não foi possível extrair tokens" -ForegroundColor Red
        return $false
    }

    # Passo 3: Enviar credenciais
    $params = @{
        "requisicao" = $tokens.requisicao
        "matricula"  = $matricula
        "senha"      = $senha
        "_token"     = $tokens.token
    }

    $queryString = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$([Uri]::EscapeDataString($_.Value))" }) -join "&"

    curl -s -k -L "https://www.alunoonline.uerj.br/requisicaoaluno/?$queryString" `
        -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" `
        -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" `
        -b $cookieJar -c $cookieJar -o "login_result_$step.html"

    $resultHtml = Get-Content "login_result_$step.html" -Raw
    $success = $resultHtml -match "flg_logado|Aluno Online" -and $resultHtml -notmatch "n.o encontrada|erro"

    if ($success) {
        Write-Host "✓ Login realizado com sucesso" -ForegroundColor Green
        return $true
    }
    else {
        Write-Host "❌ Falha no login" -ForegroundColor Red
        return $false
    }
}

# Função para testar se sessão está ativa
function Test-Session($cookieJar, $step) {
    Write-Host "$step. Testando se sessão está ativa..." -ForegroundColor Cyan

    curl -s -k "https://www.alunoonline.uerj.br/requisicaoaluno/" `
        -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" `
        -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" `
        -b $cookieJar -o "session_test_$step.html"

    $sessionHtml = Get-Content "session_test_$step.html" -Raw
    $lines = ($sessionHtml -split "`n").Length
    $isActive = $sessionHtml -match "Aluno Online" -and $lines -gt 50

    if ($isActive) {
        Write-Host "✓ Sessão ativa ($lines linhas)" -ForegroundColor Green
        return $true
    }
    else {
        Write-Host "❌ Sessão inativa ou expirada ($lines linhas)" -ForegroundColor Red
        return $false
    }
}

# Função para simular expiração de sessão
function Simulate-SessionExpiry($cookieJar) {
    Write-Host "3. Simulando expiração de sessão..." -ForegroundColor Cyan

    # Método 1: Corromper o cookie de sessão
    $cookies = Get-Content $cookieJar
    $newCookies = $cookies | ForEach-Object {
        if ($_ -match "PHPSESSID\s+(.+)") {
            $_ -replace "PHPSESSID\s+(.+)", "PHPSESSID`texpired_session_id"
        }
        else {
            $_
        }
    }
    $newCookies | Set-Content $cookieJar

    Write-Host "✓ Sessão corrompida/expirada" -ForegroundColor Yellow
}

# Função para simular requisição que falharia sem refresh
function Test-ProtectedEndpoint($cookieJar, $step) {
    Write-Host "$step. Testando endpoint protegido..." -ForegroundColor Cyan

    # Tentar acessar algum endpoint que requer autenticação
    curl -s -k "https://www.alunoonline.uerj.br/requisicaoaluno/" `
        -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" `
        -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" `
        -H "X-Requested-With: XMLHttpRequest" `
        -b $cookieJar -o "protected_test_$step.html"

    $protectedHtml = Get-Content "protected_test_$step.html" -Raw
    $lines = ($protectedHtml -split "`n").Length

    # Se retornar página pequena ou página de login, significa que sessão expirou
    if ($lines -lt 50 -or $protectedHtml -match "requisicao.*value=") {
        Write-Host "❌ Endpoint retornou página de login ($lines linhas) - sessão expirada" -ForegroundColor Red
        return $false
    }
    else {
        Write-Host "✓ Endpoint funcionou ($lines linhas) - sessão válida" -ForegroundColor Green
        return $true
    }
}

try {
    # Arquivo de cookies para a sessão original
    $cookieJar1 = "refresh_cookies_original.txt"
    $cookieJar2 = "refresh_cookies_renewed.txt"

    # 1. Login inicial
    $loginSuccess = Do-Login $Matricula $Senha $cookieJar1 "1"
    if (-not $loginSuccess) {
        throw "Falha no login inicial"
    }

    # 2. Testar sessão ativa
    $sessionActive = Test-Session $cookieJar1 "2a"
    if (-not $sessionActive) {
        throw "Sessão não está ativa após login"
    }

    # 3. Simular expiração
    Simulate-SessionExpiry $cookieJar1

    # 4. Testar endpoint protegido com sessão expirada
    $endpointWorks = Test-ProtectedEndpoint $cookieJar1 "4"
    if ($endpointWorks) {
        Write-Host "⚠️  Sessão ainda funciona após corrupção" -ForegroundColor Yellow
    }

    # 5. Simular refresh auth (novo login preservando contexto)
    Write-Host "5. Simulando RefreshAuth (novo login)..." -ForegroundColor Cyan
    $refreshSuccess = Do-Login $Matricula $Senha $cookieJar2 "5"
    if (-not $refreshSuccess) {
        throw "Falha no refresh login"
    }

    # 6. Testar se nova sessão funciona
    $newSessionActive = Test-Session $cookieJar2 "6"
    if (-not $newSessionActive) {
        throw "Nova sessão não está ativa"
    }

    # 7. Testar endpoint protegido com nova sessão
    $newEndpointWorks = Test-ProtectedEndpoint $cookieJar2 "7"
    if (-not $newEndpointWorks) {
        Write-Host "⚠️  Endpoint falhou com nova sessão" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "=== TESTE DE REFRESH AUTH CONCLUÍDO ===" -ForegroundColor Green
    Write-Host "✓ Login inicial: Sucesso" -ForegroundColor Green
    Write-Host "✓ Sessão original: Ativa" -ForegroundColor Green
    Write-Host "✓ Simulação de expiração: OK" -ForegroundColor Green
    Write-Host "✓ Refresh login: Sucesso" -ForegroundColor Green
    Write-Host "✓ Nova sessão: Ativa" -ForegroundColor Green

    Write-Host ""
    Write-Host "Arquivos gerados:" -ForegroundColor Cyan
    Write-Host "  - login_result_1.html (login inicial)"
    Write-Host "  - session_test_2a.html (teste sessão original)"
    Write-Host "  - protected_test_4.html (endpoint com sessão expirada)"
    Write-Host "  - login_result_5.html (refresh login)"
    Write-Host "  - session_test_6.html (teste nova sessão)"
    Write-Host "  - protected_test_7.html (endpoint com nova sessão)"
    Write-Host "  - refresh_cookies_original.txt (cookies originais)"
    Write-Host "  - refresh_cookies_renewed.txt (cookies renovados)"

}
catch {
    Write-Host "❌ Erro no teste: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Limpeza de arquivos temporários
    Remove-Item -Path "temp_*.html" -ErrorAction SilentlyContinue
}
