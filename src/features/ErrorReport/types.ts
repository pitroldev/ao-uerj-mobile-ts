
export type ErrorReportBody = {
  page: string;
  description: string;
  html: string[];
}

export type ErrorFeature = {
  name: string
  callbacks: (() => Promise<string>)[]
}
