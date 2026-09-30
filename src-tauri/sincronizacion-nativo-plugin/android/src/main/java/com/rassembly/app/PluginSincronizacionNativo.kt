package com.rassembly.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.documentfile.provider.DocumentFile
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.annotation.ActivityCallback
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import app.tauri.plugin.JSObject
import app.tauri.annotation.InvokeArg

@TauriPlugin
class PluginSincronizacionNativo(private val activity: Activity) : Plugin(activity) {

    private val ARCHIVO_SYNC = "sincronizacion_global.rassembly"

    @Command
    fun elegirCarpeta(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
        }
        startActivityForResult(invoke, intent, "resultadoElegirCarpeta")
    }

    @ActivityCallback
    fun resultadoElegirCarpeta(invoke: Invoke, result: ActivityResult) {
        if (result.resultCode == Activity.RESULT_OK) {
            val uri: Uri? = result.data?.data
            if (uri == null) {
                invoke.reject("No se seleccionó ninguna carpeta")
                return
            }

            try {
                val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                activity.contentResolver.takePersistableUriPermission(uri, takeFlags)

                val obj = JSObject()
                obj.put("uri", uri.toString())
                invoke.resolve(obj)
            } catch (e: Exception) {
                invoke.reject("No se pudo conservar el permiso de la carpeta: ${e.message}")
            }
        } else {
            invoke.resolve(JSObject())
        }
    }

    @Command
    fun validarCarpeta(invoke: Invoke) {
        try {
            val parametros = invoke.parseArgs(ParametrosCarpeta::class.java)
            val uriCarpetaStr = parametros.uriCarpeta
            val archivo = parametros.archivo ?: ARCHIVO_SYNC

            if (uriCarpetaStr.isNullOrEmpty()) {
                return invoke.reject("Falta la carpeta")
            }

            val dir = DocumentFile.fromTreeUri(activity, Uri.parse(uriCarpetaStr))
                ?: return invoke.reject("Carpeta no válida")
            val target = dir.findFile(archivo) ?: return invoke.reject("Archivo no encontrado")
            val mtime = target.lastModified()

            val obj = JSObject()
            obj.put("exists", true)
            obj.put("mtime", mtime)
            invoke.resolve(obj)
        } catch (e: Exception) {
            invoke.reject("No se pudo validar: ${e.message}")
        }
    }

    @Command
    fun leerArchivo(invoke: Invoke) {
        try {
            val parametros = invoke.parseArgs(ParametrosCarpeta::class.java)
            val uriCarpetaStr = parametros.uriCarpeta
            val archivoNombre = parametros.archivo ?: ARCHIVO_SYNC

            if (uriCarpetaStr.isNullOrEmpty()) {
                return invoke.reject("Falta la ruta")
            }

            val dir = DocumentFile.fromTreeUri(activity, Uri.parse(uriCarpetaStr))
                ?: return invoke.reject("La carpeta seleccionada no es válida")

            if (!dir.exists() || !dir.canRead()) {
                return invoke.reject("No hay acceso de lectura a la carpeta compartida")
            }

            val archivo = dir.findFile(archivoNombre)
                ?: return invoke.reject("El archivo de sincronización no existe dentro de la carpeta")

            val input = activity.contentResolver.openInputStream(archivo.uri)
                ?: return invoke.reject("No se pudo abrir el archivo de sincronización para lectura")

            val contenido = input.bufferedReader().use { it.readText() }

            val obj = JSObject()
            obj.put("contenido", contenido)
            invoke.resolve(obj)
        } catch (e: Exception) {
            invoke.reject("Error leyendo el archivo de sincronización: ${e.message}")
        }
    }

    @Command
    fun escribirArchivo(invoke: Invoke) {
        try {
            val parametros = invoke.parseArgs(ParametrosEscritura::class.java)
            val uriCarpetaStr = parametros.uriCarpeta
            val contenidoStr = parametros.contenido
            val archivoNombre = parametros.archivo ?: ARCHIVO_SYNC

            if (uriCarpetaStr.isNullOrEmpty()) {
                return invoke.reject("Falta la ruta")
            }
            if (contenidoStr.isNullOrEmpty()) {
                return invoke.reject("Falta el contenido")
            }

            val dir = DocumentFile.fromTreeUri(activity, Uri.parse(uriCarpetaStr))
                ?: return invoke.reject("La carpeta seleccionada no es válida")

            if (!dir.exists() || !dir.canWrite()) {
                return invoke.reject("No hay acceso de escritura a la carpeta compartida")
            }

            var archivo = dir.findFile(archivoNombre)
            if (archivo == null) {
                archivo = dir.createFile("application/octet-stream", archivoNombre)
            }

            if (archivo == null) {
                return invoke.reject("No se pudo crear el archivo sincronizado dentro de la carpeta")
            }

            activity.contentResolver.openOutputStream(archivo.uri, "wt")?.use { stream ->
                stream.write(contenidoStr.toByteArray(Charsets.UTF_8))
            } ?: return invoke.reject("No se pudo abrir el flujo de escritura del archivo")

            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Error escribiendo el archivo de sincronización: ${e.message}")
        }
    }

    @Command
    fun guardarContenidoBase64(invoke: Invoke) {
        try {
            val parametros = invoke.parseArgs(ParametrosRespaldo::class.java)
            val uri = Uri.parse(parametros.uriDestino)
            if (uri.scheme != "content") {
                return invoke.reject("El destino elegido no es una ubicación SAF válida")
            }

            val bytes = Base64.decode(parametros.contenidoBase64, Base64.DEFAULT)
            activity.contentResolver.openOutputStream(uri, "wt")?.use { stream ->
                stream.write(bytes)
            } ?: return invoke.reject("No se pudo abrir el destino para guardar el respaldo")

            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Error guardando el respaldo: ${e.message}")
        }
    }
}

@InvokeArg
class ParametrosCarpeta {
    var uriCarpeta: String? = null
    var archivo: String? = null
}

@InvokeArg
class ParametrosEscritura {
    var uriCarpeta: String? = null
    var contenido: String? = null
    var archivo: String? = null
}

@InvokeArg
class ParametrosRespaldo {
    lateinit var uriDestino: String
    lateinit var contenidoBase64: String
}