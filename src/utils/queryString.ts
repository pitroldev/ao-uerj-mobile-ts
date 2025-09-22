export function formDataToJSON(form: FormData): { [key: string]: string } {
  try {
    const json: { [key: string]: string } = {};
    for (const part of (form as any).getParts()) {
      json[part.fieldName] = part.string;
    }
    return json;
  } catch (e) {
    return {};
  }
}
