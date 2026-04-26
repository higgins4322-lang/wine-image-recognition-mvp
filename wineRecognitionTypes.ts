export type WineColor =
  | "red"
  | "white"
  | "rose"
  | "sparkling"
  | "dessert"
  | "fortified"
  | "unknown";

export type WineBottleCandidate = {
  producer: string | null;
  name: string | null;
  vintage: number | null;
  region: string | null;
  country: string | null;
  appellation: string | null;
  varietal: string | null;
  color: WineColor;
  confidence: number;
  uncertaintyNotes: string;
  rawLabelText: string;
};

export type WineRecognitionResult = {
  bottles: WineBottleCandidate[];
};
