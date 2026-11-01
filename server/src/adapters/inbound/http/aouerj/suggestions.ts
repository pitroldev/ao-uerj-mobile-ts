import express, { type RequestHandler } from 'express';

import {
  SUGGESTION_LIMITS,
  type NewSuggestion,
  type Suggestion,
} from '../../../../modules/suggestions/domain.ts';
import type { Suggestions } from '../../../../modules/suggestions/ports.ts';
import type { OkResponse, SuggestionRecord } from '../contract.ts';
import { body, contactEmail, parse, requiredText } from '../validation.ts';

const suggestionSchema = body({
  name: requiredText('name', { max: SUGGESTION_LIMITS.name }),
  content: requiredText('content', { max: SUGGESTION_LIMITS.content }),
  email: contactEmail(SUGGESTION_LIMITS.email),
}).transform((fields): NewSuggestion => fields);

export function toSuggestionRecord(suggestion: Suggestion): SuggestionRecord {
  return {
    _id: suggestion.id,
    name: suggestion.name,
    content: suggestion.content,
    email: suggestion.email,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
  };
}

/** `POST /suggestions` e a listagem de administração, `GET /suggestions`. */
export function suggestionRoutes({
  suggestions,
  withDatabase,
  writeLimit,
  adminOnly,
}: {
  suggestions: Suggestions;
  withDatabase: RequestHandler;
  writeLimit: RequestHandler;
  adminOnly: RequestHandler;
}) {
  const routes = express.Router();

  routes.post('/suggestions', writeLimit, withDatabase, async (req, res) => {
    await suggestions.submit(parse(suggestionSchema, req.body));
    res.json({ status: 'ok' } satisfies OkResponse);
  });

  // traz e-mails: o token é conferido antes do banco
  routes.get('/suggestions', adminOnly, withDatabase, async (req, res) => {
    const recent = await suggestions.listRecent();
    res.json(recent.map(toSuggestionRecord));
  });

  return routes;
}
