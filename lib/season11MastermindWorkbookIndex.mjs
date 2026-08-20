const EXPECTED_NONEMPTY_CELL_COUNT = 649;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function source(sheet, row, columns) {
  return {
    workbook: 'The Avalanche Hour Season 11 Mastermind.xlsx',
    sheet,
    normalizedSheet: sheet.trim(),
    row,
    columns: Array.isArray(columns) ? columns : [columns],
  };
}

function hostGoal(row, displayName, goal, note = '') {
  return {
    source: source('Schedule', row, note ? ['B', 'C', 'E'] : ['B', 'C']),
    displayName,
    goal,
    note,
  };
}

export const SEASON_11_HOST_GOALS = deepFreeze([
  hostGoal(45, 'Caleb Merrill', '2'),
  hostGoal(46, 'Dr. Sara Boilen', 'Slabs n Sluffs'),
  hostGoal(47, 'Sean Zimmerman-Wall', '2'),
  hostGoal(48, 'Jake Hutchinson', '1-2'),
  hostGoal(
    49,
    'Jason Antin',
    '2',
    'Need to re-record Sasha Dingle, and now interviewing Izzy Davis'
  ),
  hostGoal(50, 'Brooke Shiny Edwards', '2'),
  hostGoal(51, 'Dom Baker', 'Slabs n Sluffs'),
  hostGoal(52, 'Brooke Maushund', '0-1'),
  hostGoal(53, 'Gabrielle Antonioli', '1'),
  hostGoal(54, 'Lynne Wolfe', '1-2'),
  hostGoal(55, 'Joe Stock', '2'),
  hostGoal(56, 'Kim Vinet', '2'),
  hostGoal(57, 'Matthias Walcher', '2'),
  hostGoal(58, 'Bruce Jamieson', '2+'),
  hostGoal(59, 'Sierra Bishop', '2'),
  hostGoal(60, 'Anna Heuberger', '1'),
  hostGoal(61, 'Brenden Cronin?', '1'),
  hostGoal(62, 'Dallas Glass?', '1'),
  hostGoal(63, 'Nikki Champion', '1'),
  hostGoal(64, 'Anna Keeling?', '1'),
  hostGoal(65, 'Pascal Haegli', '1'),
]);

function productionLead(sheet, row, guestName, columns, operational = {}) {
  return {
    source: source(sheet, row, columns),
    guestName,
    contactMade: '',
    releaseDate: '',
    interviewDate: '',
    micRequest: '',
    shippingStatus: '',
    productionRequest: '',
    producer: '',
    pictureBioRequested: '',
    advertisement: '',
    notes: '',
    ...operational,
  };
}

