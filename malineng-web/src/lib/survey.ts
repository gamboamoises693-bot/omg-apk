import { collection, doc, serverTimestamp, writeBatch, type Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface SurveyQuestion {
  text: string;
  options: string[];
}

export interface Survey {
  id: string;
  title: string;
  questions: SurveyQuestion[];
  status: "open" | "closed";
  /** Published summary for residents: { q0: [counts...], q1: [...] } (Firestore has no nested arrays). */
  results?: Record<string, number[]>;
  responseCount?: number;
  createdAt?: Timestamp;
  createdByName?: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  /** Index of the chosen option per question (-1 = skipped). */
  answers: number[];
  suggestion: string;
}

/**
 * Saves an anonymous answer: the response has no uid; a separate voters/{uid}
 * marker in the same batch makes the rules allow only one answer per person.
 */
export async function submitSurvey(surveyId: string, uid: string, answers: number[], suggestion: string): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, "surveys", surveyId, "voters", uid), { at: serverTimestamp() });
  batch.set(doc(collection(db, "surveyResponses")), { surveyId, answers, suggestion: suggestion.trim().slice(0, 500) });
  await batch.commit();
}

/** Counts per option for each question. */
export function tally(survey: Survey, responses: SurveyResponse[]): number[][] {
  return survey.questions.map((q, qi) => q.options.map((_, oi) => responses.filter((r) => r.answers[qi] === oi).length));
}
