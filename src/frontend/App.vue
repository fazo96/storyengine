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

    <div v-if="currentScreen === 'game'" id="messages" class="chat panel" aria-live="polite" :aria-busy="isLoading ? 'true' : 'false'">
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <template v-if="m.role === 'assistant' && (!m.content || m.content.length === 0) && isLoading">
          <span class="spinner" aria-hidden="true"></span>{{ loadingText }}
        </template>
        <template v-else>
          <div v-html="renderMarkdown(m.content)"></div>
        </template>
      </div>
    </div>

    <form v-if="currentScreen === 'game'" @submit.prevent="onSubmit">
      <input name="prompt" type="text" placeholder="Ask / Act / Reflect" autocomplete="off" required v-model="prompt" :disabled="isLoading">
      <button type="submit" :aria-busy="isLoading ? 'true' : 'false'" :disabled="isLoading">Synthetise</button>
    </form>

    <div v-if="currentScreen === 'load'" class="panel" style="margin-top:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Load Game</strong>
        <button @click="closeLoad">Close</button>
      </div>
      <div v-if="saves.length === 0" class="small">No saves yet.</div>
      <ul style="list-style:none; padding:0; margin:0;">
        <li v-for="s in saves" :key="s.id" style="display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border); border-radius:8px; padding:8px 10px; margin-bottom:8px; gap:8px;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ s.title || 'Untitled' }}</div>
            <div class="small">#{{ s.id.slice(0,8) }} · {{ new Date(s.updatedAt).toLocaleString() }}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button @click="loadExisting(s.id)">Load</button>
            <button @click="confirmDelete(s.id)" style="background: linear-gradient(180deg, rgba(122,47,75,0.22), rgba(122,47,75,0.10));">Delete</button>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="currentScreen === 'worlds'" class="panel" style="margin-top:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Choose World</strong>
        <button @click="closeWorlds">Close</button>
      </div>
      <div v-if="worlds.length === 0" class="small">No worlds available.</div>
      <ul style="list-style:none; padding:0; margin:0;">
        <li v-for="w in worlds" :key="w.id" style="display:flex; gap:10px; border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ w.name }}</div>
            <div class="small" style="opacity:0.9; max-height:4.8em; overflow:hidden;">{{ w.description }}</div>
          </div>
          <div style="display:flex; align-items:center;">
            <button @click="startWorld(w.id)">Start</button>
          </div>
        </li>
      </ul>
    </div>

    <audio id="bgm" ref="bgmEl" src="/static/assets/Shadows%20in%20the%20Fog.mp3" preload="none" loop style="display:none"></audio>
  </div>

</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick, onMounted } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

type ChatMessage = { role: string; content: string };
type SaveItem = { id: string; title: string; updatedAt: number };
type WorldItem = { id: string; name: string; description: string; intro?: string };

const messages = ref<ChatMessage[]>([]);
const prompt = ref('');
const isLoading = ref(false);
const saveId = ref('');
const worldId = ref('');
const title = ref('New Game');
// One place to control which screen is visible: 'home' | 'worlds' | 'load' | 'game'
const currentScreen = ref<'home' | 'worlds' | 'load' | 'game'>('load');
const worlds = ref<WorldItem[]>([]);
const saves = ref<SaveItem[]>([]);
// Background music element reference
const bgmEl = ref<HTMLAudioElement | null>(null);
const isBgmPlaying = ref(false);

// Themed loading phrases that cycle while waiting for a response
const loadingPhrases = [
  'Consulting the Stationmaster…',
  'Listening to the rails whisper…',
  'Bartering with shadows…',
  'Counting the teeth of old gears…',
  'Stoking the occult engine…',
  'Peering beyond the veil…',
  'Summoning timetables from forgotten years…',
  'Feeding coal to the dreaming boiler…'
];
const loadingText = ref(loadingPhrases[0]);
let loadingTimer: number | null = null;
let phraseIndex = 0;

