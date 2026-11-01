import express from 'express';

import type { ScheduleGenerator } from '../../../../modules/schedules/ports.ts';
import type { GeneratorHealthResponse } from '../contract.ts';
import { perMinuteLimit } from '../middleware.ts';
import { parse } from '../validation.ts';
import { generationSchema } from './request.ts';
import { toGenerationResponse } from './response.ts';

/**
 * As rotas em `/schedules`, as do gerador antigo: o mesmo pedido e a mesma
 * resposta (`{ data }`), sem banco.
 */
export function createSchedulesRouter({
  generator,
  generationsPerMinute,
}: {
  generator: ScheduleGenerator;
  generationsPerMinute: number;
}) {
  const routes = express.Router();
  const limited = perMinuteLimit(generationsPerMinute);

  routes.get('/health', (req, res) => {
    res.json({
      online: true,
      ...generator.load(),
    } satisfies GeneratorHealthResponse);
  });

  routes.post('/generate', limited, async (req, res) => {
    const { wire, request } = parse(generationSchema, req.body);
    // o app desistiu (cancelou ou fechou): a busca para e libera a vez
    const gone = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) gone.abort();
    });
    try {
      const result = await generator.generate(request, {
        signal: gone.signal,
      });
      if (!result.exhaustive)
        req.log.warn(
          { visited: result.visited, classes: request.classes.length },
          'schedule search stopped at the time budget',
        );
      res.json(toGenerationResponse(result, wire));
    } catch (err) {
      if (gone.signal.aborted) return;
      throw err;
    }
  });

  return routes;
}
