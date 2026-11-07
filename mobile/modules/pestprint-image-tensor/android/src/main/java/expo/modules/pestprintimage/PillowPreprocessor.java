package expo.modules.pestprintimage;

/** RGB bilinear resampling matching Pillow's separable, antialiased 8-bit pipeline.
 * The 22-bit coefficient convention and center/edge rules follow Pillow libImaging.
 * This class has no Android dependencies so its numeric output can be tested on a JVM.
 */
public final class PillowPreprocessor {
  public interface Pixels {
    int width();
    int height();
    void row(int y, int[] destination);
    void column(int x, int[] destination);
  }
  private static final int SIZE = 224;
  private static final int PRECISION = 22;

  private static final class Coefficients {
    final int[] starts;
    final int[][] values;
    Coefficients(int input, int output) {
      starts = new int[output];
      values = new int[output][];
      double scale = (double) input / output;
      double filterScale = Math.max(1.0, scale);
      double inverseFilterScale = 1.0 / filterScale;
      for (int out = 0; out < output; out++) {
        double center = (out + 0.5) * scale;
        int first = Math.max(0, (int) (center - filterScale + 0.5));
        int end = Math.min(input, (int) (center + filterScale + 0.5));
        starts[out] = first;
        double[] weights = new double[end - first];
        double sum = 0;
        for (int i = 0; i < weights.length; i++) {
          weights[i] = Math.max(0.0, 1.0 - Math.abs((first + i - center + 0.5) * inverseFilterScale));
          sum += weights[i];
        }
        values[out] = new int[weights.length];
        for (int i = 0; i < weights.length; i++) {
          values[out][i] = (int) (0.5 + weights[i] / sum * (1 << PRECISION));
        }
      }
    }
  }

  private static int component(long sum) {
    return (int) Math.max(0, Math.min(255, sum >> PRECISION));
  }

  public static float[] toNchw(Pixels source, int exifOrientation) {
    if (source.width() <= 0 || source.height() <= 0) throw new IllegalArgumentException("Invalid image dimensions");
    int orientation = exifOrientation >= 1 && exifOrientation <= 8 ? exifOrientation : 1;
    boolean transpose = orientation >= 5;
    int width = transpose ? source.height() : source.width();
    int height = transpose ? source.width() : source.height();
    Pixels oriented = new Pixels() {
      public int width() { return width; }
      public int height() { return height; }
      public void row(int y, int[] destination) {
        if (transpose) source.column(orientation >= 7 ? source.width() - 1 - y : y, destination);
        else source.row(orientation == 3 || orientation == 4 ? source.height() - 1 - y : y, destination);
        if (orientation == 2 || orientation == 3 || orientation == 6 || orientation == 7) reverse(destination);
      }
      public void column(int x, int[] destination) {
        if (transpose) source.row(orientation == 6 || orientation == 7 ? source.height() - 1 - x : x, destination);
        else source.column(orientation == 2 || orientation == 3 ? source.width() - 1 - x : x, destination);
        if (orientation == 3 || orientation == 4 || orientation == 7 || orientation == 8) reverse(destination);
      }
    };
    // Pillow 13 runs vertical first for strongly portrait downsampling. Keeping
    // this order matters because each intermediate pass rounds back to uint8.
    boolean verticalFirst = height - SIZE > 0 && height - SIZE > (width - SIZE) * 2;
    if (!verticalFirst) return resizeHorizontalFirst(oriented, false);
    Pixels swapped = new Pixels() {
      public int width() { return height; }
      public int height() { return width; }
      public void row(int y, int[] destination) { oriented.column(y, destination); }
      public void column(int x, int[] destination) { oriented.row(x, destination); }
    };
    return resizeHorizontalFirst(swapped, true);
  }

  private static void reverse(int[] values) {
    for (int i = 0, j = values.length - 1; i < j; i++, j--) {
      int value = values[i]; values[i] = values[j]; values[j] = value;
    }
  }

  private static float[] resizeHorizontalFirst(Pixels source, boolean transposedOutput) {
    int width = source.width(), height = source.height();
    Coefficients horizontal = new Coefficients(width, SIZE);
    Coefficients vertical = new Coefficients(height, SIZE);
    // One decoded source bitmap, one source row, and a narrow horizontal pass.
    int[] row = new int[width];
    int[] intermediate = new int[SIZE * height];
    for (int y = 0; y < height; y++) {
      source.row(y, row);
      for (int x = 0; x < SIZE; x++) {
        long red = 1 << (PRECISION - 1), green = red, blue = red;
        int[] coefficients = horizontal.values[x];
        for (int k = 0; k < coefficients.length; k++) {
          int index = horizontal.starts[x] + k;
          int pixel = row[index];
          int weight = coefficients[k];
          red += ((pixel >>> 16) & 255) * (long) weight;
          green += ((pixel >>> 8) & 255) * (long) weight;
          blue += (pixel & 255) * (long) weight;
        }
        intermediate[y * SIZE + x] = (component(red) << 16) | (component(green) << 8) | component(blue);
      }
    }
    float[] tensor = new float[3 * SIZE * SIZE];
    for (int y = 0; y < SIZE; y++) {
      for (int x = 0; x < SIZE; x++) {
        long red = 1 << (PRECISION - 1), green = red, blue = red;
        int[] coefficients = vertical.values[y];
        for (int k = 0; k < coefficients.length; k++) {
          int pixel = intermediate[(vertical.starts[y] + k) * SIZE + x];
          int weight = coefficients[k];
          red += ((pixel >>> 16) & 255) * (long) weight;
          green += ((pixel >>> 8) & 255) * (long) weight;
          blue += (pixel & 255) * (long) weight;
        }
        int index = transposedOutput ? x * SIZE + y : y * SIZE + x;
        tensor[index] = component(red) / 255.0f;
        tensor[SIZE * SIZE + index] = component(green) / 255.0f;
        tensor[2 * SIZE * SIZE + index] = component(blue) / 255.0f;
      }
    }
    return tensor;
  }
}
