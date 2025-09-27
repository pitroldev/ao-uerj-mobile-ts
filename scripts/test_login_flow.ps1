# Script para testar o fluxo de login do AO UERJ
# Replica o comportamento exato do app React Native

param(
  [string]$Matricula = "",
  [string]$Senha = ""
)

if (-not $Matricula -or -not $Senha) {
  Write-Host "Uso: .\test_login_flow.ps1 -Matricula 'XXXXXX' -Senha 'YYYYYYY'" -ForegroundColor Red
  exit 1
}

$headers = @{
  "Accept-Language" = "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
  "User-Agent"      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  "Content-Type"    = "application/x-www-form-urlencoded"
}

Write-Host "=== TESTE DO FLUXO DE LOGIN AO UERJ ===" -ForegroundColor Green

# Passo 1: Obter cookies iniciais
Write-Host "`n1. Obtendo cookies iniciais..." -ForegroundColor Yellow
$response1 = curl -s -c "cookies_test.txt" -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://www.alunoonline.uerj.br/"

if ($LASTEXITCODE -eq 0) {
  Write-Host "✓ Cookies iniciais obtidos" -ForegroundColor Green
}
else {
  Write-Host "✗ Erro ao obter cookies iniciais" -ForegroundColor Red
  exit 1
}

# Passo 2: Obter página de login
Write-Host "`n2. Obtendo página de login..." -ForegroundColor Yellow
$response2 = curl -s -b "cookies_test.txt" -c "cookies_test.txt" -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://www.alunoonline.uerj.br/requisicaoaluno/"

# Salvar página para análise
$response2 | Out-File -FilePath "login_page_test.html" -Encoding UTF8

$pageSize = (Get-Content "login_page_test.html" | Measure-Object -Line).Lines
Write-Host "✓ Página de login obtida ($pageSize linhas)" -ForegroundColor Green

# Passo 3: Extrair requisicao e _token
Write-Host "`n3. Extraindo tokens..." -ForegroundColor Yellow

$requisicaoMatch = Get-Content "login_page_test.html" | Select-String "name='requisicao'.*value='([^']+)'"
$tokenMatch = Get-Content "login_page_test.html" | Select-String "name=.?_token.?.*value=.?([^']+).?"

if ($requisicaoMatch -and $tokenMatch) {
  $requisicao = $requisicaoMatch.Matches[0].Groups[1].Value
  $token = $tokenMatch.Matches[0].Groups[1].Value

  Write-Host "✓ requisicao: $requisicao" -ForegroundColor Green
  Write-Host "✓ _token: $token" -ForegroundColor Green
}
else {
  Write-Host "✗ Erro ao extrair tokens da página" -ForegroundColor Red
  Write-Host "Página salva em: login_page_test.html" -ForegroundColor Yellow
  exit 1
}

# Passo 4: Tentar login
Write-Host "`n4. Tentando login com credenciais fornecidas..." -ForegroundColor Yellow

$loginUrl = "https://www.alunoonline.uerj.br/requisicaoaluno/?requisicao=$requisicao&matricula=$Matricula&senha=$Senha&_token=$token"

$response3 = curl -s -b "cookies_test.txt" -c "cookies_test.txt" -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -H "Content-Type: application/x-www-form-urlencoded" $loginUrl

# Salvar resultado para análise
$response3 | Out-File -FilePath "login_result_test.html" -Encoding UTF8

$resultSize = (Get-Content "login_result_test.html" | Measure-Object -Line).Lines
Write-Host "✓ Resposta do login obtida ($resultSize linhas)" -ForegroundColor Green

# Passo 5: Analisar resultado
Write-Host "`n5. Analisando resultado..." -ForegroundColor Yellow

# Procurar por indicadores de sucesso/falha
$errorIndicators = Get-Content "login_result_test.html" | Select-String "erro|inválid|incorret|negad|bloqueado|suspen" -AllMatches
$successIndicators = Get-Content "login_result_test.html" | Select-String "bem.*vindo|logado|período|matrícula.*$Matricula" -AllMatches

if ($errorIndicators) {
  Write-Host "✗ Possível erro detectado:" -ForegroundColor Red
  $errorIndicators | ForEach-Object { Write-Host "  - $($_.Line)" -ForegroundColor Red }
}
elseif ($successIndicators) {
  Write-Host "✓ Possível sucesso detectado:" -ForegroundColor Green
  $successIndicators | ForEach-Object { Write-Host "  - $($_.Line)" -ForegroundColor Green }
}
else {
  Write-Host "? Resultado inconclusivo - verificar arquivos manualmente:" -ForegroundColor Yellow
  Write-Host "  - login_page_test.html" -ForegroundColor Yellow
  Write-Host "  - login_result_test.html" -ForegroundColor Yellow
}

# Passo 6: Testar requisição autenticada
Write-Host "`n6. Testando requisição autenticada..." -ForegroundColor Yellow

$authTest = curl -s -b "cookies_test.txt" -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://www.alunoonline.uerj.br/requisicaoaluno/"

$authTest | Out-File -FilePath "auth_test_result.html" -Encoding UTF8
$authSize = (Get-Content "auth_test_result.html" | Measure-Object -Line).Lines

if ($authSize -gt 50) {
  Write-Host "✓ Sessão parece ativa (página com $authSize linhas)" -ForegroundColor Green
}
else {
  Write-Host "✗ Sessão pode ter expirado (página com apenas $authSize linhas)" -ForegroundColor Red
}

Write-Host "`n=== TESTE CONCLUÍDO ===" -ForegroundColor Green
Write-Host "Arquivos gerados:" -ForegroundColor Yellow
Write-Host "  - login_page_test.html (página de login original)" -ForegroundColor Yellow
Write-Host "  - login_result_test.html (resultado do login)" -ForegroundColor Yellow
Write-Host "  - auth_test_result.html (teste de sessão autenticada)" -ForegroundColor Yellow
Write-Host "  - cookies_test.txt (cookies da sessão)" -ForegroundColor Yellow

# Limpeza opcional
Remove-Item "cookies_test.txt", "login_page_test.html", "login_result_test.html", "auth_test_result.html" -ErrorAction SilentlyContinue
