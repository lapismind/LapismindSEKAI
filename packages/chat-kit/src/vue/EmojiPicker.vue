<template>
  <div class="emoji-picker">
    <div class="picker-header">
      
      <button @click="$emit('close')" class="close-button">×</button>
    </div>
    
    <!-- 文件夹选择 -->
    <div class="folder-tabs">
      <button 
        v-for="folder in folderList" 
        :key="folder"
        :class="['folder-tab', { active: activeFolder === folder }]"
        @click="activeFolder = folder"
      >
        {{ folder === 'other' ? '其他' : folder }}
      </button>
    </div>
    
    <!-- 表情网格 -->
    <div class="emoji-grid">
      <div 
        v-for="emoji in currentEmojis" 
        :key="emoji.file"
        class="emoji-item"
        @click="selectEmoji(emoji)"
        :title="emoji.file.replace('.png', '')"
      >
        <img 
          :src="emoji.path" 
          :alt="emoji.file"
          class="emoji-preview"
          loading="lazy"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import manifest from '../emoji-manifest.json'

const emit = defineEmits(['select', 'close'])

const folderList = Object.keys(manifest)
const activeFolder = ref(folderList[0] || '1')

const currentEmojis = computed(() => {
  return manifest[activeFolder.value] || []
})

const selectEmoji = (emoji) => {
  emit('select', activeFolder.value, emoji.file.replace('.png', ''))
}
</script>

<style scoped>
.emoji-picker {
  position: relative;
  width: 100%;
  width: 380px;
  max-height: 500px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.picker-header h4 {
  margin: 0;
  font-size: 14px;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-button:hover {
  color: #333;
}

.folder-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
  max-height: 80px;
  overflow-y: auto;
}

.folder-tab {
  padding: 3px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 11px;
  color: #666;
  min-width: 28px;
}

.folder-tab:hover {
  border-color: #999;
}

.folder-tab.active {
  color: #007bff;
  border-color: #007bff;
  background: #e6f2ff;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  padding: 10px;
  max-height: 380px;
  overflow-y: auto;
}

.emoji-item {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
  padding: 4px;
}

.emoji-item:hover {
  background-color: #f0f0f0;
  transform: scale(1.1);
}

.emoji-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
