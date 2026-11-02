# Sincronización mediante archivo compartido

RAssembly sincroniza una instantánea cifrada a través de un único archivo elegido por la persona usuaria. Google Drive, OneDrive u otro proveedor se ocupa de compartirlo; RAssembly no usa sus APIs ni necesita credenciales de esos servicios.

## Windows y Android

- En Windows, **Seleccionar existente** y **Crear archivo** usan el selector de archivos de Tauri. La app solo lee o escribe el archivo elegido; no requiere acceso recursivo a carpetas.
- En Android, los mismos controles usan el Storage Access Framework (`ACTION_OPEN_DOCUMENT` / `ACTION_CREATE_DOCUMENT`). Se conserva el permiso persistente de la URI y los bytes se leen/escriben con `ContentResolver`; `content://` no se convierte a una ruta local.
- Si el proveedor revoca el permiso, el archivo desaparece o no permite escritura, la sincronización muestra un error y no registra una subida exitosa.

## Crear y vincular dispositivos

1. En el primer dispositivo, crea un archivo. RAssembly genera una identidad aleatoria y una clave aleatoria de 256 bits. La primera instantánea cifrada se guarda como versión **1**.
2. Conserva el código de seguridad mostrado y transfiérelo a cada dispositivo adicional por un canal externo confiable. El código contiene la identidad y la clave; trátalo como una credencial y no lo pegues en chats públicos.
3. En cada dispositivo adicional, selecciona el mismo archivo e introduce el código. RAssembly valida el código contra el contenido autenticado y guarda la clave local usando DPAPI en Windows o Android Keystore en Android.
4. Seleccionar un archivo con otra identidad nunca autoriza una subida. Hace falta vincularlo con su código. Un archivo vacío o de un formato anterior se informa como tal; no se inicializa ni se sobrescribe automáticamente.

Cada identidad tiene su propio contador local en SQLite, y el archivo contiene su versión. Cambiar de archivo no hereda el contador de otro. Tras una restauración, el contenido y el checkpoint (identidad, versión y huella) se guardan en la misma transacción SQLite antes de reiniciar la interfaz.

## Formato y consistencia

El formato actual es JSON `format_version: 1`: incluye identidad, versión, nonce y ciphertext AES-256-GCM. La identidad y la versión se pasan como associated data del AEAD. Alterar cualquiera de esos metadatos invalida la autenticación. El lector valida el esquema, tamaños, nonce, identidad, versión, clave y contenido restaurable; no acepta campos extra ni formatos desconocidos.

RAssembly exporta JSON desde una transacción de lectura SQLite sobre la conexión compartida. Todas las consultas que forman la instantánea ven el mismo snapshot, incluidos los cambios confirmados desde el WAL; no se copian directamente los archivos `.db`, `-wal` o `-shm`.

La app revisa el archivo al abrir y periódicamente, y espera antes de subir después de cambios locales. Antes de escribir, compara el contenido de la base local con la instantánea compartida: si son iguales, no escribe ni incrementa la versión. Así, un dispositivo que solo comprueba o sincroniza sin cambios conserva intacta la última versión que otro dispositivo subió. Si hay cambios locales y su checkpoint coincide con el archivo compartido, publica una versión nueva. Si el checkpoint difiere de la versión o huella compartida, detiene la subida y permite restaurar la versión compartida o confirmar expresamente una sobrescritura. Al vincular un dispositivo adicional, restaura primero la versión compartida para que su base local y checkpoint partan de esa versión; después, solo sus cambios locales podrán generar una nueva subida.

Los proveedores de archivos no ofrecen compare-and-swap entre dispositivos; si dos dispositivos escriben exactamente al mismo tiempo, la huella permite detectar después que el contenido cambió, pero no puede impedir la carrera en el proveedor. En ese caso revisa el conflicto antes de volver a sincronizar.

Los archivos de la versión anterior, sin este esquema autenticado, no se migran automáticamente. Exporta una copia manual compatible antes de dejar de usar una instalación anterior.

## Protección de claves y límites

Las claves de sincronización de archivo no se guardan en `localStorage`, el archivo compartido ni el bundle web. Windows las protege con DPAPI vinculada a la cuenta actual; Android usa una clave AES-GCM no exportable de Android Keystore y guarda el valor cifrado en el almacenamiento privado de la app. El código de vinculación se muestra solo al crear el archivo para permitir la transferencia externa.

No se deben compilar credenciales compartidas en el frontend. El servicio de sincronización de servidor que ya existía requiere que el backend autorice mediante el token de sesión del usuario; la app ya no incluye el token compartido que antes estaba embebido en el cliente. Si el servidor aún lo exige, ese flujo debe actualizarse en el backend antes de volver a usarlo.

La integración nativa de almacenamiento protegido está implementada para Windows y Android. En otros sistemas, la sincronización de archivo informa que no hay un almacén seguro de claves disponible.