export const SEASON_11_HISTORICAL_PRODUCTION_LEADS = deepFreeze([
  productionLead('Caleb', 2, 'Matt Mckee', ['A', 'H'], {
    producer: 'CALEB',
  }),
  productionLead('Caleb', 3, 'Pascal Haegli', ['A', 'H'], {
    producer: 'CALEB',
  }),
  productionLead('Caleb', 4, 'Michael Ferrari', ['A', 'H'], {
    producer: 'CALEB',
  }),
  productionLead('Caleb', 5, 'Adam Clark', ['A', 'H'], {
    producer: 'CALEB',
  }),
  productionLead('Caleb', 6, 'Sandy Kobrik', ['A', 'H'], {
    producer: 'CALEB',
  }),
  productionLead('Caleb', 7, 'Jennifer Coulter *', ['A', 'H'], {
    producer: 'CALEB',
  }),
  productionLead('Caleb', 8, 'Jeff Moskowitz/Gareth Brown*', ['A']),
  productionLead('Caleb', 9, 'Nathalie de Leeuw', ['A']),
  productionLead('Caleb', 10, 'Chris Lundy', ['A']),
  productionLead('Caleb', 11, 'Penny Goddard', ['A']),
  productionLead('Caleb', 12, 'Brian Lundstead', ['A']),
  productionLead('Caleb', 13, 'Dave Hamre', ['A']),
  productionLead('Dom', 2, 'Kirk Mauthner', ['A', 'B', 'C', 'D', 'I', 'J'], {
    contactMade: 'YES',
    releaseDate: '2025-10-01',
    interviewDate: '2025-08-18',
    pictureBioRequested: 'Not yet',
    advertisement: 'Peak visor',
  }),
  productionLead('Dom', 3, 'Larry Stanier', ['A', 'C', 'J'], {
    releaseDate: '2026-01-15',
    advertisement: 'IPA collective',
  }),
  productionLead(
    'SZW',
    2,
    'Rachel Reimer',
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'J'],
    {
      contactMade: 'YES',
      releaseDate: '2025-11-15',
      interviewDate: '2025-10-07',
      micRequest: 'Yes',
      shippingStatus: 'Done',
      productionRequest: 'Post Production',
      pictureBioRequested: 'Yes',
      advertisement: 'Midroll IPA',
    }
  ),
  productionLead(
    'Shiny',
    2,
    'Morgan Dinsdale',
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I'],
    {
      contactMade: 'YES',
      releaseDate: '2026-01-01',
      interviewDate: '2025-11-23',
      micRequest: 'Yes',
      shippingStatus: 'already sent',
      productionRequest: 'Post Production',
      pictureBioRequested: 'Yes',
    }
  ),
  productionLead(
    'Shiny',
    3,
    'Sasha Dingle',
    ['A', 'B', 'C', 'D', 'E', 'G', 'I'],
    {
      contactMade: 'YES',
      releaseDate: '2026-05-15',
      interviewDate: '2025-11-24',
      micRequest: 'No',
      productionRequest: 'Post Production',
      pictureBioRequested: 'Yes',
    }
  ),
  productionLead('Brooke M', 2, 'Evelyn Lees', ['A']),
  productionLead('Brooke M', 3, 'Irene Henninger', ['A', 'B'], {
    contactMade: 'YES',
  }),
  productionLead('Brooke M', 4, 'Paige Pagnucco', ['A']),
  productionLead('Brooke M', 5, 'Nata de Leeuw', ['A', 'B'], {
    contactMade: 'YES',
  }),
  productionLead('Brooke M', 14, 'Steve Mace', ['A', 'B'], {
    contactMade: 'YES',
  }),
  productionLead('Brooke M', 15, 'Luciano Fiorenza', ['A', 'B'], {
    contactMade: 'YES',
  }),
  productionLead('Jason ', 2, 'Sheldon Kerr', ['A', 'B', 'E'], {
    contactMade: 'YES',
    micRequest: 'Yes',
  }),
  productionLead('Jason ', 3, 'Kristin Arnold', ['A', 'B', 'E'], {
    contactMade: 'YES',
    micRequest: 'Yes',
  }),
]);

export const SEASON_11_HOST_TAB_ORPHANS = deepFreeze([
  {
    source: source('Dom', 4, ['C']),
    kind: 'release_date_without_guest',
    releaseDate: '2026-03-01',
  },
  {
    source: source('SZW', 17, ['A']),
    kind: 'merged_area_marker',
    marker: '\\',
  },
]);

export const SEASON_11_SZW_RESOURCES = deepFreeze([
  {
    source: source('SZW', 28, ['A']),
    kind: 'production_note',
    label: '30 second summary of episode.',
  },
  {
    source: source('SZW', 29, ['A']),
    kind: 'restricted_admin_link',
    hasRestrictedAdminLink: true,
  },
  {
    source: source('SZW', 30, ['A']),
    kind: 'reference_show',
    label: 'Chris Hall mountain biking podcast',
  },
  {
    source: source('SZW', 31, ['A']),
    kind: 'reference_show',
    label: 'Rick Rubin Podcast',
  },
  {
    source: source('SZW', 32, ['A']),
    kind: 'reference_show',
    label: 'Mountain and Prarie',
  },
  {
    source: source('SZW', 33, ['A']),
    kind: 'reference_show',
    label: 'River Radius',
  },
  {
    source: source('SZW', 34, ['A']),
    kind: 'reference_show',
    label: 'Back from the Beyond- Grand County SAR',
  },
  {
    source: source('SZW', 35, ['A']),
    kind: 'reference_show',
    label: 'Delivering Adventure- CAN',
  },
]);

