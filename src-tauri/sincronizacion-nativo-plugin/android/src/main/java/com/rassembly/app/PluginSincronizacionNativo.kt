package com.rassembly.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.activity.result.ActivityResult
import org.json.JSONException
import org.json.JSONObject
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

private const val MAX_SYNC_BYTES = 64 * 1024 * 1024
private const val MAX_DATABASE_JSON_BYTES = 48 * 1024 * 1024
private const val KEY_ALIAS = "rassembly_sync_storage_v1"
private const val PAIRING_PREFIX = "RASM1"

@InvokeArg
class FileArgs {
    lateinit var uri: String
}

@InvokeArg
class WriteFileArgs {
    lateinit var uri: String
    lateinit var content: String
    lateinit var pairingCode: String
    var expectedVersion: Long? = null
    var expectedDigest: String? = null
}

@InvokeArg
class PairingArgs {
    lateinit var pairingCode: String
}

@InvokeArg
class KeyArgs {
    lateinit var fileId: String
}

@TauriPlugin
class PluginSincronizacionNativo(private val activity: Activity) : Plugin(activity) {
    @Command
    fun pickSyncFile(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(invoke, intent, "openFileResult")
    }

    @Command
    fun createSyncFile(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/octet-stream"
            putExtra(Intent.EXTRA_TITLE, "sincronizacion_global.rassembly")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(invoke, intent, "createFileResult")
    }

    @ActivityCallback
    fun openFileResult(invoke: Invoke, result: ActivityResult) = resolveSelectedFile(invoke, result)

    @ActivityCallback
    fun createFileResult(invoke: Invoke, result: ActivityResult) = resolveSelectedFile(invoke, result)

    private fun resolveSelectedFile(invoke: Invoke, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            invoke.reject("No se seleccionó ningún archivo.")
            return
        }
        val uri = result.data?.data
        if (uri == null) {
            invoke.reject("El selector no devolvió un archivo.")
            return
        }
        val grantedFlags = result.data?.flags ?: 0
        val persistableFlags = grantedFlags and
            (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        try {
            if (persistableFlags == 0) {
                invoke.reject("Android no concedió acceso de lectura o escritura al archivo.")
                return
            }
            activity.contentResolver.takePersistableUriPermission(uri, persistableFlags)
            val response = JSObject()
            response.put("uri", uri.toString())
            invoke.resolve(response)
        } catch (_: SecurityException) {
            invoke.reject("Android no pudo conservar el permiso del archivo seleccionado.")
        }
    }

