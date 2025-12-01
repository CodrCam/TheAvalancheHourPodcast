// src/data/sponsors.js

// One canonical registry keyed by id
export const sponsorsById = {
  'darren-johnson-aemf': {
    id: 'darren-johnson-aemf',
    name: 'Darren Johnson Avalanche Education Memorial Fund',
    tier: 'legacy',
    url: 'https://www.yellowstoneclubfoundation.org/darren-johnson-fund',
    logo: '/images/sponsors/DarrenJAEMF.png',
  },
  avss: {
    id: 'avss',
    name: 'AVSS',
    tier: 'legacy',
    url: 'https://avss.co/',
    logo: '/images/sponsors/avss-dark.svg',
  },
  'drone-amplified': {
    id: 'drone-amplified',
    name: 'Drone Amplified',
    tier: 'legacy',
    url: 'https://droneamplified.com/',
    logo: '/images/sponsors/DroneAmp.png',
  },

  'cil-avalanche': {
    id: 'cil-avalanche',
    name: 'CIL Avalanche',
    tier: 'partner',
    url: 'https://www.cilexplosives.com/',
    logo: '/images/sponsors/CIL_Avy.png',
  },
  safeback: {
    id: 'safeback',
    name: 'Safeback',
    tier: 'partner',
    url: 'https://safeback.no/',
    logo: '/images/sponsors/safeback.png',
  },
  'onx-backcountry': {
    id: 'onx-backcountry',
    name: 'onX Backcountry',
    tier: 'partner',
    url: 'https://www.onxmaps.com/backcountry',
    logo: '/images/sponsors/onXBackcountry-logo-black.png',
  },

  peaksvisor: {
    id: 'peaksvisor',
    name: 'PeakVisor',
    tier: 'friend',
    url: 'https://peakvisor.com/',
    logo: '/images/sponsors/peakvisor.png',
  },
  'propagation-labs': {
    id: 'propagation-labs',
    name: 'Propagation Labs',
    tier: 'friend',
    url: 'https://www.propagationlabs.com/',
    logo: '/images/sponsors/prop_labs.jpg',
  },
  arva: {
    id: 'arva',
    name: 'Arva',
    tier: 'friend',
    url: 'https://www.arva-equipment.com/en/',
    logo: '/images/sponsors/arva no background.png',
  },
  'ipa-collective': {
    id: 'ipa-collective',
    name: 'IPA Collective',
    tier: 'friend',
    url: 'https://ipacollective.com/',
    logo: '/images/sponsors/IPAcollective.jpg',
  },
  'open-snow': {
    id: 'open-snow',
    name: 'OpenSnow',
    tier: 'friend',
    url: 'https://opensnow.com/',
    logo: '/images/sponsors/OpenSnow.png',
  },
  'avalanche-risk-solutions': {
    id: 'avalanche-risk-solutions',
    name: 'Avalanche Risk Solutions',
    tier: 'friend',
    url: 'https://www.avalancherisksolutions.com/',
    logo: '/images/sponsors/ARS_logo.png',
  },
  'snowbound-solutions': {
    id: 'snowbound-solutions',
    name: 'Snowbound Solutions',
    tier: 'friend',
    url: 'https://snowboundsolutions.com/',
    logo: '/images/sponsors/Snowbound_Logo.png',
  },
  snower: {
    id: 'snower',
    name: 'Snower',
    tier: 'friend',
    url: 'https://snower.fi/',
    logo: '/images/sponsors/Snower.png',
  },
  'raide-research': {
    id: 'raide-research',
    name: 'Raide',
    tier: 'friend',
    url: 'https://raideresearch.com/',
    logo: '/images/sponsors/raide.jpg',
  },
};

// Grouped by tier for SponsorGrid and the Sponsors page
export const sponsors = {
  legacy: Object.values(sponsorsById).filter((s) => s.tier === 'legacy'),
  partner: Object.values(sponsorsById).filter((s) => s.tier === 'partner'),
  friends: Object.values(sponsorsById).filter((s) => s.tier === 'friend'),
};

// Optional: per-episode sponsor mapping.
// Fill this with real Spotify episode IDs when you're ready:
//
//  'episode-id-from-spotify': ['open-snow', 'propagation-labs'],
//
export const episodeSponsorship = {
  // '1234abcd': ['open-snow'],
};