function guestIdea(row, displayName, { hidden = false } = {}) {
  return {
    source: source('Guest Ideas', row, ['A']),
    displayName,
    hiddenInWorkbook: hidden,
  };
}

export const SEASON_11_CURATED_GUEST_IDEAS = deepFreeze([
  guestIdea(2, 'Penny Goddard'),
  guestIdea(3, 'Scott Schell'),
  guestIdea(5, 'Graham Predager'),
  guestIdea(6, 'Mark Staples'),
  guestIdea(7, 'Brett Kobernik'),
  guestIdea(8, 'Bill Glude'),
  guestIdea(10, 'Pascal Haegli'),
  guestIdea(11, 'Jerry Isaak'),
  guestIdea(12, 'Michael Ferrari'),
  guestIdea(14, 'Brian Newman'),
  guestIdea(16, 'Kelly Elder'),
  guestIdea(17, 'Steve Conger'),
  guestIdea(18, 'Aleph Johnston Bloom', { hidden: true }),
  guestIdea(19, 'Irene Henniger'),
  guestIdea(22, 'Chris Lundy'),
  guestIdea(23, 'Dave Hamre'),
  guestIdea(24, 'Adam Clark'),
  guestIdea(25, 'Ron Simenhois'),
  guestIdea(26, 'HP Marshall'),
  guestIdea(28, 'Nata de Leeuw'),
  guestIdea(29, 'Paul Baugher'),
  guestIdea(30, 'Mike Janes'),
  guestIdea(33, 'Dale Atkins'),
  guestIdea(34, 'Sandy kobrick'),
  guestIdea(35, 'Jamie Weeks'),
  guestIdea(36, 'Jed Workman'),
  guestIdea(37, 'Kelly Robbins'),
  guestIdea(38, 'Forrest Mccarthey'),
  guestIdea(40, 'Denny Hogan'),
  guestIdea(41, 'Matt Mckee'),
  guestIdea(42, 'Jennifer Coulter *'),
  guestIdea(44, 'Jeff Moskowitz/Gareth Brown*'),
  guestIdea(53, 'Steve Mace'),
  guestIdea(54, 'Art mears'),
  guestIdea(55, 'Brian Lundstead'),
]);

export const SEASON_11_PUBLIC_GUEST_SUGGESTIONS = deepFreeze([
  {
    source: source('Guest Ideas', 2, ['C']),
    suggestion: 'Lee Lazzara - NWAC Forecaster',
    hasRestrictedContact: false,
    hasRestrictedMessage: false,
  },
  {
    source: source('Guest Ideas', 3, ['C']),
    suggestion: 'Avalanche Savvy',
    hasRestrictedContact: false,
    hasRestrictedMessage: false,
  },
  {
    source: source('Guest Ideas', 5, ['C', 'D', 'E']),
    suggestion: 'Keith Robine',
    hasRestrictedContact: true,
    hasRestrictedMessage: true,
  },
]);

export const SEASON_11_INTAKE_FIELD_IDS = deepFreeze([
  'submitted_at',
  'contact_email',
  'full_name',
  'bio',
  'resume_cv',
  'projects_and_links',
  'social_tag_consent',
  'social_username',
  'topics',
  'incident_available',
  'incident_details',
  'mic_kit_requested',
  'shipping_destination',
  'own_equipment',
  'photo_assets',
  'video_consent',
  'pre_interview_response',
  'interview_response',
]);

const INTAKE_FIELD_COLUMNS = Object.freeze(
  Object.fromEntries(
    SEASON_11_INTAKE_FIELD_IDS.map((field, index) => [
      field,
      String.fromCharCode(65 + index),
    ])
  )
);

function intakeSubmission(sheet, row, displayName, missingFields = []) {
  const missing = new Set(missingFields);
  const presentFields = SEASON_11_INTAKE_FIELD_IDS.filter(
    (field) => !missing.has(field)
  );
  return {
    source: source(
      sheet,
      row,
      presentFields.map((field) => INTAKE_FIELD_COLUMNS[field])
    ),
    displayName,
    totalFieldCount: SEASON_11_INTAKE_FIELD_IDS.length,
    completedFieldCount: presentFields.length,
    completionPercent: Math.round(
      (presentFields.length / SEASON_11_INTAKE_FIELD_IDS.length) * 100
    ),
    presentFields,
    missingFields: [...missingFields],
  };
}

