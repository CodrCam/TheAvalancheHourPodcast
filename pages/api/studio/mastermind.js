import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../lib/adminAuth';
import { logAdminAction } from '../../../lib/adminAudit';
import { getPersonStudioCapabilities } from '../../../lib/peopleStudioCapabilities.mjs';
import { listPeople } from '../../../lib/peopleStore';
import {
  invokeSeasonMastermind,
  isSeasonMastermindConfigured,
  SeasonMastermindServiceError,
} from '../../../lib/seasonMastermindClient.mjs';
import {
  MastermindInputError,
  normalizeMastermindListInput,
  normalizeMastermindMutation,
} from '../../../lib/seasonMastermindRequest.mjs';
import { getStudioBindingForSubject } from '../../../lib/studioAccessStore';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

function isJsonRequest(req) {
  return (
    String(req.headers['content-type'] || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase() === 'application/json'
  );
}

async function studioDirectory() {
  const result = await listPeople({
    allowStaticFallback: true,
    includeInactive: false,
  });
  const people = (result.people || [])
    .filter((person) => person.active !== false)
    .map((person) => ({
      person_id: String(person.person_id || ''),
      name: String(person.name || ''),
      image: String(person.images?.[0] || ''),
      capabilities: getPersonStudioCapabilities(person),
    }))
    .filter((person) => person.person_id && person.name)
    .sort((left, right) => left.name.localeCompare(right.name));
  const publicPerson = ({ person_id, name, image }) => ({
    person_id,
    name,
    image,
  });
  return {
    hosts: people
      .filter((person) => person.capabilities.host)
      .map(publicPerson),
    producers: people
      .filter((person) => person.capabilities.producer)
      .map(publicPerson),
  };
}

function serviceErrorResponse(error) {
  if (
    error instanceof MastermindInputError ||
    error instanceof SeasonMastermindServiceError
  ) {
    return {
      status: error.status || 500,
      body: {
        ok: false,
        code: error.code || 'MASTERMIND_REQUEST_FAILED',
        error: error.message,
        ...(error.requestId ? { request_id: error.requestId } : {}),
      },
    };
  }
  return {
    status: 500,
    body: {
      ok: false,
      code: 'MASTERMIND_REQUEST_FAILED',
      error: 'Season Mastermind could not complete that request.',
    },
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'POST'
      ? ADMIN_PERMISSIONS.MASTERMIND_MANAGE
      : ADMIN_PERMISSIONS.MASTERMIND_READ;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;

  res.setHeader('Cache-Control', 'private, no-store');
  const canManage = principal.permissions.includes(
    ADMIN_PERMISSIONS.MASTERMIND_MANAGE
  );

  if (!isSeasonMastermindConfigured()) {
    return res.status(503).json({
      ok: false,
      configured: false,
      canManage,
      code: 'MASTERMIND_NOT_CONFIGURED',
      error: 'Season Mastermind is not enabled in this environment.',
    });
  }

  try {
    const [binding, directory] = await Promise.all([
      getStudioBindingForSubject(principal.subject),
      canManage
        ? studioDirectory()
        : Promise.resolve({ hosts: [], producers: [] }),
    ]);
    const actor = {
      person_id: String(binding?.person_id || ''),
      can_manage: canManage,
    };

    if (!actor.person_id) {
      return res.status(409).json({
        ok: false,
        configured: isSeasonMastermindConfigured(),
        code: 'PROFILE_NOT_CONNECTED',
        error:
          'Your signed-in account is not connected to a Host Studio profile yet.',
      });
    }

    if (req.method === 'GET') {
      const input = normalizeMastermindListInput(req.query, actor);
      const result = await invokeSeasonMastermind({
        operation: 'list_mastermind',
        actor,
        input,
      });
      return res.status(200).json({
        ...result,
        configured: true,
        canManage,
        viewer_person_id: actor.person_id,
        directory: canManage
          ? {
              ...(result.directory || {}),
              hosts: directory.hosts,
              producers: directory.producers,
            }
          : {},
      });
    }

    if (!isJsonRequest(req)) {
      return res.status(400).json({
        ok: false,
        code: 'CONTENT_TYPE_REQUIRED',
        error: 'Content-Type must be application/json',
      });
    }

    const mutation = normalizeMastermindMutation(req.body, {
      directory: directory.hosts,
    });
    const result = await invokeSeasonMastermind({
      operation: mutation.operation,
      actor,
      input: mutation.input,
    });
    logAdminAction(req, principal, `studio.mastermind.${mutation.operation}`, {
      season_id: result.season?.season_id || mutation.input.season_id || '',
      episode_plan_id:
        result.plan?.episode_plan_id || mutation.input.episode_plan_id || '',
    });
    return res
      .status(
        mutation.operation.startsWith('create_') && result.created !== false
          ? 201
          : 200
      )
      .json({
        ...result,
        configured: true,
        canManage,
        viewer_person_id: actor.person_id,
      });
  } catch (error) {
    if (error instanceof SeasonMastermindServiceError) {
      console.warn('season mastermind upstream request failed:', {
        code: String(error.code || 'MASTERMIND_REQUEST_FAILED').slice(0, 80),
        status: Number(error.status) || 500,
        ...(error.requestId ? { request_id: error.requestId } : {}),
      });
    } else if (!(error instanceof MastermindInputError)) {
      console.error('season mastermind request failed:', error);
    }
    const response = serviceErrorResponse(error);
    return res.status(response.status).json(response.body);
  }
}
