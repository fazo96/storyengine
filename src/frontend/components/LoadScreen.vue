<template>
  <div class="panel" style="margin-top:12px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <strong>Load Game</strong>
      <button @click="$emit('close')" :disabled="isLoading">Close</button>
    </div>
    <div v-if="saves.length === 0 && !isLoading" class="small">No saves yet.</div>
    <div v-if="isLoading" class="small">Loading…</div>
    <ul v-else style="list-style:none; padding:0; margin:0;">
      <li v-for="s in saves" :key="s.id" style="display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border); border-radius:8px; padding:8px 10px; margin-bottom:8px; gap:8px;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ s.title || 'Untitled' }}</div>
          <div class="small">#{{ s.id.slice(0,8) }} · {{ new Date(s.updatedAt).toLocaleString() }}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="loadExisting(s.id)" :disabled="isLoading">Load</button>
          <button @click="confirmDelete(s.id)" :disabled="isLoading" style="background: linear-gradient(180deg, rgba(122,47,75,0.22), rgba(122,47,75,0.10));">Delete</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

type SaveItem = { id: string; title: string; updatedAt: number };
type ChatMessage = { role: string; content: string };

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'loaded', payload: { messages: ChatMessage[]; saveId: string; title: string }): void;
}>();

const saves = ref<SaveItem[]>([]);
const isLoading = ref(false);

async function fetchSaves() {
  isLoading.value = true;
  try {
    const res = await fetch('/api/saves');
    const d = await res.json().catch(() => ({}));
    const arr = Array.isArray(d.saves) ? d.saves : [];
    saves.value = arr
      .filter((s: any) => s && typeof s.id === 'string')
      .map((s: any) => ({ id: s.id, title: typeof s.title === 'string' ? s.title : 'Untitled', updatedAt: Number(s.updatedAt) || 0 }));
  } catch (_) {
    saves.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadExisting(id: string) {
  if (!id || isLoading.value) return;
  isLoading.value = true;
  try {
    const res = await fetch(`/api/history?saveId=${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => ({}));
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    const messages: ChatMessage[] = msgs
      .filter((m: any) => m && typeof m.content === 'string' && typeof m.role === 'string')
      .map((m: any) => ({ role: m.role, content: m.content }));
    const sid = typeof data.saveId === 'string' ? data.saveId : '';
    const t = typeof data.title === 'string' ? data.title : 'New Game';
    emit('loaded', { messages, saveId: sid, title: t });
  } catch (e: any) {
    alert(`Failed to load save: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    isLoading.value = false;
  }
}

async function deleteSave(id: string) {
  try {
    const res = await fetch(`/api/saves/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    const ok = !!data.ok;
    if (ok) {
      await fetchSaves();
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

onMounted(() => {
  fetchSaves();
});
</script>


