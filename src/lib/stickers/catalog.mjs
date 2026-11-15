// The sticker set. Authors type :id: in Markdown; art.mjs draws each sticker
// from the parts named here. label is the alt text and catalogue name. Memes
// carry a caption and show larger in text than the small emotes.
//
// The gorilla is one character: round glasses and a hoodie unless a sticker
// says otherwise. The glasses come off only in bed (glasses: 'none'); shades
// and glare are the same frames with something else in them. After adding or
// changing a caption, run `node scripts/sticker-glyphs.mjs`.

export const groups = [
  { id: 'emotion', label: '情绪' },
  { id: 'reaction', label: '反应' },
  { id: 'gesture', label: '手势' },
  { id: 'meme', label: '梗图' },
  { id: 'code', label: '编程与刷题' },
  { id: 'life', label: '生活' },
];

const sticker = (id, label, group, parts) => ({ id, label, group, ...parts });

export const stickers = [
  // Emotions
  sticker('smile', '微笑', 'emotion', {
    eyes: 'open',
    mouth: 'smile',
    blink: true,
  }),
  sticker('grin', '大笑', 'emotion', {
    eyes: 'happy',
    brows: 'raised',
    mouth: 'grin',
    tilt: -4,
  }),
  sticker('laugh_cry', '笑哭', 'emotion', {
    eyes: 'joy',
    brows: 'raised',
    mouth: 'big',
    tilt: 6,
    extras: ['tears_joy'],
    motion: 'bounce',
  }),
  sticker('happy', '开心', 'emotion', {
    body: 'tee',
    eyes: 'happy',
    brows: 'raised',
    mouth: 'grin',
    hands: ['cheer'],
    motion: 'bounce',
  }),
  sticker('love', '喜欢', 'emotion', {
    eyes: 'heart',
    mouth: 'smile',
    extras: ['blush', 'hearts'],
  }),
  sticker('blush', '害羞', 'emotion', {
    eyes: 'open',
    look: [-4, 3],
    brows: 'worried',
    mouth: 'cat',
    tilt: 8,
    extras: ['blush'],
  }),
  sticker('kiss', '亲亲', 'emotion', {
    eyes: ['closed', 'open'],
    brows: ['neutral', 'raised'],
    mouth: 'kiss',
    tilt: -6,
    extras: ['hearts'],
  }),
  sticker('wink', '眨眼', 'emotion', {
    eyes: ['open', 'happy'],
    brows: ['neutral', 'raised'],
    mouth: 'tongue',
    tilt: 5,
    extras: ['sparkles'],
  }),
  sticker('cool', '酷', 'emotion', {
    glasses: 'shades',
    gear: 'cap',
    brows: 'flat',
    mouth: 'smirk',
    tilt: -4,
    hands: ['thumb'],
  }),
  sticker('cry', '哭泣', 'emotion', {
    eyes: 'open',
    brows: 'sad',
    mouth: 'frown',
    extras: ['tears_stream'],
  }),
  sticker('sob', '大哭', 'emotion', {
    eyes: 'joy',
    brows: 'worried',
    mouth: 'wail',
    squash: [1.04, 0.97],
    extras: ['tears_fountain'],
    motion: 'shake',
  }),
  sticker('sad', '难过', 'emotion', {
    eyes: 'open',
    look: [0, 3],
    brows: 'worried',
    mouth: 'frown',
    extras: ['rain'],
  }),
  sticker('angry', '生气', 'emotion', {
    eyes: 'open',
    brows: 'angry',
    mouth: 'gritted',
    extras: ['veins'],
    motion: 'shake',
  }),

  // Reactions
  sticker('surprise', '惊讶', 'reaction', {
    eyes: 'wide',
    brows: 'raised',
    mouth: 'o',
    extras: ['exclaim'],
  }),
  sticker('shock', '震惊', 'reaction', {
    eyes: 'tiny',
    brows: 'high',
    mouth: 'scream',
    squash: [0.96, 1.07],
    extras: ['sweat'],
    motion: 'shake',
  }),
  sticker('confused', '疑惑', 'reaction', {
    eyes: 'open',
    look: [3, -2],
    brows: ['raised', 'angry'],
    mouth: 'flat',
    tilt: 8,
    extras: ['question'],
  }),
  sticker('speechless', '无语', 'reaction', {
    eyes: 'half',
    brows: 'flat',
    mouth: 'flat',
    extras: ['speech_dots', 'sweat'],
  }),
  sticker('awkward', '尴尬', 'reaction', {
    eyes: 'open',
    look: [-4, 0],
    brows: 'worried',
    mouth: 'grimace',
    extras: ['sweat'],
  }),
  sticker('facepalm', '捂脸', 'reaction', {
    eyes: 'half',
    brows: 'flat',
    mouth: 'flat',
    tilt: -5,
    hands: ['facepalm'],
  }),
  sticker('dizzy', '头晕', 'reaction', {
    eyes: 'spiral',
    brows: 'neutral',
    mouth: 'wavy',
    extras: ['stars'],
    motion: 'wobble',
  }),
  sticker('sleepy', '犯困', 'reaction', {
    eyes: 'sleepy',
    brows: 'flat',
    mouth: 'yawn',
    tilt: -6,
    extras: ['eyebags', 'snot'],
  }),
  sticker('sleep', '睡觉', 'reaction', {
    glasses: 'none',
    gear: 'nightcap',
    body: 'pajama',
    eyes: 'closed',
    brows: 'flat',
    mouth: 'pout',
    tilt: 4,
    extras: ['zzz'],
    motion: 'sway',
  }),
  sticker('pitiful', '可怜', 'reaction', {
    eyes: 'big',
    brows: 'worried',
    mouth: 'pout',
    tilt: 6,
    lift: -8,
    hands: ['poke'],
    extras: ['tears_well'],
  }),

  // Gestures
  sticker('thumbs_up', '点赞', 'gesture', {
    eyes: 'happy',
    mouth: 'smile',
    hands: ['thumb'],
  }),
  sticker('clap', '鼓掌', 'gesture', {
    eyes: 'open',
    brows: 'raised',
    mouth: 'grin',
    hands: ['clap'],
    lift: -8,
    motion: 'bounce',
  }),
  sticker('ok', '好的', 'gesture', {
    gear: 'cap',
    eyes: 'open',
    mouth: 'smile',
    hands: ['ok'],
  }),
  sticker('wave', '挥手', 'gesture', {
    body: 'tee',
    eyes: 'open',
    mouth: 'grin',
    tilt: -5,
    hands: ['wave'],
  }),
  sticker('salute', '敬礼', 'gesture', {
    gear: 'cap',
    eyes: 'open',
    brows: 'angry',
    mouth: 'flat',
    hands: ['salute'],
  }),
  sticker('pray', '拜托', 'gesture', {
    eyes: 'big',
    brows: 'worried',
    mouth: 'smile',
    lift: -8,
    hands: ['pray'],
  }),
  sticker('fist', '加油', 'gesture', {
    gear: 'headband',
    eyes: 'open',
    brows: 'fierce',
    mouth: 'grin',
    hands: ['fist'],
    motion: 'bounce',
  }),
  sticker('heart_hands', '比心', 'gesture', {
    eyes: 'happy',
    mouth: 'smile',
    lift: -8,
    hands: ['heart_hands'],
    extras: ['blush', 'hearts'],
  }),
  sticker('think', '思考', 'gesture', {
    eyes: 'open',
    look: [4, -4],
    brows: ['raised', 'neutral'],
    mouth: 'flat',
    tilt: 5,
    hands: ['think'],
    extras: ['thought'],
  }),
  sticker('shush', '嘘', 'gesture', {
    eyes: 'half',
    look: [-3, 0],
    brows: 'flat',
    mouth: 'pout',
    tilt: 4,
    hands: ['shush'],
  }),

  // Memes
  sticker('rofl', '笑死', 'meme', {
    caption: '笑死',
    body: 'tee',
    eyes: 'joy',
    brows: 'raised',
    mouth: 'big',
    tilt: -10,
    squash: [1.05, 0.95],
    extras: ['tears_fountain'],
    motion: 'shake',
  }),
  sticker('smug', '得意', 'meme', {
    caption: '就这？',
    eyes: 'smug',
    look: [3, 2],
    brows: ['low', 'high'],
    mouth: 'smirk',
    tilt: 8,
    extras: ['snort'],
  }),
  sticker('eyeroll', '白眼', 'meme', {
    caption: '呵呵',
    eyes: 'roll',
    brows: 'flat',
    mouth: 'smile',
    tilt: -5,
  }),
  sticker('mock', '略略略', 'meme', {
    caption: '略略略',
    eyes: 'happy',
    brows: 'raised',
    mouth: 'blep',
    tilt: 10,
    hands: ['taunt'],
    motion: 'wobble',
  }),
  sticker('point_laugh', '嘲笑', 'meme', {
    caption: '哈哈哈',
    eyes: 'joy',
    brows: 'raised',
    mouth: 'big',
    tilt: 6,
    hands: ['point'],
    extras: ['tears_joy'],
    motion: 'shake',
  }),
  sticker('thumbs_down', '差评', 'meme', {
    caption: '不行',
    eyes: 'half',
    brows: 'low',
    mouth: 'frown',
    hands: ['thumb_down'],
  }),
  sticker('derp', '傻眼', 'meme', {
    caption: '啊？',
    eyes: 'derp',
    brows: ['raised', 'sad'],
    mouth: 'drool',
    tilt: 12,
    squash: [1.04, 0.96],
  }),
  sticker('dead', '寄了', 'meme', {
    caption: '寄了',
    gear: 'halo',
    eyes: 'x',
    brows: 'flat',
    mouth: 'blep',
    tilt: 12,
    lift: 6,
    extras: ['soul'],
  }),
  sticker('melt', '麻了', 'meme', {
    caption: '麻了',
    eyes: 'sleepy',
    brows: 'worried',
    mouth: 'wavy',
    squash: [1.12, 0.88],
    extras: ['eyebags', 'sweat'],
  }),
  sticker('crack', '裂开', 'meme', {
    caption: '裂开了',
    eyes: 'wide',
    brows: 'worried',
    mouth: 'scream',
    extras: ['crack', 'sweat'],
    motion: 'shake',
  }),
  sticker('clown', '小丑', 'meme', {
    caption: '小丑竟是我',
    gear: 'clown_wig',
    eyes: 'open',
    look: [0, 2],
    brows: 'worried',
    mouth: 'painted',
    tilt: -6,
    extras: ['clown_nose', 'tear'],
  }),
  sticker('melon', '吃瓜', 'meme', {
    caption: '吃瓜',
    eyes: 'open',
    look: [-5, 0],
    brows: ['flat', 'raised'],
    mouth: 'chew',
    tilt: 6,
    extras: ['melon'],
  }),
  sticker('shrug', '摊手', 'meme', {
    caption: '随便',
    eyes: 'half',
    brows: 'raised',
    mouth: 'flat',
    tilt: -4,
    hands: ['shrug'],
  }),
  sticker('safe', '保命', 'meme', {
    caption: '保命',
    eyes: 'open',
    brows: 'worried',
    mouth: 'grimace',
    hands: ['hands_up'],
    extras: ['sweat_many'],
  }),
  sticker('evil', '坏笑', 'meme', {
    caption: '嘿嘿',
    eyes: 'smug',
    look: [4, 0],
    brows: 'angry',
    mouth: 'sly',
    tilt: -8,
    extras: ['sparkles'],
  }),
  sticker('rage', '红温', 'meme', {
    caption: '红温了',
    eyes: 'open',
    brows: 'fierce',
    mouth: 'gritted',
    extras: ['flush', 'steam', 'flames'],
    motion: 'shake',
  }),
  sticker('broken', '破防', 'meme', {
    caption: '破防了',
    eyes: 'big',
    brows: 'worried',
    mouth: 'wail',
    extras: ['tears_fountain', 'broken_heart'],
  }),
  sticker('woohoo', '芜湖', 'meme', {
    caption: '芜湖',
    body: 'tee',
    eyes: 'happy',
    brows: 'raised',
    mouth: 'big',
    hands: ['cheer'],
    extras: ['confetti'],
    motion: 'bounce',
  }),

  // Programming and judging
  sticker('ac', '通过', 'code', {
    caption: '一发过',
    gear: 'headphones',
    eyes: 'happy',
    brows: 'raised',
    mouth: 'grin',
    hands: ['thumb'],
    extras: ['badge_ac'],
  }),
  sticker('wa', '答案错误', 'code', {
    caption: 'WA 了',
    eyes: 'open',
    look: [0, 3],
    brows: 'sad',
    mouth: 'wail',
    extras: ['tears_stream', 'badge_wa'],
  }),
  sticker('tle', '超时', 'code', {
    caption: '超时了',
    eyes: 'tiny',
    brows: 'high',
    mouth: 'scream',
    extras: ['badge_tle', 'clock', 'sweat_many'],
    motion: 'shake',
  }),
  sticker('mle', '爆内存', 'code', {
    caption: '爆内存',
    eyes: 'wide',
    brows: 'worried',
    mouth: 'o',
    squash: [1.14, 0.96],
    extras: ['badge_mle', 'sweat'],
    motion: 'pulse',
  }),
  sticker('coding', '敲代码', 'code', {
    caption: '敲代码',
    gear: 'headphones',
    eyes: 'open',
    look: [0, 3],
    brows: 'angry',
    mouth: 'flat',
    lift: -1,
    extras: ['laptop'],
    blink: true,
  }),
  sticker('debug', '调试', 'code', {
    caption: '找 bug',
    eyes: 'wide',
    brows: 'raised',
    mouth: 'flat',
    tilt: -6,
    extras: ['magnifier'],
  }),
  sticker('bug', '有虫', 'code', {
    caption: '有 bug',
    eyes: 'cross',
    brows: 'worried',
    mouth: 'grimace',
    extras: ['bug', 'sweat'],
  }),
  sticker('lgtm', '没问题', 'code', {
    caption: '没问题',
    eyes: 'happy',
    mouth: 'smirk',
    hands: ['ok'],
    extras: ['badge_lgtm'],
  }),
  sticker('ship', '上线', 'code', {
    caption: '上线！',
    gear: 'cap',
    eyes: 'open',
    brows: 'raised',
    mouth: 'grin',
    extras: ['rocket', 'sparkles'],
  }),
  sticker('idea', '灵光一闪', 'code', {
    caption: '想到了',
    eyes: 'wide',
    brows: 'raised',
    mouth: 'grin',
    tilt: 5,
    extras: ['bulb'],
  }),
  sticker('duck', '小黄鸭', 'code', {
    caption: '小黄鸭',
    eyes: 'open',
    mouth: 'smile',
    tilt: -4,
    extras: ['duck'],
  }),
  sticker('coffee', '续命', 'code', {
    caption: '续命',
    eyes: 'half',
    brows: 'low',
    mouth: 'smile',
    extras: ['eyebags', 'mug'],
  }),
  sticker('read', '读书', 'code', {
    caption: '读书',
    eyes: 'open',
    look: [0, 5],
    brows: 'flat',
    mouth: 'flat',
    lift: -3,
    extras: ['book'],
  }),
  sticker('actually', '其实', 'code', {
    caption: '其实啊',
    glasses: 'glare',
    brows: ['raised', 'flat'],
    mouth: 'smirk',
    tilt: 6,
    hands: ['finger_up'],
  }),

  // Everyday life
  sticker('eat', '干饭', 'life', {
    caption: '干饭',
    eyes: 'big',
    brows: 'raised',
    mouth: 'chew',
    lift: -4,
    extras: ['bowl'],
    motion: 'munch',
  }),
  sticker('milk_tea', '奶茶', 'life', {
    caption: '奶茶',
    eyes: 'happy',
    mouth: 'smile',
    extras: ['blush', 'tea'],
  }),
  sticker('mooncake', '月饼', 'life', {
    caption: '月饼',
    eyes: 'star',
    mouth: 'smile',
    extras: ['mooncake', 'moon'],
  }),
  sticker('work', '搬砖', 'life', {
    caption: '搬砖',
    gear: 'hardhat',
    body: 'tee',
    eyes: 'half',
    brows: 'low',
    mouth: 'flat',
    extras: ['brick', 'sweat'],
  }),
  sticker('poor', '吃土', 'life', {
    caption: '吃土',
    eyes: 'open',
    look: [0, 4],
    brows: 'worried',
    mouth: 'frown',
    lift: -4,
    extras: ['bowl_dirt'],
  }),
  sticker('rich', '暴富', 'life', {
    caption: '暴富',
    gear: 'tophat',
    body: 'suit',
    eyes: 'dollar',
    brows: 'raised',
    mouth: 'big',
    extras: ['money'],
  }),
  sticker('run', '润了', 'life', {
    caption: '润了',
    eyes: 'wide',
    look: [4, 0],
    brows: 'worried',
    mouth: 'scream',
    tilt: 12,
    extras: ['dash'],
    motion: 'shake',
  }),
  sticker('lie_flat', '摆烂', 'life', {
    caption: '摆烂',
    glasses: 'none',
    body: 'none',
    eyes: 'half',
    brows: 'flat',
    mouth: 'flat',
    tilt: -90,
    pivot: [49, 69],
    squash: [0.69, 0.69],
    extras: ['pillow', 'blanket'],
    blink: true,
  }),
  sticker('overtime', '加班', 'life', {
    caption: '加班',
    body: 'suit',
    eyes: 'half',
    brows: 'low',
    mouth: 'wavy',
    extras: ['eyebags', 'moon', 'clock'],
  }),
  sticker('off_work', '下班', 'life', {
    caption: '下班！',
    body: 'tee',
    eyes: 'joy',
    brows: 'raised',
    mouth: 'big',
    hands: ['cheer'],
    extras: ['confetti'],
    motion: 'bounce',
  }),
];