async function loadHistory(idOverride: string | null = null) {
  try {
    const id = typeof idOverride === 'string' ? idOverride : (saveId.value || '');
    const url = id ? `/api/history?saveId=${encodeURIComponent(id)}` : '/api/history';
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    const sid = typeof data.saveId === 'string' ? data.saveId : '';
    const t = typeof data.title === 'string' ? data.title : '';
    messages.value = msgs
      .filter((m: any) => m && typeof m.content === 'string' && typeof m.role === 'string')
      .map((m: any) => ({ role: m.role, content: m.content }));
    if (sid) {
      saveId.value = sid;
    }
    title.value = t || title.value;
    focusInput();
  } catch (e: any) {
    messages.value = [{ role: 'error', content: `Failed to load history: ${e instanceof Error ? e.message : String(e)}` }];
  }
}

async function onSubmit() {
  const value = prompt.value.trim();
  if (!value || isLoading.value) return;
  messages.value.push({ role: 'user', content: value });
  // Prepare an assistant placeholder message to stream into
  const assistantIndex = messages.value.push({ role: 'assistant', content: '' }) - 1;
  // Clear input immediately on send
  prompt.value = '';
  isLoading.value = true;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send the full chat history so the backend can provide context
      body: JSON.stringify({ saveId: saveId.value || undefined, worldId: worldId.value || undefined, messages: messages.value })
    });

    if (!res.body) {
      throw new Error('No response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let obj: any = null;
        try { obj = JSON.parse(trimmed); } catch { obj = null; }
        if (!obj || typeof obj !== 'object') continue;
        const type = obj.type;
        if (type === 'delta') {
          const chunk = typeof obj.content === 'string' ? obj.content : '';
          if (chunk) {
            messages.value[assistantIndex].content += chunk;
          }
        } else if (type === 'final') {
          const role = typeof obj.role === 'string' ? obj.role : 'assistant';
          const finalContent = typeof obj.content === 'string' ? obj.content : '';
          const err = typeof obj.error === 'string' ? obj.error : '';
          messages.value[assistantIndex].role = role;
          messages.value[assistantIndex].content = err ? `Error: ${err}\n\n${finalContent}` : finalContent;
          const sid = typeof obj.saveId === 'string' ? obj.saveId : '';
          const t = typeof obj.title === 'string' ? obj.title : '';
          if (sid) saveId.value = sid;
          if (t) title.value = t;
        }
      }
    }
  } catch (e: any) {
    messages.value.push({ role: 'error', content: `Request failed: ${e instanceof Error ? e.message : String(e)}` });
  } finally {
    isLoading.value = false;
  }
}

function focusInput() {
  // Focus input field if present, also scroll messages container to bottom
  setTimeout(() => {
    const messagesEl = document.getElementById('messages');
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    const input = document.querySelector('input, textarea') as HTMLElement | null;
    if (input) input.focus();
  }, 100);
}

function openWorlds() {
  currentScreen.value = 'worlds';
  fetch('/api/worlds')
    .then(r => r.json())
    .then(d => {
      const arr = Array.isArray(d.worlds) ? d.worlds : [];
      worlds.value = arr
        .filter((w: any) => w && typeof w.id === 'string' && typeof w.name === 'string')
        .map((w: any) => ({ id: w.id, name: String(w.name), description: String(w.description || ''), intro: String(w.intro || '') }));
    })
    .catch(() => { worlds.value = []; });
}

function closeWorlds() { currentScreen.value = 'game'; }

