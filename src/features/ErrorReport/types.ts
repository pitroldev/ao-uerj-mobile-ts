/** Passo 1: onde o erro aconteceu (e o código, se for uma disciplina). */
export type FeatureStepProps = {
  page: string;
  subjectCode: string;
  onChangePage: (page: string) => void;
  onChangeSubjectCode: (code: string) => void;
};

/** Passo 2: descrição do que aconteceu. */
export type ExplanationStepProps = {
  page: string;
  subjectCode?: string;
  /** O relato leva as contagens da última tentativa no gerador. */
  withGeneratorSummary?: boolean;
  description: string;
  onChangeDescription: (description: string) => void;
  editable?: boolean;
};
