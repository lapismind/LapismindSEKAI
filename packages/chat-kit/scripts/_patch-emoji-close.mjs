import { readFileSync, writeFileSync } from 'node:fs'

const file = 'D:/LapismindSEKAI/packages/chat-kit/src/vue/EmojiPicker.vue'
let c = readFileSync(file, 'utf8')

// Remove the entire picker-header div
c = c.replace(/<div class="picker-header">[\s\S]*?<\/div>/, '')

// Add close button after the folder buttons, inside folder-tabs
c = c.replace(
  '</button>\n    </div>',
  '</button>\n      <button @click="$emit('close')" class="folder-tab close-tab">×</button>\n    </div>'
)

// Remove unused header styles
c = c.replace(/\.picker-header \{[\s\S]*?\}/, '')
c = c.replace(/\.picker-header h4 \{[\s\S]*?\}/, '')

// Update close-button to look like a folder tab
c = c.replace(
  /\.close-button \{[\s\S]*?\}/,
  '.close-tab {\n  padding: 3px 8px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  background: white;\n  cursor: pointer;\n  font-size: 11px;\n  color: #666;\n  min-width: 28px;\n  margin-left: auto;\n}\n.close-tab:hover {\n  border-color: #999;\n}'
)

writeFileSync(file, c)
console.log('Patched EmojiPicker: moved close button to folder-tabs row')
