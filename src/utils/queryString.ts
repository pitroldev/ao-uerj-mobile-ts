export function formDataToJSON(form: FormData): {[key: string]: string} {
  try {
    console.log('#####', form.getParts());
    const json: {[key: string]: string} = {};
    for (const part of form.getParts()) {
      json[part.fieldName] = part.string;
    }
    return json;
  } catch (e) {
    return {};
  }
}
