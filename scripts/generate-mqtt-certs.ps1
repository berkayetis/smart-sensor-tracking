param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$certDir = Join-Path $repoRoot "docker\mosquitto\certs"
$requiredFiles = @("ca.crt", "server.crt", "server.key")

New-Item -ItemType Directory -Path $certDir -Force | Out-Null

$allRequiredExist = $true
foreach ($file in $requiredFiles) {
    if (-not (Test-Path (Join-Path $certDir $file))) {
        $allRequiredExist = $false
        break
    }
}

if ($allRequiredExist -and -not $Force) {
    Write-Host "MQTT cert dosyalari zaten var: $certDir"
    Write-Host "Yeniden uretmek icin komutu -Force ile calistir."
    exit 0
}

$generatedFiles = @(
    "ca.key",
    "ca.crt",
    "ca.srl",
    "server.key",
    "server.csr",
    "server.crt"
)

foreach ($file in $generatedFiles) {
    Remove-Item (Join-Path $certDir $file) -Force -ErrorAction SilentlyContinue
}

$opensslScript = @'
set -eu
cd /certs

openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
  -keyout ca.key \
  -out ca.crt \
  -subj "/CN=SmartSensor Local CA"

openssl req -newkey rsa:2048 -sha256 -nodes \
  -keyout server.key \
  -out server.csr \
  -subj "/CN=mosquitto"

openssl x509 -req -in server.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 825 -sha256

chmod 600 ca.key server.key || true
'@

Write-Host "MQTT cert dosyalari uretiliyor..."

$opensslCommand = Get-Command openssl -ErrorAction SilentlyContinue
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue

if ($opensslCommand) {
    $opensslConfig = Join-Path $certDir "openssl.cnf"
    if (-not (Test-Path $opensslConfig)) {
        throw "Yerel OpenSSL fallback icin openssl.cnf bulunamadi: $opensslConfig"
    }

    Push-Location $certDir
    try {
        & openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes -keyout ca.key -out ca.crt -subj "/CN=SmartSensor Local CA" -config "$opensslConfig"
        & openssl req -newkey rsa:2048 -sha256 -nodes -keyout server.key -out server.csr -subj "/CN=mosquitto" -config "$opensslConfig"
        & openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 825 -sha256
    }
    finally {
        Pop-Location
    }
}
elseif ($dockerCommand) {
    docker run --rm -v "${certDir}:/certs" alpine:3.20 sh -ec "apk add --no-cache openssl >/dev/null && $opensslScript"
}
else {
    throw "Ne 'docker' ne de 'openssl' bulundu. Cert uretimi icin en az biri gerekli."
}

foreach ($file in $requiredFiles) {
    if (-not (Test-Path (Join-Path $certDir $file))) {
        throw "Beklenen dosya olusmadi: $file"
    }
}

Write-Host "Tamamlandi. Uretilen temel dosyalar: ca.crt, server.crt, server.key"
Write-Host "Not: Private key dosyalari git'e eklenmemelidir."
