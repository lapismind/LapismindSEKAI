<script setup>
import { nextTick } from 'vue'
import { useLobbyStore } from '../../src/stores/lobbyStore.js'
import { useGameStore } from '../../src/stores/gameStore.js'
import { wsClient } from '../../src/network/wsClient.js'

const lobby = useLobbyStore()
const game = useGameStore()

const players = [
  {
    id: 'p1', nickname: '青羽', avatarId: '1', score: 7, health: 2, alive: true, isHost: true,
    handSize: 2, hand: [1, 7], secretsCount: 1, secrets: [4],
  },
  {
    id: 'p2', nickname: '赤焰', avatarId: '2', score: 5, health: 0, alive: false, isHost: false,
    handSize: 3, hand: [2, 5, 8], secretsCount: 0, secrets: [],
  },
]

const roundSummaries = {
  kill: {
    reason: 'kill', winnerId: 'p1', decisiveSpellId: 7,
    standings: [
      { id: 'p1', nickname: '青羽', score: 7, gained: 5, scoreBySource: { roundWinPoints: 3, survivalPoints: 0, secretPoints: 2 } },
      { id: 'p2', nickname: '赤焰', score: 5, gained: 0, scoreBySource: { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 } },
    ],
  },
  all_spells: {
    reason: 'all_spells', winnerId: 'p1', decisiveSpellId: 8,
    standings: [
      { id: 'p1', nickname: '青羽', score: 7, gained: 4, scoreBySource: { roundWinPoints: 3, survivalPoints: 0, secretPoints: 1 } },
      { id: 'p2', nickname: '赤焰', score: 5, gained: 0, scoreBySource: { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 } },
    ],
  },
  self_destruct: {
    reason: 'self_destruct', winnerId: null, decisiveSpellId: 1,
    standings: [
      { id: 'p1', nickname: '青羽', score: 7, gained: 2, scoreBySource: { roundWinPoints: 0, survivalPoints: 1, secretPoints: 1 } },
      { id: 'p2', nickname: '赤焰', score: 5, gained: 0, scoreBySource: { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 } },
    ],
  },
}

const matchStandings = [
  {
    id: 'p1', playerId: 'p1', nickname: '青羽', avatarId: '1', rank: 1, score: 9,
    scoreBySource: { roundWinPoints: 6, survivalPoints: 1, secretPoints: 2 },
    kills: 3, dragonKills: 1, deaths: 1, roundWins: 2,
    roundWinsByReason: { kill: 1, all_spells: 1 }, maxTurnCastCount: 4, maxTurnDistinctSpells: 3,
  },
  {
    id: 'p2', playerId: 'p2', nickname: '赤焰', avatarId: '2', rank: 2, score: 5,
    scoreBySource: { roundWinPoints: 3, survivalPoints: 2, secretPoints: 0 },
    kills: 1, dragonKills: 0, deaths: 2, roundWins: 1,
    roundWinsByReason: { kill: 1, all_spells: 0 }, maxTurnCastCount: 2, maxTurnDistinctSpells: 2,
  },
]

function setRound(reason = 'kill') {
  const summary = roundSummaries[reason]
  game.lastGameOver = null
  game.gameOverOpen = false
  game.matchReportStatus = null
  game.newAchievements = []
  game.roomState = {
    phase: 'round_end', round: 3, hostId: 'p1', currentPlayerId: null, targetScore: 8,
    players, castCounts: {}, matchHistory: [], deckRemaining: 9, secretPileRemaining: 3,
    castSucceeded: {}, castFailed: {}, summary, startingHand: [1, 4, 4, 7, 8],
  }
  game.roundEndSummary = summary
}

function setMatch({ legacy = false } = {}) {
  game.roomState = {
    phase: 'game_over', round: 4, hostId: 'p1', currentPlayerId: null, targetScore: 8,
    players: matchStandings.map(row => ({ ...row, health: 2, alive: true, isHost: row.id === 'p1', hand: [], secrets: [], secretsCount: 0 })),
    castCounts: {}, matchHistory: [], deckRemaining: 0, secretPileRemaining: 0, castSucceeded: {}, castFailed: {},
  }
  game.lastGameOver = legacy
    ? { winnerId: 'p1', standings: matchStandings.map(({ id, nickname, avatarId, score }) => ({ id, nickname, avatarId, score })) }
    : {
        reportId: 'report-b5', winnerId: 'p1', rounds: 4, standings: matchStandings,
        stories: [
          { key: 'comeback_win', playerId: 'p1', tier: 'S', data: { playerScoreBefore: 2, opponentScoreBefore: 7, finalScore: 9 } },
          { key: 'low_hp_kill', playerId: 'p1', tier: 'A', data: { round: 3, spellId: 7, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' } },
          { key: 'round_win_routes', playerId: 'p1', tier: 'B', data: { kill: 1, allSpells: 1 } },
        ],
      }
  game.newAchievements = legacy ? [] : [
    { playerId: 'p1', key: 'one', stars: 4, name: '第一项', desc: '第一项事实说明' },
    { playerId: 'p1', key: 'two', stars: 3, name: '第二项', desc: '第二项事实说明' },
    { playerId: 'p2', key: 'three', stars: 2, name: '第三项', desc: '第三项事实说明' },
  ]
  game.matchReportStatus = legacy ? null : { reportId: 'report-b5', saved: false, message: '战报暂未保存' }
  game.gameOverOpen = true
}

lobby.myPlayerId = 'p1'
game.inRoom = true
game.roomId = 'B5TEST'
wsClient.send = (type, payload) => window.__b5Sent.push({ type, payload })
window.__b5Sent = []
window.__b5SetRound = async reason => { setRound(reason); await nextTick() }
window.__b5SetMatch = async () => { setMatch(); await nextTick() }
window.__b5SetLegacy = async () => { setMatch({ legacy: true }); await nextTick() }
setRound()
</script>

<template>
  <RouterView />
</template>
