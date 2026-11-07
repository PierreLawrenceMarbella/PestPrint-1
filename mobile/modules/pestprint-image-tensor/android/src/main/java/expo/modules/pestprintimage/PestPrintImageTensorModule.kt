package expo.modules.pestprintimage

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.SystemClock
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest

class PestPrintImageTensorModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext) { "Android context unavailable" }
  private fun digest(file: File): String {
    val hash = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) { val count = input.read(buffer); if (count < 0) break; hash.update(buffer, 0, count) }
    }
    return hash.digest().joinToString("") { "%02x".format(it) }
  }

  override fun definition() = ModuleDefinition {
    Name("PestPrintImageTensor")

    // AsyncFunction executes decoding/resampling/file I/O away from the JS/UI thread.
    AsyncFunction("prepareModelAsync") { filename: String, expectedBytes: Long, sha256: String ->
      require(filename == "efficientnet_b0_rice_pest.onnx" && sha256.matches(Regex("[a-f0-9]{64}"))) { "Invalid model manifest" }
      val directory = File(context.filesDir, "pestprint-models").apply { mkdirs() }
      val target = File(directory, "$sha256.onnx")
      if (target.exists() && (target.length() != expectedBytes || digest(target) != sha256)) target.delete()
      if (!target.exists()) {
        val temporary = File.createTempFile("model-", ".partial", directory)
        try {
          context.assets.open(filename).use { input -> temporary.outputStream().use { input.copyTo(it) } }
          require(temporary.length() == expectedBytes && digest(temporary) == sha256) { "Bundled model checksum mismatch" }
          require(temporary.renameTo(target)) { "Unable to prepare bundled model" }
        } finally { temporary.delete() }
      }
      target.absolutePath
    }

    AsyncFunction("preprocessAsync") { uriString: String ->
      try {
      val started = SystemClock.elapsedRealtime()
      val uri = Uri.parse(uriString)
      require(uri.scheme == "file" || uri.scheme == "content") { "Only local camera/gallery images are accepted" }
      val resolver = context.contentResolver
      // Validate compressed size without trusting gallery metadata.
      resolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "Cannot read image" }
        var total = 0L
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          total += count
          require(total <= 10L * 1024 * 1024) { "Choose an image up to 10 MB" }
        }
        require(total > 0) { "Image is empty" }
      }
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
      require(bounds.outMimeType == "image/jpeg" || bounds.outMimeType == "image/png") { "Choose a genuine JPG or PNG image" }
      require(bounds.outWidth > 0 && bounds.outHeight > 0 && bounds.outWidth.toLong() * bounds.outHeight <= 25_000_000L) { "Choose an image under 25 megapixels" }
      require(bounds.outWidth <= 16384 && bounds.outHeight <= 16384) { "Image dimensions are too large for this device" }
      val orientation = resolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "Cannot read EXIF data" }
        ExifInterface(input).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1)
      }
      val options = BitmapFactory.Options().apply {
        inPreferredConfig = Bitmap.Config.ARGB_8888
        inScaled = false
        inPremultiplied = false
        inSampleSize = 1
      }
      val bitmap = resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, options) }
        ?: throw IllegalArgumentException("Image cannot be decoded")
      val tensor = try {
        val pixels = object : PillowPreprocessor.Pixels {
          override fun width() = bitmap.width
          override fun height() = bitmap.height
          override fun row(y: Int, destination: IntArray) = bitmap.getPixels(destination, 0, bitmap.width, 0, y, bitmap.width, 1)
          override fun column(x: Int, destination: IntArray) = bitmap.getPixels(destination, 0, 1, x, 0, 1, bitmap.height)
        }
        PillowPreprocessor.toNchw(pixels, orientation)
      } finally { bitmap.recycle() }
      val directory = File(context.cacheDir, "pestprint-tensors").apply { mkdirs() }
      val output = File.createTempFile("crop-", ".f32", directory)
      try {
        val bytes = ByteBuffer.allocate(tensor.size * 4).order(ByteOrder.LITTLE_ENDIAN)
        bytes.asFloatBuffer().put(tensor)
        FileOutputStream(output).use { it.write(bytes.array()) }
        mapOf("uri" to Uri.fromFile(output).toString(), "bytes" to output.length(),
          "sourceWidth" to bounds.outWidth, "sourceHeight" to bounds.outHeight,
          "orientation" to orientation, "durationMs" to (SystemClock.elapsedRealtime() - started))
      } catch (error: Throwable) { output.delete(); throw error }
      } catch (error: OutOfMemoryError) {
        throw IllegalArgumentException("Not enough memory to decode this image. Choose a smaller rice crop photo.")
      }
    }

    AsyncFunction("deleteTensorAsync") { uriString: String ->
      val file = File(requireNotNull(Uri.parse(uriString).path))
      val directory = File(context.cacheDir, "pestprint-tensors").canonicalFile
      require(file.canonicalFile.parentFile == directory) { "Invalid tensor cache path" }
      file.delete()
      Unit
    }
  }
}
