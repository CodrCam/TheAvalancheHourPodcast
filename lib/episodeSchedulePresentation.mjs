function scheduleMonthKey(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${value.getFullYear()}-${month}`;
}

export function listEpisodeScheduleMonth(episodes = [], month = new Date()) {
  const monthKey = scheduleMonthKey(month);
  if (!monthKey) return [];

  return episodes
    .filter((episode) =>
      String(episode.target_release_date || '').startsWith(`${monthKey}-`)
    )
    .sort(
      (left, right) =>
        String(left.target_release_date).localeCompare(
          String(right.target_release_date)
        ) || String(left.title || '').localeCompare(String(right.title || ''))
    );
}

export function episodeScheduleHref(
  detailBase,
  episode = {},
  previewHref = ''
) {
  if (previewHref) {
    return `${previewHref}${
      episode.workflow?.required_task_count ? '?workspace=production' : ''
    }`;
  }

  return `${detailBase}/${episode.episode_id}${
    episode.workflow?.required_task_count ? '/production' : ''
  }`;
}
