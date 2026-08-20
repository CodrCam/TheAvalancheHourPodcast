import {
  ensureEpisodeStudioFromMastermindPlan as ensureEpisodeStudioFromMastermindPlanCore,
  EpisodeStudioCreationError,
  getEpisodeStudioCreationDirectory as getEpisodeStudioCreationDirectoryCore,
} from './episodeStudioCreation.js';
import { isEpisodeAssetStorageConfigured } from './episodeAssetStorage';
import { getDefaultStudioProducerEmail } from './episodeStudioNotifications';
import {
  getEpisodeStudio,
  saveEpisodeStudio,
} from './episodeStudioStore';
import { listPeople } from './peopleStore';
import { listStudioBindings } from './studioAccessStore';

export { EpisodeStudioCreationError };

export function getEpisodeStudioCreationDirectory() {
  return getEpisodeStudioCreationDirectoryCore({
    listPeopleImpl: listPeople,
    listStudioBindingsImpl: listStudioBindings,
  });
}

export function ensureEpisodeStudioFromMastermindPlan(value) {
  return ensureEpisodeStudioFromMastermindPlanCore(value, {
    getEpisodeStudioImpl: getEpisodeStudio,
    saveEpisodeStudioImpl: saveEpisodeStudio,
    isEpisodeAssetStorageConfiguredImpl: isEpisodeAssetStorageConfigured,
    getDefaultStudioProducerEmailImpl: getDefaultStudioProducerEmail,
  });
}
