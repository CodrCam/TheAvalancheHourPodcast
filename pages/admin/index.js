import { getAccessPrincipalAsync } from '../../lib/adminAuth';
import { getTeamLandingForGroups } from '../../lib/teamLanding.mjs';

export default function AdminLanding() {
  return null;
}

export async function getServerSideProps({ req }) {
  const principal = await getAccessPrincipalAsync(req);

  return {
    redirect: {
      destination: principal
        ? getTeamLandingForGroups(principal.groups)
        : '/admin/login',
      permanent: false,
    },
  };
}
