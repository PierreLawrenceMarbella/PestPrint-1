// Development test harness: Python-decoded pixels exercise the actual Java resampler.
// This does not substitute for Android BitmapFactory decoder tests.
import expo.modules.pestprintimage.PillowPreprocessor;
import java.io.*;
import java.nio.*;
import java.nio.file.*;

public class PreprocessHarness {
  public static void main(String[] args) throws Exception {
    for (String line : Files.readAllLines(Path.of(args[0]))) {
      String[] paths = line.split("\t");
      try (DataInputStream input = new DataInputStream(new BufferedInputStream(new FileInputStream(paths[0])))) {
        int width = input.readInt(), height = input.readInt(), orientation = input.readInt();
        int[] pixels = new int[width * height];
        for (int i = 0; i < pixels.length; i++) pixels[i] = (input.readUnsignedByte() << 16) | (input.readUnsignedByte() << 8) | input.readUnsignedByte();
        PillowPreprocessor.Pixels source = new PillowPreprocessor.Pixels() {
          public int width() { return width; }
          public int height() { return height; }
          public void row(int y, int[] destination) { System.arraycopy(pixels, y * width, destination, 0, width); }
          public void column(int x, int[] destination) { for (int y = 0; y < height; y++) destination[y] = pixels[y * width + x]; }
        };
        float[] data = PillowPreprocessor.toNchw(source, orientation);
        ByteBuffer bytes = ByteBuffer.allocate(data.length * 4).order(ByteOrder.LITTLE_ENDIAN);
        bytes.asFloatBuffer().put(data);
        Files.write(Path.of(paths[1]), bytes.array());
      }
    }
  }
}
