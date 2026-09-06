-- Read-only preflight for migration 005.
-- Any returned row means ABORT. Review historical data manually.
-- Never delete or merge duplicates automatically.

SELECT match_id, player_id, COUNT(*) AS duplicate_count
FROM match_players
GROUP BY match_id, player_id
HAVING COUNT(*) > 1
ORDER BY match_id, player_id;