async function startWorld(selectedWorldId: string) {
  if (!selectedWorldId || isLoading.value) return;
  isLoading.value = true;
  try {
    const res = await fetch(`/api/history?worldId=${encodeURIComponent(selectedWorldId)}`);
    const data = await res.json().catch(() => ({}));
    if (typeof data.error === 'string' && data.error) {
      throw new Error(data.error);
    }
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    messages.value = msgs
      .filter((m: any) => m && typeof m.content === 'string' && typeof m.role === 'string')
      .map((m: any) => ({ role: m.role, content: m.content }));
    const sid = typeof data.saveId === 'string' ? data.saveId : '';
    const wid = typeof data.worldId === 'string' ? data.worldId : '';
    const t = typeof data.title === 'string' ? data.title : '';
    if (sid) {
      saveId.value = sid;
    } else {
      saveId.value = '';
    }
    if (wid) {
      worldId.value = wid;
    } else {
      worldId.value = '';
    }
    title.value = t || 'New Game';
    await playBgm();
  } catch (e: any) {
    alert(`Failed to start world: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    isLoading.value = false;
    currentScreen.value = 'game';
    focusInput();
  }
}

function openLoad() {
  currentScreen.value = 'load';
  fetch('/api/saves')
    .then(r => r.json())
    .then(d => {
      const arr = Array.isArray(d.saves) ? d.saves : [];
      saves.value = arr
        .filter((s: any) => s && typeof s.id === 'string')
        .map((s: any) => ({ id: s.id, title: typeof s.title === 'string' ? s.title : 'Untitled', updatedAt: Number(s.updatedAt) || 0 }));
    })
    .catch(() => { saves.value = []; });
}

function closeLoad() { currentScreen.value = 'game'; }

async function loadExisting(id: string) {
  await loadHistory(id);
  currentScreen.value = 'game';
  await playBgm();
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
  console.log('toggleBgm', el);
  if (!el) return;
  if (el.paused) {
    playBgm();
  } else {
    pauseBgm();
  }
}

async function deleteSave(id: string) {
  try {
    const res = await fetch(`/api/saves/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    const ok = !!data.ok;
    if (ok) {
      if (saveId.value && saveId.value === id) {
        currentScreen.value = 'worlds';
        worldId.value = '';
        saveId.value = '';
        title.value = 'New Game';
      }
      openLoad();
    } else {
      alert('Failed to delete save. It may not exist.');
    }
  } catch (e: any) {
    alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function confirmDelete(id: string) {
  const sure = confirm('Delete this save? This cannot be undone.');
  if (sure) deleteSave(id);
}

// Cycle through loading phrases while isLoading is true
watch(isLoading, (active) => {
  if (active) {
    phraseIndex = Math.floor(Math.random() * loadingPhrases.length);
    loadingText.value = loadingPhrases[phraseIndex];
    if (loadingTimer) clearInterval(loadingTimer);
    loadingTimer = window.setInterval(() => {
      phraseIndex = (phraseIndex + 1) % loadingPhrases.length;
      loadingText.value = loadingPhrases[phraseIndex];
    }, 3000);
  } else {
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
  }
});

// Keep messages scrolled to bottom by default so older messages overflow upward
watch(messages, async () => {
  await nextTick();
  const messagesEl = document.getElementById('messages');
  if (messagesEl) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
});

onBeforeUnmount(() => {
  if (loadingTimer) clearInterval(loadingTimer);
});

onMounted(() => {
  // Show saves list by default on start
  openLoad();
});

function renderMarkdown(text: string) {
  try {
    // Render GitHub-flavored markdown with line-breaks
    marked.setOptions({ breaks: true, gfm: true, mangle: false, headerIds: false });
    const rawHtml = marked.parse(String(text ?? '')) as string;
    return DOMPurify.sanitize(rawHtml);
  } catch (_) {
    return String(text ?? '');
  }
}

// Expose to template
defineExpose({});

// return values for template are auto-exposed in <script setup>
const _expose = {
  messages,
  prompt,
  isLoading,
  onSubmit,
  loadingText,
  saveId,
  title,
  saves,
  openWorlds,
  closeWorlds,
  startWorld,
  openLoad,
  closeLoad,
  loadExisting,
  deleteSave,
  confirmDelete,
  renderMarkdown,
  bgmEl,
  isBgmPlaying,
  toggleBgm,
  worlds,
  currentScreen
};
</script>

