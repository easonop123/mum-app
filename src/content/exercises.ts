import catalogue from './exercise-catalogue.json';
import { EXERCISE_IDS, type ExerciseId, type GoalId, type LocalizedText } from '../domain/types';

export interface ExerciseContent {
  id: ExerciseId;
  status: 'active';
  involvesStanding: boolean;
  unilateral: boolean;
  support: 'chair' | 'wall' | 'counter';
  name: LocalizedText;
  shortName: LocalizedText;
  supplied: { technique: string; benefit: string; ifNotSuitable: string };
  technique: LocalizedText;
  cues: { en: string[]; zh: string[] };
  repDefinition: LocalizedText;
  benefit: LocalizedText;
  ifNotSuitable: LocalizedText;
  goalLinks: Record<Exclude<GoalId, 'own'>, LocalizedText>;
}

function loadCatalogue(): Record<ExerciseId, ExerciseContent> {
  const byId = new Map<string, ExerciseContent>();
  for (const entry of catalogue.exercises as ExerciseContent[]) {
    if (entry.cues.en.length !== 3 || entry.cues.zh.length !== 3) {
      throw new Error(`Exercise ${entry.id} must have exactly three cues per language`);
    }
    byId.set(entry.id, entry);
  }
  const result = {} as Record<ExerciseId, ExerciseContent>;
  for (const id of EXERCISE_IDS) {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Missing exercise content for ${id}`);
    result[id] = entry;
  }
  if (byId.size !== EXERCISE_IDS.length) {
    throw new Error('Exercise catalogue contains entries that are not in the supplied program');
  }
  return result;
}

export const EXERCISES: Record<ExerciseId, ExerciseContent> = loadCatalogue();
export const CATALOGUE_VERSION: string = catalogue.catalogueVersion;
