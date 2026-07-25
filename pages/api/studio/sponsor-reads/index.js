import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import { listPeople } from '../../../../lib/peopleStore';
import { listSponsors } from '../../../../lib/sponsorStore';
import {
  createSponsorReadId,
  listSponsorReads,
  saveSponsorRead,
} from '../../../../lib/sponsorReadStore';
import { getStudioBindingForSubject } from '../../../../lib/studioAccessStore';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.SPONSOR_READS_READ
      : ADMIN_PERMISSIONS.SPONSOR_READS_UPDATE;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;

  try {
    if (req.method === 'GET') {
      const [readResult, sponsorResult] = await Promise.all([
        listSponsorReads(),
        listSponsors({ allowStaticFallback: true }),
      ]);
      return res.status(200).json({
        ok: true,
        ...readResult,
        sponsors: sponsorResult.sponsors.map((sponsor) => ({
          sponsor_id: sponsor.sponsor_id,
          name: sponsor.name,
          active: sponsor.active,
        })),
        canUpdate: principal.permissions.includes(
          ADMIN_PERMISSIONS.SPONSOR_READS_UPDATE
        ),
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }
    const input = req.body?.sponsor_read || {};
    const create = req.body?.create === true;
    const sponsorResult = await listSponsors({ allowStaticFallback: true });
    const sponsor = sponsorResult.sponsors.find(
      (candidate) => candidate.sponsor_id === input.sponsor_id
    );
    if (!sponsor) {
      return res.status(400).json({
        ok: false,
        error: 'Choose a valid sponsor for this read.',
      });
    }
    const binding = await getStudioBindingForSubject(principal.subject);
    const peopleResult = await listPeople({
      allowStaticFallback: true,
      includeInactive: true,
    });
    const person = peopleResult.people.find(
      (candidate) => candidate.person_id === binding?.person_id
    );
    const sponsorRead = await saveSponsorRead(
      {
        ...input,
        sponsor_read_id: create
          ? createSponsorReadId(input.script_title)
          : input.sponsor_read_id,
        sponsor_name: sponsor.name,
      },
      {
        create,
        expectedUpdatedAt: req.body?.expected_updated_at,
        actor: {
          person_id: binding?.person_id || '',
          name:
            person?.name ||
            principal.displayName ||
            principal.username ||
            'Studio administrator',
        },
      }
    );
    logAdminAction(req, principal, 'sponsor_read.save', {
      sponsor_read_id: sponsorRead.sponsor_read_id,
      sponsor_id: sponsorRead.sponsor_id,
      version_number: sponsorRead.version_number,
      state: sponsorRead.state,
    });
    return res.status(create ? 201 : 200).json({ ok: true, sponsor_read: sponsorRead });
  } catch (error) {
    const message = String(error.message || '');
    const conflict = /conditional/i.test(message);
    const validation = /Sponsor read:/i.test(message);
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: conflict
        ? 'That sponsor read changed in another session. Refresh and try again.'
        : message || 'Could not save the sponsor read.',
    });
  }
}
