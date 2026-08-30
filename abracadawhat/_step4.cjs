const fs = require('fs');
const c = fs.readFileSync('src/views/RoomView.vue', 'utf8');
const arr = c.split('\n');
arr.splice(104, 0,
  '          <button type="button" class="rounded-lg-border border-red-200 bg-white px-3 py-1.5 text-es font-semibold text-red-500 hover-border-red-300 hover-bg-red-50" @click="gToLoby">',
  '            ✅ 明昏',
            </button>'
);
fs.writeFileSync('src/views/RoomView.vue', arr.join('\n'), 'utf8');
console.log('done');