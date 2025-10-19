<template>
  <div class="panel" style="margin-top:12px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <strong>Choose World</strong>
      <button @click="$emit('close')" :disabled="isLoading">Close</button>
    </div>
    <div v-if="worlds.length === 0 && !isLoading" class="small">No worlds available.</div>
    <div v-if="isLoading" class="small">Loading…</div>
    <ul v-else style="list-style:none; padding:0; margin:0;">
      <li v-for="w in worlds" :key="w.id" style="display:flex; gap:10px; border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ w.name }}</div>
          <div class="small" style="opacity:0.9; max-height:4.8em; overflow:hidden;">{{ w.description }}</div>
        </div>
        <div style="display:flex; align-items:center;">
          <button @click="startWorld(w.id)" :disabled="isLoading">Start</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

type WorldItem = { id: string; name: string; description: string; intro?: string };
type ChatMessage = { role: string; content: string };

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'started', payload: { messages: ChatMessage[]; saveId: string; worldId: string; title: string }): void;
}>();

const worlds = ref<WorldItem[]>([]);
const isLoading = ref(false);

async function fetchWorlds() {
  isLoading.value = true;
  try {
    const r = await fetch('/api/worlds');
    const d = await r.json();
    const arr = Array.isArray(d.worlds) ? d.worlds : [];
    worlds.value = arr
      .filter((w: any) => w && typeof w.id === 'string' && typeof w.name === 'string')
      .map((w: any) => ({ id: w.id, name: String(w.name), description: String(w.description || ''), intro: String(w.intro || '') }));
  } catch (_) {
    worlds.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function startWorld(selectedWorldId: string) {
  if (!selectedWorldId || isLoading.value) return;
  isLoading.value = true;
  try {
    const res = await fetch(`/api/history?worldId=${encodeURIComponent(selectedWorldId)}`);
    const data = await res.json().catch(() => ({}));
    if (typeof data.error === 'string' && data.error) throw new Error(data.error);
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    const messages: ChatMessage[] = msgs
      .filter((m: any) => m && typeof m.content === 'string' && typeof m.role === 'string')
      .map((m: any) => ({ role: m.role, content: m.content }));
    const sid = typeof data.saveId === 'string' ? data.saveId : '';
    const wid = typeof data.worldId === 'string' ? data.worldId : '';
    const t = typeof data.title === 'string' ? data.title : 'New Game';
    emit('started', { messages, saveId: sid, worldId: wid, title: t });
  } catch (e: any) {
    alert(`Failed to start world: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchWorlds();
});
</script>


