<template>
  <div class="emoji-picker">
    <div class="picker-header">
      <h4>选择表情</h4>
      <button @click="$emit('close')" class="close-button">×</button>
    </div>
    
    <!-- 文件夹选择 -->
    <div class="folder-tabs">
      <button 
        v-for="folder in folders" 
        :key="folder.id"
        :class="['folder-tab', { active: activeFolder === folder.id }]"
        @click="activeFolder = folder.id"
      >
        {{ folder.name }}
      </button>
    </div>
    
    <!-- 表情网格 -->
    <div class="emoji-grid" ref="emojiGrid">
      <div 
        v-for="emoji in currentEmojis" 
        :key="emoji.id"
        class="emoji-item"
        @click="selectEmoji(emoji)"
      >
        <img 
          :src="emoji.path" 
          :alt="emoji.fileName"
          class="emoji-preview"
          loading="lazy"
        />
        <span class="emoji-id">{{ emoji.fileName.replace('.png', '') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['select', 'close'])

// 文件夹定义
const folders = [
  { id: '1', name: '1' },
  { id: '2', name: '2' },
  { id: '3', name: '3' },
  { id: '4', name: '4' },
  { id: '5', name: '5' },
  { id: '6', name: '6' },
  { id: '7', name: '7' },
  { id: '8', name: '8' },
  { id: '9', name: '9' },
  { id: '10', name: '10' },
  { id: '11', name: '11' },
  { id: '12', name: '12' },
  { id: '13', name: '13' },
  { id: '14', name: '14' },
  { id: '15', name: '15' },
  { id: '16', name: '16' },
  { id: '17', name: '17' },
  { id: '18', name: '18' },
  { id: '19', name: '19' },
  { id: '20', name: '20' },
  { id: '21', name: '21' },
  { id: '22', name: '22' },
  { id: '23', name: '23' },
  { id: '24', name: '24' },
  { id: '25', name: '25' },
  { id: '26', name: '26' },
  { id: 'other', name: '其他' }
]

const activeFolder = ref('1')

// 表情数据 - 从服务器动态加载
const emojisByFolder = ref({})

// 加载文件夹中的表情
const loadFolderEmojis = async (folderId) => {
  // 这里应该从服务器获取表情列表
  // 目前使用硬编码的数据
  const response = await fetch(`/chat-kit/emojis/${folderId}/`)
  if (response.ok) {
    const html = await response.text()
    // 解析 HTML 获取文件列表
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const links = doc.querySelectorAll('a')
    const emojis = []
    
    links.forEach(link => {
      const href = link.getAttribute('href')
      if (href && href.endsWith('.png')) {
        const fileName = href.split('/').pop()
        emojis.push({
          id: `${folderId}_${fileName.replace('.png', '')}`,
          folder: folderId,
          fileName: fileName,
          path: `/chat-kit/emojis/${folderId}/${fileName}`
        })
      }
    })
    
    emojisByFolder.value[folderId] = emojis
  }
}

// 当前显示的表情
const currentEmojis = computed(() => {
  return emojisByFolder.value[activeFolder.value] || []
})

// 选择表情
const selectEmoji = (emoji) => {
  emit('select', emoji.folder, emoji.fileName.replace('.png', ''))
}

// 初始化时加载第一个文件夹
loadFolderEmojis(activeFolder.value)
</script>

<style scoped>
.emoji-picker {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 400px;
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
  padding: 12px;
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
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
  padding: 8px;
  gap: 4px;
}

.folder-tab {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  color: #666;
}

.folder-tab.active {
  color: #007bff;
  border-color: #007bff;
  background: #e6f2ff;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.emoji-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.emoji-item:hover {
  background-color: #f0f0f0;
}

.emoji-preview {
  width: 40px;
  height: 40px;
  object-fit: contain;
  margin-bottom: 4px;
}

.emoji-id {
  font-size: 10px;
  color: #666;
}
</style>

<template>
  <div class="emoji-picker">
    <div class="picker-header">
      <h4>选择表情</h4>
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
  position: absolute;
  bottom: 60px;
  right: 0;
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
