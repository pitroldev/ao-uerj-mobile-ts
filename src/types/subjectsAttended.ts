export interface SubjectAttended {
  name: string;
  period: string;
  id: string;
  credits: number | null;
  workload: number | null;
  type: string;
  frequency: number | null;
  grade: number | null;
  status:
    | 'APPROVED'
    | 'FAILED_BY_GRADE'
    | 'FAILED_BY_ATTENDANCE'
    | 'CANCELED'
    | 'EXEMPT';
}