    @Command
    fun readSyncFile(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(FileArgs::class.java)
            val uri = Uri.parse(args.uri)
            require(uri.scheme == "content") { "La URI guardada no es un documento SAF válido." }
            val input = activity.contentResolver.openInputStream(uri)
                ?: throw IOException("El proveedor no permitió abrir el archivo.")
            val content = input.use {
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                var total = 0
                while (true) {
                    val count = it.read(buffer)
                    if (count < 0) break
                    total += count
                    if (total > MAX_SYNC_BYTES) {
                        throw IOException("El archivo supera el límite de 64 MiB.")
                    }
                    output.write(buffer, 0, count)
                }
                output.toByteArray().toString(Charsets.UTF_8)
            }
            val response = JSObject()
            response.put("content", content)
            invoke.resolve(response)
        } catch (_: IOException) {
            invoke.reject("No se pudo leer el archivo seleccionado o el permiso ya no está disponible.")
        } catch (_: SecurityException) {
            invoke.reject("No se pudo leer el archivo seleccionado o el permiso ya no está disponible.")
        } catch (_: IllegalArgumentException) {
            invoke.reject("No se pudo leer el archivo seleccionado o el permiso ya no está disponible.")
        }
    }

    @Command
    fun writeSyncFile(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(WriteFileArgs::class.java)
            val uri = Uri.parse(args.uri)
            require(uri.scheme == "content") { "La URI guardada no es un documento SAF válido." }
            val bytes = args.content.toByteArray(Charsets.UTF_8)
            require(bytes.isNotEmpty()) { "No se permite guardar un archivo vacío." }
            require(bytes.size <= MAX_SYNC_BYTES) { "El archivo supera el límite de 64 MiB." }
            val newInfo = validateEnvelope(args.content, args.pairingCode)

            val currentBytes = activity.contentResolver.openInputStream(uri)?.use {
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                var total = 0
                while (true) {
                    val count = it.read(buffer)
                    if (count < 0) break
                    total += count
                    if (total > MAX_SYNC_BYTES) throw IOException("El archivo supera el límite permitido.")
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            } ?: throw IOException("El proveedor no permitió comprobar el archivo.")
            if (currentBytes.isEmpty()) {
                require(args.expectedVersion == null && args.expectedDigest == null && newInfo.second == 1L)
            } else {
                val currentText = currentBytes.toString(Charsets.UTF_8)
                val currentInfo = validateEnvelope(currentText, args.pairingCode)
                val currentDigest = MessageDigest.getInstance("SHA-256")
                    .digest(currentBytes)
                    .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
                if (args.expectedVersion != currentInfo.second || args.expectedDigest != currentDigest) {
                    throw IOException("SYNC_CONFLICT:${currentInfo.second}")
                }
                require(currentInfo.first == newInfo.first)
                if (newInfo.second <= currentInfo.second) {
                    throw IOException("SYNC_CONFLICT:${currentInfo.second}")
                }
            }
            val output = activity.contentResolver.openOutputStream(uri, "wt")
                ?: throw IOException("El proveedor no permitió abrir el archivo para escribir.")
            output.use { it.write(bytes) }
            invoke.resolve()
        } catch (error: IOException) {
            if (error.message?.startsWith("SYNC_CONFLICT:") == true) {
                invoke.reject(error.message)
            } else {
                invoke.reject("No se pudo escribir el archivo seleccionado o el permiso ya no está disponible.")
            }
        } catch (_: JSONException) {
            invoke.reject("El archivo de sincronización no tiene un formato válido.")
        } catch (_: SecurityException) {
            invoke.reject("No se pudo escribir el archivo seleccionado o el permiso ya no está disponible.")
        } catch (_: IllegalArgumentException) {
            invoke.reject("No se pudo escribir el archivo seleccionado o el permiso ya no está disponible.")
        }
    }

    @Command
    fun saveSyncKey(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(PairingArgs::class.java)
            val (fileId, key) = parsePairingCode(args.pairingCode)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, storageKey())
            val encrypted = cipher.doFinal(key)
            val stored = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" +
                Base64.encodeToString(encrypted, Base64.NO_WRAP)
            activity.getSharedPreferences("rassembly_sync_keys", Activity.MODE_PRIVATE)
                .edit()
                .putString(fileId, stored)
                .apply()
            invoke.resolve()
        } catch (_: GeneralSecurityException) {
            invoke.reject("No se pudo guardar la clave protegida de sincronización.")
        } catch (_: IOException) {
            invoke.reject("No se pudo guardar la clave protegida de sincronización.")
        } catch (_: IllegalArgumentException) {
            invoke.reject("No se pudo guardar la clave protegida de sincronización.")
        }
    }

    @Command
    fun getSyncKey(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(KeyArgs::class.java)
            require(args.fileId.matches(Regex("[a-f0-9]{32}"))) { "La identidad del archivo no es válida." }
            val stored = activity.getSharedPreferences("rassembly_sync_keys", Activity.MODE_PRIVATE)
                .getString(args.fileId, null)
            val response = JSObject()
            if (stored != null) {
                val parts = stored.split(":", limit = 2)
                require(parts.size == 2) { "La clave local protegida está corrupta." }
                val iv = Base64.decode(parts[0], Base64.NO_WRAP)
                val encrypted = Base64.decode(parts[1], Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, storageKey(), GCMParameterSpec(128, iv))
                val key = cipher.doFinal(encrypted)
                require(key.size == 32) { "La clave local protegida está corrupta." }
                response.put("pairingCode", "$PAIRING_PREFIX:${args.fileId}:${Base64.encodeToString(key, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)}")
            }
            invoke.resolve(response)
        } catch (_: GeneralSecurityException) {
            invoke.reject("No se pudo desbloquear la clave protegida de sincronización.")
        } catch (_: IOException) {
            invoke.reject("No se pudo desbloquear la clave protegida de sincronización.")
        } catch (_: IllegalArgumentException) {
            invoke.reject("No se pudo desbloquear la clave protegida de sincronización.")
        }
    }

    private fun decodeCompactFileId(value: String): String {
        val raw = Base64.decode(value, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        require(raw.size == 16) { "La identidad del código de vinculación no es válida." }
        return raw.joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }

    private fun parsePairingCode(code: String): Pair<String, ByteArray> {
        require(code.length <= 128) { "El código de vinculación no es válido." }
        val parts = code.split(":")
        require(parts.size == 3 && parts[0] == PAIRING_PREFIX) { "El código de vinculación no tiene un formato reconocido." }

        val fileId = if (parts[1].matches(Regex("[a-f0-9]{32}"))) {
            parts[1]
        } else {
            decodeCompactFileId(parts[1])
        }
        require(fileId.matches(Regex("[a-f0-9]{32}"))) { "La identidad del código de vinculación no es válida." }

        val key = Base64.decode(parts[2], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        require(key.size == 32) { "La clave del código de vinculación no tiene el tamaño esperado." }
        require(
            Base64.encodeToString(
                key,
                Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
            ) == parts[2]
        ) { "El código de vinculación no tiene una clave válida." }
        return Pair(fileId, key)
    }

    private fun validateEnvelope(text: String, pairingCode: String): Pair<String, Long> {
        require(text.toByteArray(Charsets.UTF_8).size <= MAX_SYNC_BYTES)
        val envelope = JSONObject(text)
        val envelopeFields = setOf("format_version", "file_id", "version", "nonce", "ciphertext")
        require(envelope.keys().asSequence().toSet() == envelopeFields)

        val formatVersion = envelope.get("format_version")
        val versionValue = envelope.get("version")
        require(formatVersion is Number && versionValue is Number)
        val fileId = envelope.getString("file_id")
        val versionText = versionValue.toString()
        require(formatVersion.toString() == "1" && fileId.matches(Regex("[a-f0-9]{32}")))
        require(versionText.matches(Regex("[1-9][0-9]*")))
        val version = versionText.toLongOrNull()
            ?: throw IllegalArgumentException("La versión del archivo no es válida.")
        val (pairingFileId, key) = parsePairingCode(pairingCode)
        require(pairingFileId == fileId)

        val nonceText = envelope.getString("nonce")
        val ciphertextText = envelope.getString("ciphertext")
        val nonce = Base64.decode(nonceText, Base64.DEFAULT)
        val ciphertext = Base64.decode(ciphertextText, Base64.DEFAULT)
        require(nonce.size == 12 && Base64.encodeToString(nonce, Base64.NO_WRAP) == nonceText)
        require(ciphertext.size in 16..MAX_SYNC_BYTES)
        require(Base64.encodeToString(ciphertext, Base64.NO_WRAP) == ciphertextText)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            SecretKeySpec(key, "AES"),
            GCMParameterSpec(128, nonce)
        )
        cipher.updateAAD("RAssembly sync\u00001\u0000$fileId\u0000$version".toByteArray(Charsets.UTF_8))
        val plaintext = cipher.doFinal(ciphertext)
        require(plaintext.size <= MAX_DATABASE_JSON_BYTES + 1024)

        val snapshot = JSONObject(plaintext.toString(Charsets.UTF_8))
        require(snapshot.keys().asSequence().toSet() == setOf("format_version", "database_json"))
        require(snapshot.getInt("format_version") == 1)
        val databaseJson = snapshot.getString("database_json")
        require(databaseJson.toByteArray(Charsets.UTF_8).size <= MAX_DATABASE_JSON_BYTES)
        val database = JSONObject(databaseJson)
        val requiredTables = setOf(
            "asambleas", "locales", "congregaciones", "personas", "programa",
            "asignaciones", "plantillas_cartas", "plantillas_email", "configuracion"
        )
        require(requiredTables.all { database.opt(it) is org.json.JSONArray })
        return Pair(fileId, version)
    }

    private fun storageKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null)
        if (existing is SecretKey) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}
