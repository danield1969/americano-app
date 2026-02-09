
# Instrucciones de Despliegue para Americano App

Sigue estos pasos para subir tu aplicación al servicio de hosting.

## 1. Preparar los Archivos

El script `prepare_deployment.ps1` se encargará de construir tanto el cliente (React) como el servidor (Node.js/Express) y poner todo en una carpeta lista para subir.

Ejecuta el siguiente comando en tu terminal (PowerShell):

```powershell
.\prepare_deployment.ps1
```

Esto creará una nueva carpeta llamada `deployment` en la raíz de tu proyecto.

## 2. Subir al Servidor

La carpeta `deployment` contiene todo lo necesario para producción:
- `index.js` (y otros archivos .js): El servidor compilado.
- `public/`: La aplicación React compilada.
- `package.json`: Definición de dependencias.
- `.env`: Variables de entorno con las credenciales que proporcionaste (Base de datos, Puerto, etc.).

### Opción A: Hosting con soporte para Node.js (Recomendado/cPanel)

Si tu hosting tiene una opción llamada **"Setup Node.js App"** o similar en cPanel:

1.  Crea una nueva aplicación Node.js.
2.  Configura la **Application Root** (por ejemplo `americano`) y la **Application URL**.
3.  Configura el **Application Startup File** como `index.js`.
4.  Sube **todo el contenido** de la carpeta `deployment` a la carpeta raíz de la aplicación en el servidor (usando el Administrador de Archivos o FTP).
5.  En el panel de Node.js App, haz clic en **"Run NPM Install"** para instalar las dependencias (`mysql2`, `express`, etc.) en el servidor.
6.  Reinicia la aplicación.

### Opción B: VPS o Servidor Dedicado

1.  Sube la carpeta `deployment` a tu servidor.
2.  Entra por SSH a la carpeta.
3.  Ejecuta `npm install --production`.
4.  Ejecuta `npm start` (o usa PM2: `pm2 start index.js`).

## Notas Importantes

- **Base de Datos**: Asegúrate de haber ejecutado el script SQL proporcionado anteriormente en tu phpMyAdmin para crear las tablas.
- **Variables de Entorno**: El script ya ha generado un archivo `.env` con los datos de conexión que proporcionaste. Si necesitas cambiarlos, edita el archivo `.env` en el servidor después de subirlo.
- **Puerto**: El servidor está configurado para escuchar en el puerto definido en `.env` (3000 por defecto) o el que asigne el hosting automáticamente. Node.js en cPanel a menudo maneja esto automáticamente.

