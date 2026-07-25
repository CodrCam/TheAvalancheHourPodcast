const PATHWAYS = [
  {
    id: 'host',
    audience: 'For hosts',
    title: 'Host an episode',
    summary:
      'Prepare the guest, record every required segment, and deliver one complete, clearly labeled producer package.',
    access_permissions: ['episodes:update'],
    accent: 'host',
    steps: [
      {
        id: 'host-episodes',
        title: 'My Episodes',
        label: 'Assignment home',
        href: '/studio/episodes',
        action: 'Open My Episodes',
        permission: 'episodes:read',
        description:
          'This is the starting point for every episode connected to you. It shows the release date, host-package due date, completion, producer status, and whether delivery is at risk.',
        use_for:
          'Choose an episode, see what is still missing, and return to work without searching through email or Drive.',
        handoff:
          'Open the shared Episode Studio from here; the producer sees the same current record.',
      },
      {
        id: 'host-studio',
        title: 'Episode Studio',
        label: 'Shared episode form',
        href: '/studio/episodes',
        action: 'Choose an Episode Studio',
        permission: 'episodes:update',
        description:
          'The Studio organizes guest details and social profiles, story planning, recording notes, sponsor requirements, show notes, credits, and the final submission checklist.',
        use_for:
          'Work through the checklist in the order that makes sense for the episode. Save as you go and use the discussion when the production team needs context.',
        handoff:
          'Submitting changes the package to producer review; it does not erase your work or require a separate email.',
      },
      {
        id: 'host-sponsor-audio',
        title: 'Sponsor and ad spots',
        label: 'Episode requirement',
        href: '/studio/episodes',
        action: 'Review Episode Requirements',
        permission: 'episodes:update',
        description:
          'Assigned sponsor reads appear inside the Episode Studio with the current approved script and an episode-specific recording requirement.',
        use_for:
          'Record a separate ad-spot file when requested, or identify the full recording that already contains the read. Do not assume an ad is optional because it differs from a previous episode.',
        handoff:
          'The producer receives both the assigned script version and the audio evidence in the same package.',
      },
      {
        id: 'host-assets',
        title: 'File uploads and producer package',
        label: 'Official file handoff',
        href: '/studio/episodes',
        action: 'Upload Episode Files',
        permission: 'episodes:update',
        description:
          'Upload interview audio, ad spots, edit notes, show-note documents, and credited images directly under the checklist item they satisfy.',
        use_for:
          'Use clear filenames and include image order, crop, caption, credit, permission, and restrictions. The combined asset package at the bottom is the producer’s official source.',
        handoff:
          'Files are retained for 180 days after upload. Keep long-term working copies elsewhere, but do not send the producer a second competing folder.',
      },
      {
        id: 'host-mic-kits',
        title: 'Mic Kits',
        label: 'Equipment request',
        href: '/studio/mic-kits',
        action: 'Open Mic Kits',
        permission: 'mic_kits:read',
        description:
          'See kit availability, request equipment for an episode, and follow its current holder or shipping state.',
        use_for:
          'Request early enough for shipping and keep the delivery address private inside the request form.',
        handoff:
          'The logistics team can coordinate the next movement from the shared tracker.',
      },
      {
        id: 'host-profile',
        title: 'My Profile',
        label: 'Public host information',
        href: '/studio/profile',
        action: 'Review My Profile',
        permission: 'profile:self:read',
        description:
          'Maintain the biography and approved photography used on the public Avalanche Hour website.',
        use_for:
          'Keep your bio and images current. Episode guest details belong in the Episode Studio, not in your host profile.',
        handoff:
          'Saved profile changes feed the public host presentation without changing episode assignments.',
      },
    ],
  },
  {
    id: 'operations',
    audience: 'For coordination and logistics',
    title: 'Operations and fulfillment',
    summary:
      'Keep the physical and administrative work moving: inventory, customer shipments, equipment visibility, and cross-team follow-through.',
    access_permissions: ['orders:read', 'inventory:read'],
    accent: 'operations',
    steps: [
      {
        id: 'operations-overview',
        title: 'Admin Overview',
        label: 'Daily triage',
        href: '/admin',
        action: 'Open Admin Overview',
        permission: 'orders:read',
        description:
          'A quick read on new orders, low inventory, and any episode work available to your account.',
        use_for:
          'Start here when you need to know what deserves attention before opening a detailed workspace.',
        handoff:
          'Move into Orders, Inventory, or the Episode Calendar to make the actual update.',
      },
      {
        id: 'operations-orders',
        title: 'Orders and shipments',
        label: 'Customer fulfillment',
        href: '/admin/orders',
        action: 'Review Orders',
        permission: 'orders:read',
        description:
          'Shows paid customer orders, purchased items, shipping details, payment state, and fulfillment status.',
        use_for:
          'Move an order from New to Processing to Shipped, and export the shipping list when preparing fulfillment.',
        handoff:
          'The status is the team’s shared record. Mark Shipped only after the package has actually left.',
      },
      {
        id: 'operations-inventory',
        title: 'Inventory',
        label: 'Store availability',
        href: '/admin/inventory',
        action: 'Open Inventory',
        permission: 'inventory:read',
        description:
          'Shows each sellable SKU, available quantity, low-stock state, hidden items, and records that still need setup.',
        use_for:
          'Reconcile physical counts, correct a quantity, or place an unavailable option on standby so the store does not oversell it.',
        handoff:
          'Saved quantities become the store’s availability source. Use Orders to manage fulfillment; inventory is not a shipment log.',
      },
      {
        id: 'operations-people',
        title: 'Hosts and Team',
        label: 'Team reference',
        href: '/admin/people',
        action: 'View Hosts and Team',
        permission: 'people:read',
        description:
          'A directory of host and production profiles, public roles, account connections, and profile completeness.',
        use_for:
          'Confirm who is involved and whether the correct team profile exists before escalating an access or assignment issue.',
        handoff:
          'Profile content and Studio login access are separate. A Studio manager handles account-to-profile connections.',
      },
      {
        id: 'operations-mic-kits',
        title: 'Mic Kit visibility',
        label: 'Shared equipment status',
        href: '/studio/mic-kits',
        action: 'View Mic Kits',
        permission: 'mic_kits:read',
        description:
          'Shows kit availability, requests, reservations, current holders, movement, and tracking information that is safe for the signed-in team.',
        use_for:
          'Coordinate with the mic-kit manager and see whether an upcoming episode has an equipment risk.',
        handoff:
          'This view provides shared visibility. Checkout, labels, and circulation changes remain in the restricted checkout desk.',
      },
      {
        id: 'operations-mic-kit-desk',
        title: 'Mic Kit Checkout',
        label: 'Restricted circulation desk',
        href: '/admin/mic-kits',
        action: 'Open Checkout Desk',
        permission: 'mic_kits:manage',
        description:
          'The operating desk for assigning cases, saving shipping presets, exporting USPS Click-N-Ship data, recording tracking, and checking kits back in.',
        use_for:
          'Use only when you are the person responsible for the physical movement and custody record.',
        handoff:
          'Tracking and holder updates flow back to the shared Mic Kits page for hosts and coordinators.',
      },
      {
        id: 'operations-calendar',
        title: 'Episode Calendar',
        label: 'Production coordination',
        href: '/admin/studios',
        action: 'Open Episode Calendar',
        permission: 'episodes:manage',
        description:
          'Shows the release schedule, package due dates, assigned hosts and producer, completion state, and episodes that are off track.',
        use_for:
          'Create or assign a Studio, check upcoming deadlines, and direct the right person to the shared episode record.',
        handoff:
          'The calendar is the schedule; the individual Episode Studio contains the actual materials and production discussion.',
      },
    ],
  },
  {
    id: 'production',
    audience: 'For producers and Studio managers',
    title: 'Manage episode production',
    summary:
      'Build each Studio, tailor its requirements, review the centralized asset package, and move an episode cleanly into final production.',
    access_permissions: ['episodes:manage'],
    accent: 'production',
    steps: [
      {
        id: 'production-calendar',
        title: 'Episode Calendar',
        label: 'Season control center',
        href: '/studio/manage/episodes',
        action: 'Open Episode Calendar',
        permission: 'episodes:manage',
        description:
          'The season-level view of release dates, host-package deadlines, assignments, delivery health, and review status.',
        use_for:
          'Create an Episode Studio, assign the host and producer, adjust dates, and find submitted or off-track work quickly.',
        handoff:
          'Open the individual Studio for requirements and files; do not try to manage the episode from the calendar card alone.',
      },
      {
        id: 'production-studio',
        title: 'Episode setup and checklist',
        label: 'Flexible production plan',
        href: '/studio/manage/episodes',
        action: 'Choose an Episode Studio',
        permission: 'episodes:manage',
        description:
          'Each Studio is a shared production record. Managers can add, reorder, edit, or remove checklist items to match the episode instead of forcing every show through one rigid sequence.',
        use_for:
          'Set the expected guest information, editorial materials, recording files, images, credits, and special production requirements before the host reaches the handoff stage.',
        handoff:
          'The host sees the same published expectations and can complete the work in the order that fits the episode.',
      },
      {
        id: 'production-sponsor-reads',
        title: 'Sponsor reads and ad spots',
        label: 'Per-episode advertising',
        href: '/studio/manage/sponsor-reads',
        action: 'Open Sponsor Reads',
        permission: 'sponsor_reads:read',
        description:
          'The Sponsor Read Library holds approved script versions. An Episode Studio assignment determines which script applies and whether separate audio is required.',
        use_for:
          'Assign the current read, specify separate-upload versus included-in-recording evidence, and confirm the host supplied the expected audio.',
        handoff:
          'The script version and recording evidence remain attached to the episode so the producer does not have to reconstruct the requirement.',
      },
      {
        id: 'production-assets',
        title: 'Producer handoff and asset package',
        label: 'Central production source',
        href: '/studio/manage/episodes',
        action: 'Review Episode Packages',
        permission: 'episodes:manage',
        description:
          'Uploaded audio, documents, ad spots, and images are grouped under their checklist step and repeated in one clean producer package with labels and retention dates.',
        use_for:
          'Download the files from the Studio, read the host’s asset map and edit directions, and identify missing or expired material before beginning the final build.',
        handoff:
          'S3 is the official delivery point. Files expire 180 days after upload, so move anything needed for long-term archives into the production archive before that date.',
      },
      {
        id: 'production-review',
        title: 'Review, changes, and acceptance',
        label: 'Producer decision',
        href: '/studio/manage/episodes',
        action: 'Open the Review Queue',
        permission: 'episodes:manage',
        description:
          'Submitted packages can be accepted or returned with requested changes. Known gaps stay visible instead of being hidden in a side conversation.',
        use_for:
          'Check guest socials, required sponsor evidence, checklist completion, uploaded assets, and the episode discussion before accepting.',
        handoff:
          'Acceptance locks the delivery outlook as complete. Request Changes reopens the host workflow with the existing package intact.',
      },
      {
        id: 'production-access',
        title: 'Host Access',
        label: 'Account connection',
        href: '/studio/manage/access',
        action: 'Manage Host Access',
        permission: 'studio_access:manage',
        description:
          'Connects a signed-in Cognito account to the correct host or team profile so assignments and producer relationships appear for the right person.',
        use_for:
          'Fix “profile not connected” messages and confirm identity before changing an assignment.',
        handoff:
          'The connection controls who can see assigned Studios; it does not change the public biography or production role by itself.',
      },
      {
        id: 'production-resources',
        title: 'Resource Editor',
        label: 'Published host guidance',
        href: '/studio/manage/resources',
        action: 'Edit the Host Guide',
        permission: 'resources:update',
        description:
          'The editable source for host-facing season guidance, announcements, recording instructions, and approved reference links.',
        use_for:
          'Save a draft, preview exactly what hosts will see, and publish only after links and instructions are current.',
        handoff:
          'Manager notes and inactive links remain private. Publishing updates the shared Host Guide without exposing the staff pathways.',
      },
    ],
  },
];

function hasAnyPermission(permissions, required) {
  return required.some((permission) => permissions.has(permission));
}

export function getStudioResourcePathways(permissionValues = []) {
  const permissions = new Set(
    (Array.isArray(permissionValues) ? permissionValues : []).filter(Boolean)
  );

  return PATHWAYS.filter((pathway) =>
    hasAnyPermission(permissions, pathway.access_permissions)
  ).map((pathway) => ({
    id: pathway.id,
    audience: pathway.audience,
    title: pathway.title,
    summary: pathway.summary,
    accent: pathway.accent,
    steps: pathway.steps
      .filter(
        (step) => !step.permission || permissions.has(step.permission)
      )
      .map(({ permission, ...step }) => step),
  }));
}

export function getDefaultStudioResourcePath(permissionValues = []) {
  const permissions = new Set(
    (Array.isArray(permissionValues) ? permissionValues : []).filter(Boolean)
  );

  if (
    permissions.has('orders:read') ||
    permissions.has('inventory:read')
  ) {
    return 'operations';
  }
  if (permissions.has('episodes:manage')) return 'production';
  return 'host';
}
