-- Migration 006: copy only legacy unlocks that prove the equivalent legendary achievement.
-- Old rows remain unchanged for audit history. INSERT OR IGNORE makes re-execution safe.

INSERT OR IGNORE INTO achievements (player_id, achievement_key, match_id, unlocked_at)
SELECT player_id, 'magic_staircase', match_id, unlocked_at
FROM achievements
WHERE achievement_key = 'elemental';

INSERT OR IGNORE INTO achievements (player_id, achievement_key, match_id, unlocked_at)
SELECT player_id, 'weak_over_strong', match_id, unlocked_at
FROM achievements
WHERE achievement_key = 'comeback';

INSERT OR IGNORE INTO achievements (player_id, achievement_key, match_id, unlocked_at)
SELECT player_id, 'pincer_finish', match_id, unlocked_at
FROM achievements
WHERE achievement_key = 'double_kill';

INSERT OR IGNORE INTO achievements (player_id, achievement_key, match_id, unlocked_at)
SELECT player_id, 'dragon_sweep', match_id, unlocked_at
FROM achievements
WHERE achievement_key = 'dragon_triple_one';

INSERT OR IGNORE INTO achievements (player_id, achievement_key, match_id, unlocked_at)
SELECT player_id, 'refuse_ending', match_id, unlocked_at
FROM achievements
WHERE achievement_key = 'not_approved';

INSERT OR IGNORE INTO achievements (player_id, achievement_key, match_id, unlocked_at)
SELECT player_id, 'secret_investor', match_id, unlocked_at
FROM achievements
WHERE achievement_key = 'secret_rich';
