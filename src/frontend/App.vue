<template>
  <div class="container">
    <header>
      <h1>Storyengine <span class="sigil" v-if="title && currentScreen === 'game'">— {{ title }}</span></h1>
      <span class="small">AI powered story game made with 🤖 by <a href="https://github.com/fazo96" target="_blank" rel="noreferrer">fazo96</a></span>
    </header>

    <div style="display:flex; gap:10px; align-items:center; padding:10px 0 6px;">
      <span v-if="currentScreen === 'game'" class="small">Save: {{ title || 'New Game' }}<span v-if="saveId"> (#{{ saveId.slice(0,8) }})</span></span>
      <button @click="openWorlds" :disabled="isLoading">New Game</button>
      <button v-if="currentScreen === 'game'" @click="openLoad" :disabled="isLoading">Load Game</button>
      <button v-if="currentScreen === 'game'" @click="toggleBgm" :disabled="isLoading">{{ isBgmPlaying ? 'Pause Music' : 'Play Music' }}</button>
    </div>

    <GameScreen
      v-if="currentScreen === 'game'"
      :initial-data="gameInitialData"
      @update-meta="onGameMeta"
      @busy="onGameBusy"
    />

    <LoadScreen
      v-if="currentScreen === 'load'"
      @close="closeLoad"
      @loaded="onLoadedFromSave"
    />

    <WorldsScreen
      v-if="currentScreen === 'worlds'"
      @close="closeWorlds"
      @started="onStartedWorld"
    />

    <audio id="bgm" ref="bgmEl" src="/static/assets/Shadows%20in%20the%20Fog.mp3" preload="none" loop style="display:none"></audio>
  </div>

</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import GameScreen from './components/GameScreen.vue';
import LoadScreen from './components/LoadScreen.vue';
import WorldsScreen from './components/WorldsScreen.vue';

type ChatMessage = { role: string; content: string };

const isLoading = ref(false);
const saveId = ref('');
const worldId = ref('');
const title = ref('New Game');
const currentScreen = ref<'home' | 'worlds' | 'load' | 'game'>('load');

const gameInitialData = ref<{ messages?: ChatMessage[]; saveId?: string; worldId?: string; title?: string }>({});

const bgmEl = ref<HTMLAudioElement | null>(null);
const isBgmPlaying = ref(false);

function openWorlds() {
  currentScreen.value = 'worlds';
}

function closeWorlds() {
  currentScreen.value = 'game';
}

function openLoad() {
  currentScreen.value = 'load';
}

function closeLoad() {
  currentScreen.value = 'game';
}

async function playBgm() {
  const el = bgmEl.value;
  if (!el) return;
  try {
    el.volume = 0.5;
    await el.play();
    isBgmPlaying.value = true;
  } catch (_) {
    isBgmPlaying.value = false;
  }
}

async function pauseBgm() {
  const el = bgmEl.value;
  if (!el) return;
  try {
    await el.pause();
  } finally {
    isBgmPlaying.value = false;
  }
}

function toggleBgm() {
  const el = bgmEl.value;
  if (!el) return;
  if (el.paused) {
    playBgm();
  } else {
    pauseBgm();
  }
}

function onGameMeta(payload: { title?: string; saveId?: string; worldId?: string }) {
  if (typeof payload.title === 'string' && payload.title) title.value = payload.title;
  if (typeof payload.saveId === 'string') saveId.value = payload.saveId;
  if (typeof payload.worldId === 'string') worldId.value = payload.worldId;
}

function onGameBusy(busy: boolean) {
  isLoading.value = !!busy;
}

function onLoadedFromSave(payload: { messages: ChatMessage[]; saveId: string; title: string }) {
  gameInitialData.value = { messages: payload.messages, saveId: payload.saveId, title: payload.title };
  saveId.value = payload.saveId;
  title.value = payload.title || 'New Game';
  currentScreen.value = 'game';
  playBgm();
}

function onStartedWorld(payload: { messages: ChatMessage[]; saveId: string; worldId: string; title: string }) {
  gameInitialData.value = { messages: payload.messages, saveId: payload.saveId, worldId: payload.worldId, title: payload.title };
  saveId.value = payload.saveId || '';
  worldId.value = payload.worldId || '';
  title.value = payload.title || 'New Game';
  currentScreen.value = 'game';
  playBgm();
}

onMounted(() => {
  // Show saves list by default on start
  openLoad();
});

defineExpose({});
</script>