const byId = new Map(stickers.map((entry) => [entry.id, entry]));
const marker = /:([a-z][a-z0-9_]*):/y;

// The sticker written at text[index], if the text there is a known :id:.
// Unknown names are not stickers, so 12:30:45 and :nope: stay as typed.
export function stickerAt(text, index) {
  marker.lastIndex = index;
  const match = marker.exec(text);
  const found = match && byId.get(match[1]);
  return found && { sticker: found, end: index + match[0].length };
}

// Plain text with every sticker replaced by its name in brackets.
export function stickerText(text) {
  let result = '';
  let from = 0;
  for (let at = text.indexOf(':'); at !== -1; at = text.indexOf(':', at + 1)) {
    const hit = stickerAt(text, at);
    if (!hit) continue;
    result += `${text.slice(from, at)}[${hit.sticker.label}]`;
    from = hit.end;
    at = hit.end - 1;
  }
  return result + text.slice(from);
}

// Memes with a caption show larger than the small emotes.
export function stickerClasses(sticker, large = false) {
  return [
    'sticker',
    ...(sticker.caption ? ['has-caption'] : []),
    ...(large ? ['is-large'] : []),
  ];
}

// Attributes shared by the Markdown and the title/description renderers.
export function stickerAttributes(sticker) {
  return {
    src: `/stickers/${sticker.id}.svg`,
    alt: sticker.label,
    title: `:${sticker.id}:`,
    width: 128,
    height: 128,
    loading: 'lazy',
    decoding: 'async',
  };
}