export const SEASON_11_INTAKE_SUBMISSIONS = deepFreeze([
  intakeSubmission('SZW Guest intake Form Answers', 2, 'Rebecca Hodgetts', [
    'resume_cv',
    'own_equipment',
  ]),
  intakeSubmission('CM Guest Intake Form', 2, 'Kenneth James Wylie', [
    'own_equipment',
  ]),
  intakeSubmission('CM Guest Intake Form', 3, 'Jeff Banks', [
    'resume_cv',
    'shipping_destination',
    'interview_response',
  ]),
  intakeSubmission('CM Guest Intake Form', 4, 'Cameron Griffin'),
  intakeSubmission('CM Guest Intake Form', 5, 'Christopher Van Tilburg', [
    'resume_cv',
  ]),
  intakeSubmission('CM Guest Intake Form', 6, 'Evan Stevens', [
    'own_equipment',
    'interview_response',
  ]),
  intakeSubmission('CM Guest Intake Form', 7, 'Larry Goldie', [
    'resume_cv',
    'shipping_destination',
    'interview_response',
  ]),
  intakeSubmission('CM Guest Intake Form', 8, 'Karin Pocock', [
    'resume_cv',
  ]),
  intakeSubmission('CM Guest Intake Form', 9, 'Josh Hirshberg'),
  intakeSubmission('CM Guest Intake Form', 10, 'Nina Marienthal', [
    'own_equipment',
  ]),
  intakeSubmission('CM Guest Intake Form', 11, 'Jen Reddy', [
    'resume_cv',
    'incident_details',
    'own_equipment',
  ]),
  intakeSubmission('CM Guest Intake Form', 12, 'Janet Kellam'),
]);

