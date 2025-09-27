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
  const [step, setStep] = useState(initialStep);

  const nextStep = () => setStep(s => Math.min(s + 1, maxStep));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  return { step, nextStep, prevStep, setStep };
};

type StepsProviderProps = {
  children: React.ReactNode;
  values: StepsContextType;
};

const StepsProvider = ({ children, values }: StepsProviderProps) => {
  return (
    <StepsContext.Provider value={values}>{children}</StepsContext.Provider>
  );
};

export default StepsProvider;
