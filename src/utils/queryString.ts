export function formDataToJSON(form: FormData): { [key: string]: string } {
  try {
    const json: { [key: string]: string } = {};
    for (const part of form.getParts()) {
      json[part.fieldName] = part.string;
    }
    return json;
  } catch (e) {
    return {};
  }
}
