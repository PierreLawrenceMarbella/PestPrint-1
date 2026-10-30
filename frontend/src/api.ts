import { isClassId, type ClassId } from "./data";

export interface Prediction {
  prediction: ClassId;
  confidence: number;
  probabilities: Partial<Record<ClassId, number>>;
  model: string;
  unknown_method: string;
}
export interface ModelStatus {
  available: boolean;
  message: string;
  classes: ClassId[];
}
export async function getModelStatus(
  signal: AbortSignal,
): Promise<ModelStatus> {
  const response = await fetch("/api/health", { signal });
  if (!response.ok)
    throw new Error(
      "Unable to connect to the analysis service. Please check that the backend is running.",
    );
  const data = await response.json();
  if (
    typeof data.available !== "boolean" ||
    typeof data.message !== "string" ||
    !Array.isArray(data.classes) ||
    data.classes.length === 0 ||
    new Set(data.classes).size !== data.classes.length
  )
    throw new Error("The analysis service returned an invalid status.");
  if (!data.classes.every(isClassId))
    throw new Error(
      "The connected model's categories do not match this website. Please check the model configuration.",
    );
  return data;
}
export async function analyzeImage(
  file: File,
  signal: AbortSignal,
  supportedClasses?: ClassId[],
): Promise<Prediction> {
  // Require exactly the advertised model outputs. Do not add absent categories
  // as zero-probability bars or derive Unknown from a confidence threshold.
  const modelClasses =
    supportedClasses ?? (await getModelStatus(signal)).classes;
  const form = new FormData();
  form.append("image", file);
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      body: form,
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Could not reach the analysis service. Check your connection and try again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The analysis service is unavailable. Please try again later.",
    );
  }
  if (!response.ok)
    throw new Error(data.error || "Analysis failed. Please try again.");
  const validProbability = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
  const ids =
    data.probabilities &&
    typeof data.probabilities === "object" &&
    !Array.isArray(data.probabilities)
      ? Object.keys(data.probabilities)
      : [];
  if (
    !isClassId(data.prediction) ||
    !modelClasses.includes(data.prediction) ||
    ids.length !== modelClasses.length ||
    !ids.every((id) => isClassId(id) && modelClasses.includes(id)) ||
    !validProbability(data.confidence) ||
    !data.probabilities ||
    !ids.every((id) => validProbability(data.probabilities[id])) ||
    Math.abs(ids.reduce((sum, id) => sum + data.probabilities[id], 0) - 1) >
      0.01 ||
    Math.abs(data.confidence - data.probabilities[data.prediction]) > 0.001
  ) {
    throw new Error(
      "The model returned an unsupported response. Please check the API configuration.",
    );
  }
  return data;
}
