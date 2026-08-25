<script setup>
/**
 * 右上角用户头像岛 —— 游客显示 0 号占位头像（点击可登录），
 * GitHub 用户显示自己的头像（点击可退出）。全站 Header 共用。
 */
import { onMounted, ref } from 'vue'
import { createAuthClient } from '@lapismind/lobby-kit'
import guestAvatar from '@lapismind/lobby-kit/avatars/0.png'

const user = ref(null)
const open = ref(false)
const auth = createAuthClient()

onMounted(async () => {
  await auth.init()
  user.value = auth.getUser()
})

function login() {
  auth.loginWithGithub(location.pathname + location.search)
}

async function logout() {
  await auth.logout()
  open.value = false
  location.reload()
}
</script>

<template>
  <div class="user-avatar" @mouseleave="open = false">
    <button type="button" class="avatar-btn" :aria-label="user?.nickname || '游客'" @click="open = !open">
      <img
        :src="user?.avatarUrl || guestAvatar"
        alt=""
        class="avatar-img"
        :class="{ 'is-guest': !user?.avatarUrl }"
      />
      <span v-if="!user?.avatarUrl" class="guest-dot" title="游客"></span>
    </button>

    <transition name="pop">
      <div v-if="open" class="menu">
        <template v-if="user?.provider === 'github'">
          <div class="menu-head">
            <img :src="user.avatarUrl" alt="" class="menu-avatar" />
            <span class="menu-name">{{ user.nickname }}</span>
          </div>
          <button type="button" class="menu-item" @click="logout">退出登录</button>
        </template>
        <template v-else>
          <div class="menu-head">
            <span class="menu-name muted">游客身份 · 可玩所有游戏</span>
          </div>
          <button type="button" class="menu-item primary" @click="login">
            GitHub 登录
          </button>
        </template>
      </div>
    </transition>
  </div>
</template>

<style scoped>
  .user-avatar {
    position: relative;
  }
  .avatar-btn {
    position: relative;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--card-solid);
    cursor: var(--cursor-pointer);
    transition: border-color 0.2s ease, transform 0.2s ease;
  }
  .avatar-btn:hover {
    border-color: var(--primary);
    transform: translateY(-1px);
  }
  .avatar-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  .avatar-img.is-guest {
    opacity: 0.85;
  }
  /* 游客角标：小圆点提示当前是游客身份 */
  .guest-dot {
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--muted);
    border: 2px solid var(--page-bg);
  }
  .menu {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    min-width: 200px;
    padding: 0.6rem;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--card-solid);
    box-shadow: var(--shadow-sm);
    z-index: 60;
  }
  .menu-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0.5rem 0.6rem;
  }
  .menu-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }
  .menu-name {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--ink);
  }
  .menu-name.muted {
    font-weight: 400;
    color: var(--muted);
  }
  .menu-item {
    display: block;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--ink-soft);
    font-size: 0.88rem;
    text-align: left;
    cursor: var(--cursor-pointer);
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .menu-item:hover {
    background: var(--primary-ghost);
    color: var(--primary);
  }
  .menu-item.primary {
    background: var(--gradient);
    color: #fff;
    font-weight: 600;
    text-align: center;
  }
  .menu-item.primary:hover {
    filter: brightness(1.08);
    color: #fff;
  }
  .pop-enter-active,
  .pop-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
  .pop-enter-from,
  .pop-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
</style>
