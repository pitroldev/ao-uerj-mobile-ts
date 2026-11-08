import React, { useState, useContext, createContext } from 'react';

type StepsContextType = {
  step: number;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (n: number) => void;
};

const StepsContext = createContext<StepsContextType>({
  step: 0,
  nextStep: () => {},
  prevStep: () => {},
  setStep: () => {},
});

export const useStepsContext = () => useContext(StepsContext);

export const useSteps = ({ initialStep = 0, maxStep = 0 }) => {
  const last = Number.isFinite(maxStep) ? Math.max(0, Math.trunc(maxStep)) : 0;
  const bounded = (value: number) =>
    Number.isFinite(value) ? Math.min(last, Math.max(0, Math.trunc(value))) : 0;
  const [storedStep, updateStep] = useState(() => bounded(initialStep));
  const step = bounded(storedStep);
  // Um limite menor não pode deixar a tela sem passo, nem ressuscitar o antigo.
  if (step !== storedStep) updateStep(step);

  const setStep = (value: number) => updateStep(bounded(value));
  const nextStep = () => updateStep(s => bounded(s + 1));
  const prevStep = () => updateStep(s => bounded(s - 1));

  return { step, nextStep, prevStep, setStep };
};

type StepsProviderProps = {
  children: React.ReactNode;
  values: StepsContextType;
};

export const StepsProvider = ({ children, values }: StepsProviderProps) => {
  return (
    <StepsContext.Provider value={values}>{children}</StepsContext.Provider>
  );
};
