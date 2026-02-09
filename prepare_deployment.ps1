
Write-Host "Iniciando preparación del despliegue..."

# 1. Definir rutas
$root = Get-Location
$clientDir = Join-Path $root "client"
$serverDir = Join-Path $root "server"
$deployDir = Join-Path $root "deployment"

# Limpiar directorio de despliegue si existe
if (Test-Path $deployDir) {
    Remove-Item $deployDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# 2. Construir Cliente (React)
Write-Host "Construyendo Cliente (React)..."
Set-Location $clientDir
# Asegurar dependencias
if (-not (Test-Path "node_modules")) {
    npm install
}
# Construir
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error al construir el cliente."
    exit 1
}

# 3. Construir Servidor (TypeScript)
Write-Host "Construyendo Servidor..."
Set-Location $serverDir
# Asegurar dependencias
if (-not (Test-Path "node_modules")) {
    npm install
}
# Compilar TS
npx tsc
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error al compilar el servidor."
    exit 1
}

# 4. Copiar archivos compilados del servidor
Write-Host "Copiando archivos del servidor..."
Copy-Item -Path "$serverDir\dist\*" -Destination $deployDir -Recurse

# 5. Copiar build del cliente a la carpeta 'public' del servidor
Write-Host "Integrando cliente en servidor..."
$publicDir = Join-Path $deployDir "public"
New-Item -ItemType Directory -Path $publicDir | Out-Null
Copy-Item -Path "$clientDir\dist\*" -Destination $publicDir -Recurse

# 6. Crear package.json para producción
Write-Host "Creando package.json para producción..."
$serverPkg = Get-Content "$serverDir\package.json" | ConvertFrom-Json
$prodPkg = @{
    name = "americano-app"
    version = "1.0.0"
    scripts = @{
        start = "node index.js"
    }
    dependencies = $serverPkg.dependencies
}
$prodPkg | ConvertTo-Json -Depth 10 | Set-Content "$deployDir\package.json"

# 7. Crear archivo .env con las credenciales proporcionadas
Write-Host "Configurando variables de entorno..."
$envContent = @"
PORT=3000
DB_HOST=$($env:DB_HOST -ne $null ? $env:DB_HOST : "162.241.253.99")
DB_USER=$($env:DB_USER -ne $null ? $env:DB_USER : "wpctuimy_daniel")
DB_PASSWORD=$($env:DB_PASSWORD -ne $null ? $env:DB_PASSWORD : "YOUR_DB_PASSWORD")
DB_NAME=$($env:DB_NAME -ne $null ? $env:DB_NAME : "wpctuimy_americano_db")
"@
Set-Content "$deployDir\.env" -Value $envContent

# 8. Volver a la raíz
Set-Location $root

Write-Host "--------------------------------------------------------"
Write-Host "¡Despliegue preparado con éxito!"
Write-Host "Los archivos listos para subir están en la carpeta 'deployment'."
Write-Host "Sube el contenido de 'deployment' a tu servidor."
Write-Host "--------------------------------------------------------"
