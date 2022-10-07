export interface SubjectToTake {
  name: string;
  type: string;
  id: string;
  branch?: string;
  period: number | null;
  allow_conflict: boolean;
  minimum_credits: number;
  has_prerequisites: boolean;
  group?: string;
}
