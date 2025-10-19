<template>
  <div>
    <div id="messages" class="chat panel" aria-live="polite" :aria-busy="isLoading ? 'true' : 'false'">
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <template v-if="m.role === 'assistant' && (!m.content || m.content.length === 0) && isLoading">
          <span class="spinner" aria-hidden="true"></span>{{ loadingText }}
        </template>
        <template v-else>
          <div v-html="renderMarkdown(m.content)"></div>
        </template>
      </div>
    </div>

    <form @submit.prevent="onSubmit">
      <input name="prompt" type="text" placeholder="Ask / Act / Reflect" autocomplete="off" required v-model="prompt" :disabled="isLoading">
      <button type="submit" :aria-busy="isLoading ? 'true' : 'false'" :disabled="isLoading">Synthetise</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

type ChatMessage = { role: string; content: string };

const props = defineProps<{
  initialData?: {
    messages?: ChatMessage[];
    saveId?: string;
    worldId?: string;
    title?: string;
  };
}>();

const emit = defineEmits<{
  (e: 'update-meta', payload: { title?: string; saveId?: string; worldId?: string }): void;
  (e: 'busy', payload: boolean): void;
}>();

const messages = ref<ChatMessage[]>([]);
const prompt = ref('');
const isLoading = ref(false);
const saveId = ref('');
const worldId = ref('');
const title = ref('New Game');

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

function applyInitialData() {
  const d = props.initialData || {};
  messages.value = Array.isArray(d.messages) ? d.messages : [];
  saveId.value = typeof d.saveId === 'string' ? d.saveId : '';
  worldId.value = typeof d.worldId === 'string' ? d.worldId : '';
  title.value = typeof d.title === 'string' && d.title ? d.title : 'New Game';
  emit('update-meta', { title: title.value, saveId: saveId.value, worldId: worldId.value });
  focusInput();
}

async function onSubmit() {
  const value = prompt.value.trim();
  if (!value || isLoading.value) return;
  messages.value.push({ role: 'user', content: value });
  const assistantIndex = messages.value.push({ role: 'assistant', content: '' }) - 1;
  prompt.value = '';
  isLoading.value = true;
  emit('busy', true);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId: saveId.value || undefined, worldId: worldId.value || undefined, messages: messages.value })
    });

    if (!res.body) throw new Error('No response body');

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
          if (chunk) messages.value[assistantIndex].content += chunk;
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
          emit('update-meta', { title: title.value, saveId: saveId.value, worldId: worldId.value });
        }
      }
    }
  } catch (e: any) {
    messages.value.push({ role: 'error', content: `Request failed: ${e instanceof Error ? e.message : String(e)}` });
  } finally {
    isLoading.value = false;
    emit('busy', false);
  }
}

function focusInput() {
  setTimeout(() => {
    const messagesEl = document.getElementById('messages');
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    const input = document.querySelector('input, textarea') as HTMLElement | null;
    if (input) input.focus();
  }, 100);
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

// Keep messages scrolled to bottom by default
watch(messages, async () => {
  await nextTick();
  const messagesEl = document.getElementById('messages');
  if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
});

onBeforeUnmount(() => {
  if (loadingTimer) clearInterval(loadingTimer);
});

onMounted(() => {
  applyInitialData();
});

function renderMarkdown(text: string) {
  try {
    marked.setOptions({ breaks: true, gfm: true, mangle: false, headerIds: false });
    const rawHtml = marked.parse(String(text ?? '')) as string;
    return DOMPurify.sanitize(rawHtml);
  } catch (_) {
    return String(text ?? '');
  }
}

defineExpose({});
</script>