export const SEASON_11_WORKBOOK_SHEET_COVERAGE = deepFreeze([
  {
    sourceSheet: 'Schedule',
    normalizedSheet: 'Schedule',
    valueRange: 'A1:J65',
    nonemptyRows: '1-40,44-65',
    nonemptyCellCount: 196,
    privacyTier: 'internal_planning',
    partitions: {
      scheduleAndHeaders: 150,
      hostGoalSection: 46,
    },
  },
  {
    sourceSheet: 'Caleb',
    normalizedSheet: 'Caleb',
    valueRange: 'A1:K13',
    nonemptyRows: '1-13',
    nonemptyCellCount: 29,
    privacyTier: 'restricted_production',
    partitions: { headers: 11, productionLeadCells: 18 },
  },
  {
    sourceSheet: 'Dom',
    normalizedSheet: 'Dom',
    valueRange: 'A1:K4',
    nonemptyRows: '1-4',
    nonemptyCellCount: 21,
    privacyTier: 'restricted_production',
    partitions: { headers: 11, productionLeadCells: 9, orphanCells: 1 },
  },
  {
    sourceSheet: 'SZW',
    normalizedSheet: 'SZW',
    valueRange: 'A1:K35',
    nonemptyRows: '1-2,17,28-35',
    nonemptyCellCount: 29,
    privacyTier: 'restricted_admin',
    partitions: {
      headers: 11,
      productionLeadCells: 9,
      orphanAndResourceCells: 9,
    },
  },
  {
    sourceSheet: 'Shiny',
    normalizedSheet: 'Shiny',
    valueRange: 'A1:K3',
    nonemptyRows: '1-3',
    nonemptyCellCount: 26,
    privacyTier: 'restricted_production',
    partitions: { headers: 11, productionLeadCells: 15 },
  },
  {
    sourceSheet: 'Matthias',
    normalizedSheet: 'Matthias',
    valueRange: 'A1:K1',
    nonemptyRows: '1',
    nonemptyCellCount: 11,
    privacyTier: 'restricted_production',
    partitions: { headers: 11 },
  },
  {
    sourceSheet: 'Jake',
    normalizedSheet: 'Jake',
    valueRange: 'A1:K1',
    nonemptyRows: '1',
    nonemptyCellCount: 11,
    privacyTier: 'restricted_production',
    partitions: { headers: 11 },
  },
  {
    sourceSheet: 'Brooke M',
    normalizedSheet: 'Brooke M',
    valueRange: 'A1:K15',
    nonemptyRows: '1-5,14-15',
    nonemptyCellCount: 21,
    privacyTier: 'restricted_production',
    partitions: { headers: 11, productionLeadCells: 10 },
  },
  {
    sourceSheet: 'Sara',
    normalizedSheet: 'Sara',
    valueRange: 'A1:K1',
    nonemptyRows: '1',
    nonemptyCellCount: 11,
    privacyTier: 'restricted_production',
    partitions: { headers: 11 },
  },
  {
    sourceSheet: 'Jason ',
    normalizedSheet: 'Jason',
    valueRange: 'A1:K3',
    nonemptyRows: '1-3',
    nonemptyCellCount: 17,
    privacyTier: 'restricted_production',
    partitions: { headers: 11, productionLeadCells: 6 },
    qualityFlags: ['source_sheet_name_has_trailing_space'],
  },
  {
    sourceSheet: 'Guest Ideas',
    normalizedSheet: 'Guest Ideas',
    valueRange: 'A1:E55',
    nonemptyRows:
      '1-3,5-8,10-12,14,16-19,22-26,28-30,33-38,40-42,44,53-55',
    nonemptyCellCount: 42,
    privacyTier: 'restricted_contact',
    partitions: {
      headers: 2,
      curatedIdeaCells: 35,
      publicSuggestionCells: 5,
    },
    hiddenNonemptyRows: [18],
  },
  {
    sourceSheet: 'SZW Guest intake Form Answers',
    normalizedSheet: 'SZW Guest intake Form Answers',
    valueRange: 'A1:R2',
    nonemptyRows: '1-2',
    nonemptyCellCount: 34,
    privacyTier: 'confidential_questionnaire',
    partitions: { headers: 18, submissionCells: 16 },
  },
  {
    sourceSheet: 'CM Guest Intake Form',
    normalizedSheet: 'CM Guest Intake Form',
    valueRange: 'A1:R12',
    nonemptyRows: '1-12',
    nonemptyCellCount: 201,
    privacyTier: 'confidential_questionnaire',
    partitions: { headers: 18, submissionCells: 183 },
  },
]);

const indexedNonemptyCellCount = SEASON_11_WORKBOOK_SHEET_COVERAGE.reduce(
  (total, sheet) => total + sheet.nonemptyCellCount,
  0
);

if (indexedNonemptyCellCount !== EXPECTED_NONEMPTY_CELL_COUNT) {
  throw new Error(
    `Season 11 workbook coverage mismatch: ${indexedNonemptyCellCount}`
  );
}

export const SEASON_11_WORKBOOK_COVERAGE = deepFreeze({
  expectedNonemptyCellCount: EXPECTED_NONEMPTY_CELL_COUNT,
  indexedNonemptyCellCount,
  sheetCount: SEASON_11_WORKBOOK_SHEET_COVERAGE.length,
  cellFormulaCount: 0,
  commentOrNoteCount: 0,
  hiddenSheetCount: 0,
  sheets: SEASON_11_WORKBOOK_SHEET_COVERAGE,
});

export const SEASON_11_MASTERMIND_WORKBOOK_INDEX = deepFreeze({
  workbook: 'The Avalanche Hour Season 11 Mastermind.xlsx',
  hostGoals: SEASON_11_HOST_GOALS,
  historicalProductionLeads: SEASON_11_HISTORICAL_PRODUCTION_LEADS,
  hostTabOrphans: SEASON_11_HOST_TAB_ORPHANS,
  szwResources: SEASON_11_SZW_RESOURCES,
  guestIdeas: {
    curated: SEASON_11_CURATED_GUEST_IDEAS,
    publicSuggestions: SEASON_11_PUBLIC_GUEST_SUGGESTIONS,
  },
  intakeSubmissions: SEASON_11_INTAKE_SUBMISSIONS,
  coverage: SEASON_11_WORKBOOK_COVERAGE,
});
