/** Secondary locale phrase data (uk, pl, th, zh). */

export const MODE_OFFSET = { uk: 0, pl: 3, th: 7, zh: 9 }

function pick(arr, seed) {
  if (!arr?.length) return ''
  return arr[(Number(seed) >>> 0) % arr.length]
}

function makePhrases(L) {
  return {
    fallbackCue: L.fallbackCue,
    mood: L.mood,
    whoTwo: L.whoTwo,
    whoOne: L.whoOne,
    nearTwo: L.nearTwo,
    placeLine: L.placeLine,
    modLine: L.modLine,
    mix: L.mix,
    localPlace: L.localPlace,
    endsSentence: (s) => /[.!?…]$/.test(String(s || '').trim()),
    shapes: (c, ctx) => {
      const { name, disp, seed, cue, cue2, mod, place, a1, a2, n1, n2, axis } = c
      const { mood, who, near, placeLine, modLine, mix } = ctx
      return [
        () => [
          L.s0(disp, cue),
          placeLine || modLine,
          who || near,
          pick(L.s0tail, seed >> 23),
        ],
        () => [
          L.s1(name, cue),
          modLine || (axis.dark ? L.s1moodDark(mood) : L.s1mood(mood)),
          who,
          near && seed % 2 === 0 ? near : '',
        ],
        () => [
          who ? L.s2who(name, a1) : L.s2noWho(name),
          L.s2core(cue),
          placeLine || modLine,
          near,
        ],
        () => [
          mix || L.s3code(cue),
          L.s3feel(name, mood),
          who || placeLine,
          pick(L.s3tail, seed >> 25),
        ],
        () => [
          near ? L.s4near(n1, name, cue) : L.s4apart(name, cue),
          modLine || placeLine,
          who,
          L.s4overall(mood),
        ],
        () => [
          L.s5short(disp, cue, mod),
          placeLine,
          who || pick(L.s5tail, seed >> 27),
        ],
        () => [
          L.s6scene(name, cue),
          axis.bright ? L.s6bright : axis.dark ? L.s6dark : L.s6neutral,
          who || near,
          placeLine,
        ],
        () => [
          a1 ? L.s7artists(a1, a2, name) : L.s7noFace(name, cue),
          a1 ? L.s7code(cue) : modLine || placeLine,
          near,
          pick(L.s7tail, seed >> 29),
        ],
        () => [
          L.s8warn(name, cue),
          placeLine || modLine,
          near ? L.s8near(n1) : L.s8mood(mood),
          who,
        ],
        () => [
          L.s9for(cue),
          place ? L.s9place(place) : modLine,
          who || near,
          L.s9bottom(mood),
        ],
        () => [
          L.s10micro(name, cue),
          mix || modLine,
          who,
          near || pick(L.s10tail, seed >> 31),
        ],
        () => [
          place ? L.s11place(disp, place, cue) : L.s11plain(disp, cue),
          modLine,
          who ? L.s11who(who) : near ? `${near}.` : L.s11start,
          pick(L.s11tail, seed),
        ],
      ]
    },
  }
}

const L_UK = {
  fallbackCue: [
    'характерний тембр і ритм',
    'власний звуковий код серед сусідніх тегів',
    'настрій і фактура важливіші за сухе визначення',
  ],
  mood: {
    darkDense: ['звучить щільно і темно', 'мало «повітря», багато тіні'],
    dark: ['скоріше нічний настрій', 'атмосфера важливіша за стадіонний хук'],
    bright: ['звучить відкрито й енергійно', 'яскравіше й доступніше за середнє'],
    dense: ['фактура густа', 'шарів багато, пауз мало'],
    default: ['своя ніша серед сусідів', 'не намагається бути «усім одразу»'],
  },
  whoTwo: [
    (a1, a2) => `Орієнтири — ${a1} і ${a2}`,
    (a1, a2) => `Часто з’являються ${a1}, ${a2}`,
    (a1, a2) => `З цієї сцени зручно зайти через ${a1} або ${a2}`,
  ],
  whoOne: [
    (a1) => `Характерний орієнтир — ${a1}`,
    (a1) => `Зручна точка входу — ${a1}`,
  ],
  nearTwo: [
    (n1, n2) => `Поруч за смаком — «${n1}» і «${n2}»`,
    (n1, n2) => `Якщо зайде, далі слухайте «${n1}» або «${n2}»`,
    (n1, n2) => `Сусідні ярлики: «${n1}», «${n2}»`,
  ],
  placeLine: [
    (place) => `Відчувається ${place} акцент.`,
    (place) => `У звуку є ${place} колорит.`,
    (place) => `Це ${place} кут великої жанрової мови.`,
  ],
  modLine: [
    (mod) => `Плюс ${mod}.`,
    (mod) => `Відтінок: ${mod}.`,
    (mod) => `Тут важливіше ${mod}.`,
  ],
  mix: [
    (cue, cue2) => `Суміш: ${cue} + ${cue2}.`,
    (cue, cue2) => `База — ${cue}; зверху ${cue2}.`,
  ],
  localPlace: (token) => `локальний (${token})`,
  s0: (disp, cue) => `${disp} — це про ${cue}.`,
  s0tail: [
    'Не підручник гармонії, а звичний вайб плейлистів.',
    'Слухають заради тембру й ритму з перших тактів.',
    'Межі м’які, але центр ваги свій.',
  ],
  s1: (name, cue) => `У Spotify ярлик «${name}» збирає треки навколо ідеї: ${cue}.`,
  s1moodDark: (m) => `Настрій: ${m}.`,
  s1mood: (m) => `За відчуттям ${m}.`,
  s2who: (name, a1) => `Якщо ${a1} вам близький, «${name}» — логічний наступний ярлик.`,
  s2noWho: (name) => `«${name}» варто слухати як самостійну сцену, а не як «майже сусідній жанр».`,
  s2core: (cue) => `У центрі — ${cue}.`,
  s3code: (cue) => `Код жанру: ${cue}.`,
  s3feel: (name, mood) => `«${name}» — ${mood}.`,
  s3tail: [
    'Плейлисти важливіші за енциклопедичні визначення.',
    'Краще один сильний трек, ніж довга теорія.',
  ],
  s4near: (n1, name, cue) => `Між «${n1}» і рештою каталогу лежить «${name}»: ${cue}.`,
  s4apart: (name, cue) => `«${name}» стоїть окремо: ${cue}.`,
  s4overall: (m) => `Загалом ${m}.`,
  s5short: (disp, cue, mod) => `Коротко про ${disp}: ${cue}${mod ? `; ще ${mod}` : ''}.`,
  s5tail: [
    'Точка входу — офіційний жанровий плейлист.',
    'Далі простіше йти за схожими ярликами на карті.',
  ],
  s6scene: (name, cue) => `Сцена «${name}» тримається на ідеї: ${cue}.`,
  s6bright: 'Частіше це денна/енергійна подача.',
  s6dark: 'Частіше це нічний, камерний або похмурий кут.',
  s6neutral: 'Темп і щільність залежать від конкретного релізу.',
  s7artists: (a1, a2, name) =>
    `${a1}${a2 && a2 !== a1 ? ` і ${a2}` : ''} часто ставлять орієнтиром для «${name}».`,
  s7noFace: (name, cue) => `У «${name}» немає одного «обличчя», зате є спільний код: ${cue}.`,
  s7code: (cue) => `Спільний код сцени: ${cue}.`,
  s7tail: [
    'Слухати краще цілий плейлист, а не один сингл.',
    'Важливіше вайб, ніж жорсткі правила.',
  ],
  s8warn: (name, cue) => `Не плутайте «${name}» із сусідами — тут важливіше ${cue}.`,
  s8near: (n1) => `Так, поруч «${n1}», але центр інший.`,
  s8mood: (m) => `Жанр ${m}.`,
  s9for: (cue) => `Це для тих, кому відгукується: ${cue}.`,
  s9place: (place) => `${place.charAt(0).toUpperCase() + place.slice(1)} колорит тут не декорація.`,
  s9bottom: (m) => `Підсумок — ${m}.`,
  s10micro: (name, cue) => `«${name}» у каталозі — мікросцена. Суть: ${cue}.`,
  s10tail: [
    'Карта Every Noise ставить його поруч із спорідненими тегами.',
    'На стрімінгу це скоріше полиця плейлистів, ніж «школа».',
  ],
  s11place: (disp, place, cue) => `${disp} — ${place} погляд на сцену, де ${cue}.`,
  s11plain: (disp, cue) => `${disp}: ${cue}.`,
  s11who: (who) => `${who} — гарний старт.`,
  s11start: 'Старт — будь-який свіжий плейлист із цим тегом.',
  s11tail: [
    'Далі вухо саме відділить своїх від чужих.',
    'Через 3–4 треки ярлик зазвичай «схоплюється».',
  ],
}

const L_PL = {
  fallbackCue: [
    'charakterystyczny timbre i rytm',
    'własny kod brzmieniowy wśród sąsiednich tagów',
    'nastrój i faktura ważniejsze niż suche definicje',
  ],
  mood: {
    darkDense: ['brzmi gęsto i ciemno', 'mało „powietrza”, dużo cienia'],
    dark: ['raczej nocny nastrój', 'atmosfera ważniejsza niż stadionowy hook'],
    bright: ['brzmi otwarcie i energicznie', 'jaśniej i przystępniej niż przeciętnie'],
    dense: ['faktura gęsta', 'wiele warstw, mało pauz'],
    default: ['własna nisza wśród sąsiadów', 'nie stara się być „wszystkim naraz”'],
  },
  whoTwo: [
    (a1, a2) => `Punkty odniesienia — ${a1} i ${a2}`,
    (a1, a2) => `Często pojawiają się ${a1}, ${a2}`,
    (a1, a2) => `Z tej sceny wygodnie wejść przez ${a1} lub ${a2}`,
  ],
  whoOne: [
    (a1) => `Charakterystyczny punkt odniesienia — ${a1}`,
    (a1) => `Wygodny punkt wejścia — ${a1}`,
  ],
  nearTwo: [
    (n1, n2) => `Blisko smakowo — „${n1}” i „${n2}”`,
    (n1, n2) => `Jeśli siądzie, dalej słuchaj „${n1}” lub „${n2}”`,
    (n1, n2) => `Sąsiednie etykiety: „${n1}”, „${n2}”`,
  ],
  placeLine: [
    (place) => `Czuć ${place} akcent.`,
    (place) => `W brzmieniu jest ${place} koloryt.`,
    (place) => `To ${place} kąt większego języka gatunków.`,
  ],
  modLine: [
    (mod) => `Plus ${mod}.`,
    (mod) => `Odcień: ${mod}.`,
    (mod) => `Tutaj ważniejsze jest ${mod}.`,
  ],
  mix: [
    (cue, cue2) => `Mieszanka: ${cue} + ${cue2}.`,
    (cue, cue2) => `Baza — ${cue}; na wierzchu ${cue2}.`,
  ],
  localPlace: (token) => `lokalny (${token})`,
  s0: (disp, cue) => `${disp} — to ${cue}.`,
  s0tail: [
    'Nie podręcznik harmonii, lecz znany vibe playlist.',
    'Słucha się dla timbru i rytmu od pierwszych taktów.',
    'Granice miękkie, ale środek ciężkości własny.',
  ],
  s1: (name, cue) => `W Spotify etykieta „${name}” zbiera utwory wokół: ${cue}.`,
  s1moodDark: (m) => `Nastrój: ${m}.`,
  s1mood: (m) => `W odczuciu ${m}.`,
  s2who: (name, a1) => `Jeśli ${a1} jest bliski, „${name}” to logiczna kolejna etykieta.`,
  s2noWho: (name) => `„${name}” warto słuchać jako samodzielną scenę, nie „prawie sąsiedni gatunek”.`,
  s2core: (cue) => `W centrum — ${cue}.`,
  s3code: (cue) => `Kod gatunku: ${cue}.`,
  s3feel: (name, mood) => `„${name}” — ${mood}.`,
  s3tail: [
    'Playlisty ważniejsze niż encyklopedyczne definicje.',
    'Lepiej jeden mocny utwór niż długa teoria.',
  ],
  s4near: (n1, name, cue) => `Między „${n1}” a resztą katalogu leży „${name}”: ${cue}.`,
  s4apart: (name, cue) => `„${name}” stoi osobno: ${cue}.`,
  s4overall: (m) => `Ogólnie ${m}.`,
  s5short: (disp, cue, mod) => `Krótko o ${disp}: ${cue}${mod ? `; jeszcze ${mod}` : ''}.`,
  s5tail: [
    'Punkt wejścia — oficjalna playlista gatunku.',
    'Dalej łatwiej iść po podobnych etykietach na mapie.',
  ],
  s6scene: (name, cue) => `Scena „${name}” trzyma się idei: ${cue}.`,
  s6bright: 'Częściej to dzienna/energiczna prezentacja.',
  s6dark: 'Częściej to nocny, kameralny lub mroczny kąt.',
  s6neutral: 'Tempo i gęstość zależą od konkretnego wydania.',
  s7artists: (a1, a2, name) =>
    `${a1}${a2 && a2 !== a1 ? ` i ${a2}` : ''} często wskazywani jako punkty odniesienia dla „${name}”.`,
  s7noFace: (name, cue) => `„${name}” nie ma jednej „twarzy”, ale wspólny kod: ${cue}.`,
  s7code: (cue) => `Wspólny kod sceny: ${cue}.`,
  s7tail: [
    'Lepiej słuchać całej playlisty niż jednego singla.',
    'Ważniejszy vibe niż sztywne reguły.',
  ],
  s8warn: (name, cue) => `Nie myl „${name}” z sąsiadami — tu ważniejsze ${cue}.`,
  s8near: (n1) => `Tak, blisko „${n1}”, ale centrum inne.`,
  s8mood: (m) => `Gatunek ${m}.`,
  s9for: (cue) => `To dla tych, którym odpowiada: ${cue}.`,
  s9place: (place) => `${place.charAt(0).toUpperCase() + place.slice(1)} koloryt tu nie jest dekoracją.`,
  s9bottom: (m) => `Podsumowanie — ${m}.`,
  s10micro: (name, cue) => `„${name}” w katalogu — mikroscena. Sedno: ${cue}.`,
  s10tail: [
    'Mapa Every Noise stawia go obok pokrewnych tagów.',
    'Na streamingu to raczej półka playlist niż „szkoła”.',
  ],
  s11place: (disp, place, cue) => `${disp} — ${place} spojrzenie na scenę, gdzie ${cue}.`,
  s11plain: (disp, cue) => `${disp}: ${cue}.`,
  s11who: (who) => `${who} — dobry start.`,
  s11start: 'Start — dowolna świeża playlista z tym tagiem.',
  s11tail: [
    'Potem ucho samo odróżni swoich od obcych.',
    'Po 3–4 utworach etykieta zwykle „klika”.',
  ],
}

const L_TH = {
  fallbackCue: [
    'เนื้อเสียงและจังหวะที่เป็นเอกลักษณ์',
    'โค้ดเสียงเฉพาะตัวท่ามกลางแท็กใกล้เคียง',
    'อารมณ์และพื้นผิวสำคัญกว่านิยามแห้งๆ',
  ],
  mood: {
    darkDense: ['ฟังแล้วหนาแน่นและมืด', 'อากาศน้อย เงามาก'],
    dark: ['อารมณ์กลางคืนมากกว่า', 'บรรยากาศสำคัญกว่าฮุคสเตเดียม'],
    bright: ['ฟังเปิดกว้างและมีพลัง', 'สว่างและเข้าถึงง่ายกว่าค่าเฉลี่ย'],
    dense: ['พื้นผิวหนาแน่น', 'เลเยอร์เยอะ พักน้อย'],
    default: ['มีช่องว่างของตัวเองในหมู่เพื่อนบ้าน', 'ไม่พยายามเป็น «ทุกอย่างพร้อมกัน»'],
  },
  whoTwo: [
    (a1, a2) => `จุดอ้างอิง — ${a1} และ ${a2}`,
    (a1, a2) => `มักได้ยิน ${a1}, ${a2}`,
    (a1, a2) => `จากซีนนี้เริ่มผ่าน ${a1} หรือ ${a2} ได้สะดวก`,
  ],
  whoOne: [
    (a1) => `จุดอ้างอิงที่ชัด — ${a1}`,
    (a1) => `จุดเริ่มที่เหมาะ — ${a1}`,
  ],
  nearTwo: [
    (n1, n2) => `ใกล้เคียงในรสชาติ — «${n1}» และ «${n2}»`,
    (n1, n2) => `ถ้าชอบ ลองฟัง «${n1}» หรือ «${n2}» ต่อ`,
    (n1, n2) => `แท็กใกล้เคียง: «${n1}», «${n2}»`,
  ],
  placeLine: [
    (place) => `รู้สึกได้ถึงสำเนียง${place}.`,
    (place) => `ในเสียงมีสีสัน${place}.`,
    (place) => `นี่คือมุม${place}ของภาษาแนวเพลงที่ใหญ่กว่า`,
  ],
  modLine: [
    (mod) => `บวก ${mod}.`,
    (mod) => `เฉดสี: ${mod}.`,
    (mod) => `ที่นี่ ${mod} สำคัญกว่า`,
  ],
  mix: [
    (cue, cue2) => `ผสม: ${cue} + ${cue2}.`,
    (cue, cue2) => `ฐาน — ${cue}; ทับด้วย ${cue2}.`,
  ],
  localPlace: (token) => `ท้องถิ่น (${token})`,
  s0: (disp, cue) => `${disp} — คือเรื่องของ ${cue}.`,
  s0tail: [
    'ไม่ใช่ตำราฮาร์มอนี แต่เป็นไวบ์เพลย์ลิสต์ที่คุ้นเคย',
    'ฟังเพราะเนื้อเสียงและจังหวะตั้งแต่จังหวะแรก',
    'ขอบเขตนุ่ม แต่ศูนย์กลางเป็นของตัวเอง',
  ],
  s1: (name, cue) => `บน Spotify แท็ก «${name}» รวมเพลงรอบแนวคิด: ${cue}.`,
  s1moodDark: (m) => `อารมณ์: ${m}.`,
  s1mood: (m) => `ความรู้สึกโดยรวม ${m}.`,
  s2who: (name, a1) => `ถ้าชอบ ${a1} «${name}» เป็นแท็กถัดไปที่สมเหตุสมผล`,
  s2noWho: (name) => `«${name}» ควรฟังเป็นซีนเอง ไม่ใช่แค่ «เกือบแนวใกล้เคียง»`,
  s2core: (cue) => `ศูนย์กลางคือ ${cue}.`,
  s3code: (cue) => `โค้ดแนว: ${cue}.`,
  s3feel: (name, mood) => `«${name}» — ${mood}.`,
  s3tail: [
    'เพลย์ลิสต์สำคัญกว่านิยามในสารานุกรม',
    'เพลงเดียวที่แรงดีกว่าทฤษฎียาวๆ',
  ],
  s4near: (n1, name, cue) => `ระหว่าง «${n1}» กับแคตตาล็อกที่เหลือคือ «${name}»: ${cue}.`,
  s4apart: (name, cue) => `«${name}» ยืนแยกต่างหาก: ${cue}.`,
  s4overall: (m) => `โดยรวม ${m}.`,
  s5short: (disp, cue, mod) => `สรุปสั้นๆ เรื่อง ${disp}: ${cue}${mod ? `; อีก ${mod}` : ''}.`,
  s5tail: [
    'จุดเริ่ม — เพลย์ลิสต์แนวอย่างทางการ',
    'จากนั้นไล่ตามแท็กใกล้เคียงบนแผนที่ได้ง่าย',
  ],
  s6scene: (name, cue) => `ซีน «${name}» ยึดแนวคิด: ${cue}.`,
  s6bright: 'มักเป็นสไตล์กลางวัน/มีพลัง',
  s6dark: 'มักเป็นมุมกลางคืน ใกล้ชิด หรือมืดหม่น',
  s6neutral: 'จังหวะและความหนาแน่นขึ้นกับอัลบั้มนั้นๆ',
  s7artists: (a1, a2, name) =>
    `${a1}${a2 && a2 !== a1 ? ` และ ${a2}` : ''} มักถูกยกเป็นจุดอ้างอิงของ «${name}»`,
  s7noFace: (name, cue) => `«${name}» ไม่มี «หน้า» เดียว แต่มีโค้ดร่วม: ${cue}.`,
  s7code: (cue) => `โค้ดร่วมของซีน: ${cue}.`,
  s7tail: [
    'ฟังทั้งเพลย์ลิสต์ดีกว่าเพลงเดียว',
    'ไวบ์สำคัญกว่ากฎที่แข็ง',
  ],
  s8warn: (name, cue) => `อย่าสับสน «${name}» กับเพื่อนบ้าน — ที่นี่เน้น ${cue}.`,
  s8near: (n1) => `ใช่ ใกล้ «${n1}» แต่ศูนย์กลางต่างกัน`,
  s8mood: (m) => `แนวนี้ ${m}.`,
  s9for: (cue) => `สำหรับคนที่ชอบ: ${cue}.`,
  s9place: (place) => `สีสัน${place} ที่นี่ไม่ใช่แค่ตกแต่ง`,
  s9bottom: (m) => `สรุป — ${m}.`,
  s10micro: (name, cue) => `«${name}» ในแคตตาล็อก — ไมโครซีน แก่น: ${cue}.`,
  s10tail: [
    'แผนที่ Every Noise วางไว้ใกล้แท็กที่เกี่ยวข้อง',
    'บนสตรีมมิงเป็นเหมือนชั้นเพลย์ลิสต์มากกว่า «โรงเรียน»',
  ],
  s11place: (disp, place, cue) => `${disp} — มุมมอง${place} ของซีนที่ ${cue}.`,
  s11plain: (disp, cue) => `${disp}: ${cue}.`,
  s11who: (who) => `${who} — จุดเริ่มที่ดี`,
  s11start: 'เริ่มจากเพลย์ลิสต์ใหม่ๆ ที่มีแท็กนี้',
  s11tail: [
    'ต่อไปหูจะแยกของเรากับของคนอื่นเอง',
    'ผ่าน 3–4 เพลง แท็กมักจะ «เข้าใจ»',
  ],
}

const L_ZH = {
  fallbackCue: [
    '标志性的音色与节奏',
    '在相邻标签中有自己的声音代码',
    '氛围与质感比干巴巴的定义更重要',
  ],
  mood: {
    darkDense: ['听起来密集而阴暗', '空气少，阴影多'],
    dark: ['更偏深夜情绪', '氛围重于体育场级 hook'],
    bright: ['听起来开放而有活力', '比平均更明亮、更易接近'],
    dense: ['质感厚实', '层次多，停顿少'],
    default: ['在邻居中有自己的位置', '并不试图「一次做全」'],
  },
  whoTwo: [
    (a1, a2) => `参考坐标 — ${a1} 和 ${a2}`,
    (a1, a2) => `常听到 ${a1}、${a2}`,
    (a1, a2) => `从这个场景入手，${a1} 或 ${a2} 都方便`,
  ],
  whoOne: [
    (a1) => `典型参考 — ${a1}`,
    (a1) => `合适的入口 — ${a1}`,
  ],
  nearTwo: [
    (n1, n2) => `口味相近 —「${n1}」和「${n2}」`,
    (n1, n2) => `如果喜欢，接着听「${n1}」或「${n2}」`,
    (n1, n2) => `相邻标签：「${n1}」、「${n2}」`,
  ],
  placeLine: [
    (place) => `能感到${place}口音。`,
    (place) => `声音里有${place}色彩。`,
    (place) => `这是更大流派语言中的${place}视角。`,
  ],
  modLine: [
    (mod) => `另外 ${mod}。`,
    (mod) => `色调：${mod}。`,
    (mod) => `这里 ${mod} 更重要。`,
  ],
  mix: [
    (cue, cue2) => `混合：${cue} + ${cue2}。`,
    (cue, cue2) => `底层 — ${cue}；上层 ${cue2}。`,
  ],
  localPlace: (token) => `本地（${token}）`,
  s0: (disp, cue) => `${disp} — 讲的是 ${cue}。`,
  s0tail: [
    '不是和声教科书，而是歌单里熟悉的 vibe。',
    '从最初几个小节就为音色和节奏而听。',
    '边界模糊，但重心明确。',
  ],
  s1: (name, cue) => `在 Spotify 上，标签「${name}」围绕这一理念汇集曲目：${cue}。`,
  s1moodDark: (m) => `情绪：${m}。`,
  s1mood: (m) => `感觉上 ${m}。`,
  s2who: (name, a1) => `如果你喜欢 ${a1}，「${name}」是自然的下一个标签。`,
  s2noWho: (name) => `「${name}」应作为独立场景来听，而不只是「几乎相邻的类型」。`,
  s2core: (cue) => `核心是 ${cue}。`,
  s3code: (cue) => `类型代码：${cue}。`,
  s3feel: (name, mood) => `「${name}」 — ${mood}。`,
  s3tail: [
    '歌单比百科全书式定义更重要。',
    '一首强曲胜过长篇理论。',
  ],
  s4near: (n1, name, cue) => `在「${n1}」与目录其余部分之间，是「${name}」：${cue}。`,
  s4apart: (name, cue) => `「${name}」相对独立：${cue}。`,
  s4overall: (m) => `总体而言 ${m}。`,
  s5short: (disp, cue, mod) => `${disp} 简述：${cue}${mod ? `；还有 ${mod}` : ''}。`,
  s5tail: [
    '入口 — 官方类型歌单。',
    '然后沿地图上的相近标签继续。',
  ],
  s6scene: (name, cue) => `「${name}」场景围绕这一理念：${cue}。`,
  s6bright: '往往偏白天/有活力的呈现。',
  s6dark: '往往偏夜晚、私密或阴郁的角落。',
  s6neutral: '速度与密度取决于具体发行。',
  s7artists: (a1, a2, name) =>
    `${a1}${a2 && a2 !== a1 ? ` 和 ${a2}` : ''} 常被当作「${name}」的参考坐标。`,
  s7noFace: (name, cue) => `「${name}」没有单一「面孔」，但有共同代码：${cue}。`,
  s7code: (cue) => `场景共同代码：${cue}。`,
  s7tail: [
    '听完整歌单比只听一首单曲更好。',
    'vibe 比硬性规则更重要。',
  ],
  s8warn: (name, cue) => `别把「${name}」和邻居混淆 — 这里更重要的是 ${cue}。`,
  s8near: (n1) => `是的，靠近「${n1}」，但中心不同。`,
  s8mood: (m) => `这个类型 ${m}。`,
  s9for: (cue) => `适合喜欢 ${cue} 的人。`,
  s9place: (place) => `${place.charAt(0).toUpperCase() + place.slice(1)} 色彩在这里不是装饰。`,
  s9bottom: (m) => `总结 — ${m}。`,
  s10micro: (name, cue) => `目录里的「${name}」是微场景。要点：${cue}。`,
  s10tail: [
    'Every Noise 地图把它放在相关标签附近。',
    '在流媒体里更像歌单货架，而不是「学派」。',
  ],
  s11place: (disp, place, cue) => `${disp} — 对 ${cue} 这一场景的${place}视角。`,
  s11plain: (disp, cue) => `${disp}：${cue}。`,
  s11who: (who) => `${who} — 不错的起点。`,
  s11start: '起点 — 任何带此标签的新歌单。',
  s11tail: [
    '之后耳朵会自己分清「自己的」和「别人的」。',
    '听 3–4 首后，标签通常就「对上号」了。',
  ],
}

export const PHRASES = {
  uk: makePhrases(L_UK),
  pl: makePhrases(L_PL),
  th: makePhrases(L_TH),
  zh: makePhrases(L_ZH),
}

export const FAMILY_EXTRA = {
  hyperpop: {
    uk: [
      "пітч‑вокал, глянець і інтернет‑хаос",
      "ломаний поп‑максималізм"
    ],
    pl: [
      "pitch vocal, połysk i internetowy chaos",
      "pęknięty pop‑maksymalizm"
    ],
    th: [
      "เสียงพิทช์ ความเงา และความวุ่นวายบนอินเทอร์เน็ต",
      "ป็อปสูงสุดที่แตกหัก"
    ],
    zh: [
      "变调人声、光泽与互联网混乱",
      "破碎的流行极繁主义"
    ]
  },
  shoegaze: {
    uk: [
      "стіни гітар і розмитий вокал",
      "реверб, шум і занурення"
    ],
    pl: [
      "ściany gitar i rozmyty wokal",
      "reverb, hałas i zanurzenie"
    ],
    th: [
      "กำแพงกีตาร์และเสียงร้องที่ละลาย",
      "รีverb เสียงรบกวน และการดื่มด่ำ"
    ],
    zh: [
      "吉他音墙与朦胧人声",
      "混响、噪音与沉浸感"
    ]
  },
  vaporwave: {
    uk: [
      "уповільнені ретро‑семпли та ностальгія",
      "лаунж 80–90‑х у slow‑motion"
    ],
    pl: [
      "spowolnione retro sample i nostalgia",
      "lounge lat 80.–90. w slow‑motion"
    ],
    th: [
      "เซมเปิลย้อนยุคที่ช้าลงและความคิดถึง",
      "เลานจ์ยุค 80–90 ใน slow‑motion"
    ],
    zh: [
      "慢速复古采样与怀旧",
      "80–90 年代 lounge 的慢动作版"
    ]
  },
  synthwave: {
    uk: [
      "ретро‑синтез і саундтрек‑драйв 80‑х",
      "неон, арпеджіо, кінематографічний біт"
    ],
    pl: [
      "retro syntezatory i drive jak z lat 80.",
      "neon, arpeggia, kinowy beat"
    ],
    th: [
      "ซินธ์ย้อนยุคและไดรฟ์แบบซาวด์แทร็กยุค 80",
      "นีออน อาร์พีจิโอ บีตแบบภาพยนตร์"
    ],
    zh: [
      "复古合成器与 80 年代配乐驱动",
      "霓虹、琶音、电影感节拍"
    ]
  },
  dubstep: {
    uk: [
      "розріджений ритм і важкий дроп",
      "UK‑клубний бас нульових"
    ],
    pl: [
      "rzadki rytm i ciężki drop",
      "brytyjski klubowy bas lat 2000."
    ],
    th: [
      "จังหวะเว้นช่องและดรอปหนัก",
      "เบสคลับ UK ยุค 2000"
    ],
    zh: [
      "稀疏节奏与沉重 drop",
      "2000 年代英国俱乐部低音"
    ]
  },
  breakcore: {
    uk: [
      "нарізані Amen‑брейки та високий BPM",
      "хаотичні едити й шум"
    ],
    pl: [
      "pocięte breaki Amen i wysokie BPM",
      "chaotyczne edity i hałas"
    ],
    th: [
      "Amen break ที่สับและ BPM สูง",
      "เอดิตวุ่นวายและเสียงรบกวน"
    ],
    zh: [
      "切碎的 Amen break 与高 BPM",
      "混乱的 edit 与噪音"
    ]
  },
  amapiano: {
    uk: [
      "log‑drums, широкий бас і південноафриканський хаус",
      "просторі акорди та глибокий грув"
    ],
    pl: [
      "log drums, szeroki bas i południowoafrykański house",
      "przestronne akordy i głęboki groove"
    ],
    th: [
      "log drums เบสกว้าง และเฮาส์แอฟริกาใต้",
      "คอร์ดกว้างและกroove ลึก"
    ],
    zh: [
      "log drums、宽广低音与南非 house",
      "开阔和弦与深沉 groove"
    ]
  },
  afrobeats: {
    uk: [
      "західноафриканський поп‑континуум",
      "highlife, хіп‑хоп і танцювальний пульс"
    ],
    pl: [
      "zachodnioafrykański pop continuum",
      "highlife, hip‑hop i taneczny puls"
    ],
    th: [
      "ต่อเนื่องป็อปแอฟริกาตะวันตก",
      "highlife ฮ ip-hop และจังหวะเต้น"
    ],
    zh: [
      "西非流行连续体",
      "highlife、嘻哈与舞动感"
    ]
  },
  afrobeat: {
    uk: [
      "поліритмія, перкусія, західноафриканський грув",
      "танцювальна енергія з африканським корінням"
    ],
    pl: [
      "polirytmia, perkusja, zachodnioafrykański groove",
      "taneczna energia z afrykańskimi korzeniami"
    ],
    th: [
      "โพลีริทึม เปrcussion และ groove แอฟริกาตะวันตก",
      "พลังงานเต้นรำที่มีรากแอฟริกา"
    ],
    zh: [
      "复合节奏、打击乐与西非 groove",
      "带有非洲根的舞蹈能量"
    ]
  },
  reggaeton: {
    uk: [
      "dembow‑біт і латинський танцпол",
      "хіп‑хоп/дancehall навколо dembow"
    ],
    pl: [
      "bit dembow i latynoski parkiet",
      "hip‑hop/dancehall wokół dembow"
    ],
    th: [
      "จังหวะ dembow และฟลอร์ลาติน",
      "hip-hop/dancehall รอบ dembow"
    ],
    zh: [
      "dembow 节拍与拉丁舞池",
      "围绕 dembow 的 hip-hop/dancehall"
    ]
  },
  hardcore: {
    uk: [
      "швидкість, агресія, без згладжування",
      "екстремальний напір і прямота"
    ],
    pl: [
      "szybkość, agresja, bez wygładzania",
      "ekstremalny nacisk i bezpośredniość"
    ],
    th: [
      "ความเร็ว ความดุดัน ไม่มีการปัดเงา",
      "แรงกดดันสุดขั้วและตรงไปตรงมา"
    ],
    zh: [
      "速度、侵略性、不做圆滑处理",
      "极端压迫感与直接"
    ]
  },
  industrial: {
    uk: [
      "абразивний шум і машинні ритми",
      "механіка та конфронтація"
    ],
    pl: [
      "ścierny hałas i maszynowe rytmy",
      "mechanika i konfrontacja"
    ],
    th: [
      "เสียงรบกวนขัด และจังหวะเหมือนเครื่องจักร",
      "กลไกและการเผชิญหน้า"
    ],
    zh: [
      " abrasive 噪音与机械节奏",
      "机械感与对抗性"
    ]
  },
  drill: {
    uk: [
      "ковзні 808, рваний хет, вуличний флоу",
      "холодний drill‑біт і щільна подача"
    ],
    pl: [
      "ślizgające się 808, szarpane hi‑haty, uliczny flow",
      "zimny bit drill i zwarta prezentacja"
    ],
    th: [
      "808 สไลด์ แฮตสะดุด และ flow บนถนน",
      "บีต drill เย็นและการส่งเสียงแน่น"
    ],
    zh: [
      "滑动 808、断奏 hi-hat 与街头 flow",
      "冷峻 drill 节拍与紧凑呈现"
    ]
  },
  phonk: {
    uk: [
      "мемфіс‑семпли, cowbell, брудний бас",
      "lo‑fi шороховатість і агресивний низ"
    ],
    pl: [
      "sample Memphis, cowbelle, brudny bas",
      "lo‑fi szorstkość i agresywny dół"
    ],
    th: [
      "เซมเปิลเมมฟิส คาวเบล และเบสสกปรก",
      "lo-fi หยาบและทุ่นต่ำดุดัน"
    ],
    zh: [
      "孟菲斯采样、cowbell 与脏低音",
      "lo-fi 粗粝感与侵略性低频"
    ]
  },
  garage: {
    uk: [
      "ломаний UK‑ритм і вокальні хуки",
      "кутовий біт між house і breakbeat"
    ],
    pl: [
      "łamany rytm UK i wokalne hooki",
      "kanciasty bit między house a breakbeatem"
    ],
    th: [
      "จังหวะ UK ที่หัก และ vocal hook",
      "บีตมุมฉากระหว่าง house กับ breakbeat"
    ],
    zh: [
      "破碎的 UK 节奏与人声 hook",
      "house 与 breakbeat 之间的棱角节拍"
    ]
  },
  grime: {
    uk: [
      "східнолондонський електронний/реп пульс",
      "швидкі біти й різка атака"
    ],
    pl: [
      "wschodnolondyński puls elektronika/rap",
      "szybkie bity i ostra atak"
    ],
    th: [
      "พulse อิเล็กทรอนิกส์/แร็ป East London",
      "บีตเร็วและการโจมตีคม"
    ],
    zh: [
      "东伦敦电子/说唱脉冲",
      "快速节拍与尖锐冲击"
    ]
  },
  techno: {
    uk: [
      "машинний пульс і довгі клубні хвилі",
      "повторювані ритми без поп‑сюжету"
    ],
    pl: [
      "maszynowy puls i długie klubowe fale",
      "powtarzalne rytmy bez pop fabuły"
    ],
    th: [
      "ชีพจรเครื่องจักรและคลื่นคลับยาว",
      "จังหวะวนซ้ำไร้พล็อตป็อป"
    ],
    zh: [
      "机械脉冲与漫长 club 波浪",
      "循环节奏、无流行叙事"
    ]
  },
  house: {
    uk: [
      "four‑on‑the‑floor і клубний грув",
      "soul‑хуки поверх танцювального біту"
    ],
    pl: [
      "four‑on‑the‑floor i klubowy groove",
      "soul hooki na tanecznym becie"
    ],
    th: [
      "four-on-the-floor และ groove คลับ",
      "soul hook ทับบีตเต้น"
    ],
    zh: [
      "四四拍与 club groove",
      "灵魂 hook 叠在舞曲节拍上"
    ]
  },
  trance: {
    uk: [
      "довгі білди, ейфорія й синтезаторні лінії",
      "клубний підйом і гіпнотичне повторення"
    ],
    pl: [
      "długie buildy, euforia i linie syntezatorów",
      "klubowy wzlot i hipnotyczna pętla"
    ],
    th: [
      "บิลด์ยาว ยูforia และไลน์ซินธ์",
      "ยกระดับคลับและลoop สะกดจิต"
    ],
    zh: [
      "长 build、 euphoria 与合成器线条",
      "club 上升与催眠循环"
    ]
  },
  ambient: {
    uk: [
      "атмосфера важливіша за куплет",
      "простір, тон, повільний розвиток"
    ],
    pl: [
      "atmosfera ważniejsza niż zwrotka",
      "przestrzeń, ton, powolny rozwój"
    ],
    th: [
      "บรรยากาศสำคัญกว่าเวิร์ส",
      "space โทน และการค่อยๆ เปลี่ยน"
    ],
    zh: [
      "氛围重于主歌",
      "空间、音色与缓慢演进"
    ]
  },
  classical: {
    uk: [
      "акademічна форма та оркестровка",
      "динаміка, тема, довга форма"
    ],
    pl: [
      "formalna akademicka forma i orkiestracja",
      "dynamika, temat, długa forma"
    ],
    th: [
      "รูปแบบและการเรียบเรียงวงออร์เคสตรา",
      "ไดนามิก ธีม และฟอร์มยาว"
    ],
    zh: [
      "学院派形式与配器",
      "动态、主题与长形式"
    ]
  },
  electronic: {
    uk: [
      "синтез, біт і студійна фактура",
      "електронні тембри замість «живої» стіни"
    ],
    pl: [
      "synteza, beat i studyjna faktura",
      "elektroniczne barwy zamiast „live” ściany"
    ],
    th: [
      "การสังเคราะห์ บีต และพื้นผิวสตูดิโอ",
      "เนื้อเสียงอิเล็กทรонิกส์แทนกำแพงสด"
    ],
    zh: [
      "合成、节拍与 studio 质感",
      "电子音色取代「现场」音墙"
    ]
  },
  metal: {
    uk: [
      "важкі гітари та екстремальна енергія",
      "гітарний напір і темна естетика"
    ],
    pl: [
      "ciężkie gitary i ekstremalna energia",
      "gitarowy nacisk i mroczna estetyka"
    ],
    th: [
      "กีตาร์หนักและพลังสุดขั้ว",
      "แรงกดจากกีตาร์และสุนทรีย์มืด"
    ],
    zh: [
      "重型吉他与极端能量",
      "吉他压迫感与黑暗美学"
    ]
  },
  punk: {
    uk: [
      "короткі різкі пісні та DIY",
      "сирий темп і антигламур"
    ],
    pl: [
      "krótkie ostre piosenki i DIY",
      "surowe tempo i anty‑glamour"
    ],
    th: [
      "เพลงสั้นคมและ DIY",
      "จังหวะดิบและต่อต้านความหรู"
    ],
    zh: [
      "短促尖锐的歌曲与 DIY",
      " raw 速度与反 glamour"
    ]
  },
  jazz: {
    uk: [
      "імпровізація, свінг, діалог інструментів",
      "гармонія й соло як розмова"
    ],
    pl: [
      "improwizacja, swing, dialog instrumentów",
      "harmonia i solówki jak rozmowa"
    ],
    th: [
      "improv swing และบทสนทนาของเครื่องดนตรี",
      "ฮาร์มอนีและโซโลเหมือนการคุย"
    ],
    zh: [
      "即兴、swing 与乐器对话",
      "和声与 solo 如交谈"
    ]
  },
  blues: {
    uk: [
      "блю‑ноти та сторітелінг",
      "гітара, надрив, свінгуючий пульс"
    ],
    pl: [
      "blue notes i storytelling",
      "gitara, ból, swingujący puls"
    ],
    th: [
      "blue note และการเล่าเรื่อง",
      "กีตาร์ ความเจ็บปวด และ pulse สwing"
    ],
    zh: [
      "蓝调音与叙事",
      "吉他、痛楚与 swing 脉动"
    ]
  },
  soul: {
    uk: [
      "теплий вокал і грув",
      "емоція в центрі аранжування"
    ],
    pl: [
      "ciepły wokal i groove",
      "emocja w centrum aranżacji"
    ],
    th: [
      "เสียงร้องอบอุ่นและ groove",
      "อารมณ์อยู่กลางการเรียบเรียง"
    ],
    zh: [
      "温暖人声与 groove",
      "情感处于编曲中心"
    ]
  },
  funk: {
    uk: [
      "синкопи, бас і танцювальний groove",
      "ритм‑секція попереду"
    ],
    pl: [
      "synkopy, bas i taneczny groove",
      "sekcja rytmiczna z przodu"
    ],
    th: [
      "syncopation เบส และ groove เต้น",
      "ไลน์จังหวะนำหน้า"
    ],
    zh: [
      "切分音、 bass 与 dance groove",
      " rhythm section 在前"
    ]
  },
  disco: {
    uk: [
      "чотири четверті, струни, танцпол",
      "блиск 70‑х і бас‑лінія"
    ],
    pl: [
      "cztery na cztery, smyczki, parkiet",
      "blask lat 70. i linia basu"
    ],
    th: [
      "สี่จังหวะ  стринг และฟลอร์เต้น",
      "ความเงาวับยุค 70 และไลน์เบส"
    ],
    zh: [
      "四四拍、弦乐与舞池",
      "70 年代光泽与 bass line"
    ]
  },
  reggae: {
    uk: [
      "offbeat, бас, ямайський пульс",
      "сканк‑акценти та глибокий бас"
    ],
    pl: [
      "offbeat, bas, jamajski puls",
      "akcenty skank i głęboki bas"
    ],
    th: [
      "offbeat เบส และ pulse จาไมก้า",
      "สkank accent และเบสลึก"
    ],
    zh: [
      " offbeat、 bass 与牙买加脉动",
      " skank 重音与深沉 bass"
    ]
  },
  gospel: {
    uk: [
      "хор, віра, потужний вокал",
      "духовний підйом в аранжуванні"
    ],
    pl: [
      "chór, wiara, potężny wokal",
      "duchowy wzlot w aranżacji"
    ],
    th: [
      "คณะนักร้อง ศรัทธา และเสียงร้องทรงพลัง",
      "การยกระดับทางจิตวิญญาณในการเรียบเรียง"
    ],
    zh: [
      "合唱、信仰与 powerful 人声",
      "编曲中的 spiritual 升华"
    ]
  },
  country: {
    uk: [
      "історії, гітара, Americana‑корені",
      "наратив і акустичний каркас"
    ],
    pl: [
      "historie, gitara, korzenie Americany",
      "narracja i akustyczna rama"
    ],
    th: [
      "เรื่องราว กีตาร์ และราก Americana",
      "การเล่าเรื่องและโครงอะคูสติก"
    ],
    zh: [
      "故事、吉他与 Americana 根",
      "叙事与 acoustic 框架"
    ]
  },
  folk: {
    uk: [
      "акустика, традиції, розповідь",
      "живі тембри й пісенна простота"
    ],
    pl: [
      "akustyka, tradycja, opowieść",
      "żywe barwy i prosta piosenka"
    ],
    th: [
      "อะคูสติก ประเพณี และการเล่า",
      "เนื้อเสียงสดและเพลงเรียบง่าย"
    ],
    zh: [
      " acoustic 音色、传统与讲述",
      " live 质感与朴素 songwriting"
    ]
  },
  latin: {
    uk: [
      "латинський ритм і танцювальний вогонь",
      "перкусія й сонячний грув"
    ],
    pl: [
      "latynoski rytm i taneczny ogień",
      "perkusja i słoneczny groove"
    ],
    th: [
      "จังหวะลatin และไฟเต้นรำ",
      "เปrcussion และ groove แดดจัด"
    ],
    zh: [
      "拉丁节奏与 dance 热度",
      "打击乐与 sunny groove"
    ]
  },
  samba: {
    uk: [
      "бразильська перкусія та карнавал",
      "поліритмія й сонячна енергія"
    ],
    pl: [
      "brazylijska perkusja i karnawał",
      "polirytmia i słoneczna energia"
    ],
    th: [
      "เปrcussion บราซิลและคาร์นิวัล",
      "โพลีริทึมและพลังแดด"
    ],
    zh: [
      "巴西打击乐与 carnival",
      "复合节奏与 sunny 能量"
    ]
  },
  bossa: {
    uk: [
      "м’який бrazilian swing і камерна гармонія",
      "акустика, шепіт, jazz‑відтінок"
    ],
    pl: [
      "miękki brazylijski swing i kameralna harmonia",
      "akustyka, szept, jazzowy odcień"
    ],
    th: [
      "swing บราซิลนุ่มและฮาร์มอนีใกล้ชิด",
      "อะคูสติก กระซิบ และเฉดแจ๊z"
    ],
    zh: [
      "柔和巴西 swing 与 intimate 和声",
      "acoustic 低语与 jazz  tint"
    ]
  },
  brazilian: {
    uk: [
      "бrazilian ритм, тепло й swing",
      "південноамериканський пульс"
    ],
    pl: [
      "brazylijski rytm, ciepło i swing",
      "południowoamerykański puls"
    ],
    th: [
      "จังหวะบราซิล ความอบอุ่น และ swing",
      "pulse อเมริกาใต้"
    ],
    zh: [
      "巴西节奏、 warmth 与 swing",
      "南美 pulse"
    ]
  },
  trap: {
    uk: [
      "808, дробові хети, південний вайб",
      "важкий бас і мелодійні хуки"
    ],
    pl: [
      "808, rolling hi‑haty, południowy klimat",
      "ciężki bas i melodyjne hooki"
    ],
    th: [
      "808 แฮตกลิ้ง และ vibe ใต้",
      "เบสหนักและ hook ทำนอง"
    ],
    zh: [
      "808、 rolling hi-hat 与 southern mood",
      "重 bass 与 melodic hook"
    ]
  },
  rage: {
    uk: [
      "спотворені 808 і гіпер‑енергія",
      "кричущі хуки поверх trap‑каркаса"
    ],
    pl: [
      "zniekształcone 808 i hiperenergia",
      "krzyczące hooki na trapowym szkielecie"
    ],
    th: [
      "808 บ искажен และพลังสูงสุด",
      "hook ตะโกนทับโครง trap"
    ],
    zh: [
      "失真 808 与 hyper 能量",
      "在 trap 框架上的 yelling hook"
    ]
  },
  rap: {
    uk: [
      "рими, флоу й характерний біт",
      "ритмічне мовлення як головний інструмент"
    ],
    pl: [
      "rymy, flow i charakterystyczny beat",
      "rytmiczna mowa jako lead"
    ],
    th: [
      "สัมผัส flow และบีตเฉพาะตัว",
      "คำพูดจังหวะเป็น lead"
    ],
    zh: [
      "押韵、 flow 与 signature 节拍",
      " rhythmic  speech 作为 lead"
    ]
  },
  hiphop: {
    uk: [
      "біт, флоу й культура сцени",
      "ударні, семпли, характерна подача"
    ],
    pl: [
      "beat, flow i kultura sceny",
      "bębny, sample, charakterystyczna prezentacja"
    ],
    th: [
      "บีต flow และวัฒนธรรมซีน",
      "กลอง เซมเปิล และการส่งเสียงเฉพาะ"
    ],
    zh: [
      " beats、 flow 与 scene 文化",
      "鼓、采样与 signature 呈现"
    ]
  },
  emo: {
    uk: [
      "ispовідальний вокал і різкі динаміки",
      "емоція й гітарна ispовідь"
    ],
    pl: [
      "wokal wyznaniowy i ostre dynamiki",
      "emocja i gitara jako spowiedź"
    ],
    th: [
      "เสียงร้องสารภาพและไดนามิกคม",
      "อารมณ์และกีตาร์สารภาพ"
    ],
    zh: [
      " confessional 人声与 sharp 动态",
      "情感与吉他 confessional"
    ]
  },
  ska: {
    uk: [
      "offbeat‑гітара й духова енергія",
      "стрибкий ритм і brass"
    ],
    pl: [
      "gitara offbeat i energia instrumentów dętych",
      "skoczny rytm i brass"
    ],
    th: [
      "กีตาร์ offbeat และพลัง brass",
      "จังหวะเด้งและ brass"
    ],
    zh: [
      " offbeat 吉他与 horn 能量",
      " bouncy 节奏与 brass"
    ]
  },
  indie: {
    uk: [
      "незалежна сцена й власний почерк",
      "менше глянцю, більше характеру"
    ],
    pl: [
      "niezależna scena i własny znak",
      "mniej połysku, więcej charakteru"
    ],
    th: [
      "ซีนอิสระและลายเซ็นต์เฉพาะ",
      "เงาน้อย บุคลิกมาก"
    ],
    zh: [
      "独立 scene 与个人印记",
      " less gloss、 more character"
    ]
  },
  rock: {
    uk: [
      "гітарний драйв і пісенний каркас",
      "ритм‑секція й енергійна подача"
    ],
    pl: [
      "gitarowy drive i szkielet piosenki",
      "sekcja rytmiczna i energia z przodu"
    ],
    th: [
      "drive กีตาร์และโครงเพลง",
      "ไลน์จังหวะและพลังนำหน้า"
    ],
    zh: [
      "吉他 drive 与 song 骨架",
      " rhythm section 能量在前"
    ]
  },
  pop: {
    uk: [
      "цепкі мелодії й радіоформат",
      "хуки, куплет‑приспів, полірований продакшн"
    ],
    pl: [
      "chwytliwe melodie i format radiowy",
      "hooki, zwrotka‑refren, wypolerowany produkcja"
    ],
    th: [
      "ทำนองติดหูและรูปแบบวิทยุ",
      "hook เวิร์ส-คorus และโปรดักชันเงา"
    ],
    zh: [
      " catchy 旋律与 radio 形态",
      " hook、主副歌与 polished production"
    ]
  },
  wave: {
    uk: [
      "синтез, атмосфера, нічний вайб",
      "echo 80‑х і мелодійна електроніка"
    ],
    pl: [
      "synteza, atmosfera, nocny klimat",
      "echo lat 80. i melodyjna elektronika"
    ],
    th: [
      "ซินธ์ บรรยากาศ และ vibe กลางคืน",
      "echo ยุค 80 และอิเล็กทรонิกส์ทำนอง"
    ],
    zh: [
      "合成器、氛围与 night mood",
      "80s echo 与 melodic electronics"
    ]
  },
  dream: {
    uk: [
      "туманний вокал і гітари в ревербе",
      "настрій важливіший за гострі хуки"
    ],
    pl: [
      "mglisty wokal i gitary w reverb",
      "nastrój ważniejszy niż ostre hooki"
    ],
    th: [
      "เสียงร้องหมอกและกีตาร์ใน reverb",
      "อารมณ์สำคัญกว่า hook คม"
    ],
    zh: [
      "朦胧人声与 reverbed 吉他",
      " mood 重于 sharp hook"
    ]
  },
  kpop: {
    uk: [
      "полірований idol‑pop і хореографія",
      "хуки, hip‑hop і студійний блиск"
    ],
    pl: [
      "wypolerowany idol pop i choreografia",
      "hooki, hip‑hop i studyjny blask"
    ],
    th: [
      "idol pop เงาและการเต้น",
      "hook hip-hop และความเงาสตูดิโอ"
    ],
    zh: [
      " polished idol pop 与 choreography",
      " hook、 hip-hop 与 studio gloss"
    ]
  },
  jpop: {
    uk: [
      "японський pop із яскравими хуками",
      "idol/anime естетика й глянець"
    ],
    pl: [
      "japoński pop z jasnymi hookami",
      "estetyka idol/anime i połysk"
    ],
    th: [
      "ป็อปญี่ปุ่นพร้อม hook สดใส",
      "สุนทรีย์ idol/anime และความเงา"
    ],
    zh: [
      "日本 pop 与 bright hook",
      " idol/anime 美学与 gloss"
    ]
  },
  lofi: {
    uk: [
      "тепла «неідеальна» фактура й м’який біт",
      "шипіння, кімнатність, затишна шorоховatist"
    ],
    pl: [
      "ciepła „nieidealna” faktura i miękki beat",
      "szum taśmy, pokój, przytulna szorstkość"
    ],
    th: [
      "พื้นผิวอบอุ่นไม่สมบูรณ์และบีตนุ่ม",
      "เสียงเทป ห้อง และความหยาบอ cozy"
    ],
    zh: [
      " warm imperfect 质感与 soft beat",
      " hiss、 room tone 与 cozy grit"
    ]
  },
  lullaby: {
    uk: [
      "м’які тембри й заспокійливий темп",
      "інструментальна тиша для сну"
    ],
    pl: [
      "miękkie barwy i uspokajające tempo",
      "instrumentalna cisza na sen"
    ],
    th: [
      "เนื้อเสียงนุ่มและจังหวะ calming",
      "ความเงียบ instrumental สำหรับนอน"
    ],
    zh: [
      " soft timbre 与 calming 速度",
      "为睡眠准备的 instrumental 安静"
    ]
  },
  score: {
    uk: [
      "кінематографічні теми й leitmotif",
      "музика під картинку, а не під радіо"
    ],
    pl: [
      "kinowe tematy i leitmotywy",
      "muzyka do obrazu, nie do radia"
    ],
    th: [
      "ธีมภาพยนตร์และ leitmotif",
      "ดนตรีสำหรับภาพ ไม่ใช่วิทยุ"
    ],
    zh: [
      "电影主题与 leitmotif",
      "为画面而非 radio 而作的音乐"
    ]
  },
  soundtrack: {
    uk: [
      "теми з фільмів/ігор і soundtrack‑форма",
      "атмосфера сцени важливіша за куплет"
    ],
    pl: [
      "motywy z filmów/gier i forma soundtracku",
      "atmosfera sceny ważniejsza niż zwrotka"
    ],
    th: [
      "ธีมจากหนัง/เกมและรูปแบบ soundtrack",
      "บรรยากาศฉากสำคัญกว่าเวิร์ส"
    ],
    zh: [
      "电影/游戏主题与 soundtrack 形式",
      " scene 氛围重于主歌"
    ]
  },
  choir: {
    uk: [
      "хорові голоси й гармонії",
      "колективний вокал у центрі"
    ],
    pl: [
      "głosy chóralne i harmonie",
      "wokal zbiorowy w centrum"
    ],
    th: [
      "เสียงประสานและฮาร์มอนี",
      "เสียงร้องรวมอยู่กลาง"
    ],
    zh: [
      "合唱声部与和声",
      " collective vocals 在中心"
    ]
  },
  orchestra: {
    uk: [
      "оркестрова палітра й великі форми",
      "струни, духові, динаміка"
    ],
    pl: [
      "orkiestrowa paleta i duże formy",
      "smyczki, dęte, dynamika"
    ],
    th: [
      "พาเลตออร์เคสตราและฟอร์มใหญ่",
      " стрings ลม และไดนามิก"
    ],
    zh: [
      "管弦 palette 与大形式",
      "弦乐、管乐与动态"
    ]
  },
  piano: {
    uk: [
      "фортепіано як головний тембр",
      "клавішна фактура й мелодія"
    ],
    pl: [
      "fortepian jako główny timbre",
      "faktura klawiszowa i melodia"
    ],
    th: [
      "เปียano เป็น lead timbre",
      "พื้นผิวคีย์บอร์ดและทำนอง"
    ],
    zh: [
      "钢琴作为 lead timbre",
      "键盘质感与旋律"
    ]
  },
  guitar: {
    uk: [
      "гітара в центрі аранжування",
      "струнний драйв або акустичний малюнок"
    ],
    pl: [
      "gitara w centrum aranżacji",
      "drive strunowy lub akustyczny wzór"
    ],
    th: [
      "กีตาร์อยู่กลางการเรียบเรียง",
      "drive สายหรือลายอะคูสติก"
    ],
    zh: [
      "吉他处于编曲中心",
      "弦乐 drive 或 acoustic figure"
    ]
  },
  bass: {
    uk: [
      "бас веде гармонію й грув",
      "низ як головний персонаж"
    ],
    pl: [
      "bas prowadzi harmonię i groove",
      "niskie tony jako główny bohater"
    ],
    th: [
      "เบสนำฮาร์มอนีและ groove",
      "ทุ่นต่ำเป็นตัวเอก"
    ],
    zh: [
      " bass 引领和声与 groove",
      "低频作为主角"
    ]
  },
  instrumental: {
    uk: [
      "без провідного вокалу — тембр і форма",
      "інструменти тримають увагу самі"
    ],
    pl: [
      "bez wiodącego wokalu — timbre i forma",
      "instrumenty same trzymają uwagę"
    ],
    th: [
      "ไม่มี lead vocal — timbre และฟอร์ม",
      "เครื่องดนตรีดึงความสนใจเอง"
    ],
    zh: [
      "无 lead vocal — timbre 与 form",
      "乐器独自抓住注意力"
    ]
  },
  acoustic: {
    uk: [
      "живі струни й «кімнатний» звук",
      "акустика без важкого продакшну"
    ],
    pl: [
      "żywe struny i brzmienie „pokoju”",
      "akustyka bez ciężkiej produkcji"
    ],
    th: [
      "สายสดและเสียงห้อง",
      "อะคูสติกไร้โปรดักชันหนัก"
    ],
    zh: [
      " live 弦与 room sound",
      " acoustic 无 heavy production"
    ]
  },
  progressive: {
    uk: [
      "складні форми й зміна розмірів",
      "довгі побудови й техніка"
    ],
    pl: [
      "złożone formy i zmieniające się metry",
      "długie buildy i technika"
    ],
    th: [
      "ฟอร์มซับซ้อนและเมตรที่เปลี่ยน",
      "บิลด์ยาวและเทคนิค"
    ],
    zh: [
      "复杂形式与 shifting 拍号",
      "长 build 与 technique"
    ]
  },
  experimental: {
    uk: [
      "зламані очікування й пошук тембру",
      "експеримент важливіший за звичну пісню"
    ],
    pl: [
      "złamane oczekiwania i poszukiwanie timbre",
      "eksperyment ważniejszy niż znana piosenka"
    ],
    th: [
      "ความคาดหวังที่แตกและการค้นหา timbre",
      "การทดลองสำคัญกว่าเพลงคุ้นเคย"
    ],
    zh: [
      "打破预期与 timbre 探索",
      "实验重于 familiar song"
    ]
  },
  alternative: {
    uk: [
      "альтернатива мейнстриму: свій кут",
      "нестандартний почерк у rock/pop"
    ],
    pl: [
      "alternatywa dla mainstreamu: własny kąt",
      "nieszablonowy znak w rocku/popie"
    ],
    th: [
      "ทางเลือกจาก mainstream: มุมของตัวเอง",
      "ลายเซ็นต์ off-center ใน rock/pop"
    ],
    zh: [
      "主流之外的 alternative 角度",
      " rock/pop 内的 off-center 印记"
    ]
  },
  christian: {
    uk: [
      "віра й духовний текст у сучасній обгортці",
      "поклоніння через знайомі жанрові форми"
    ],
    pl: [
      "wiara i duchowy tekst w nowoczesnej oprawie",
      "uwielbienie przez znane formy gatunków"
    ],
    th: [
      "ศรัทธาและข้อความจิตวิญญาณในห่อสมัยใหม่",
      "การนมัสการผ่านฟอร์มแนวที่คุ้นเคย"
    ],
    zh: [
      "信仰与 spiritual 文本的现代包装",
      "通过 familiar genre 形式的 worship"
    ]
  },
  kids: {
    uk: [
      "прості мелодії й дитяча аудиторія",
      "легкий темп і зрозумілі хуки"
    ],
    pl: [
      "proste melodie i dziecięca publiczność",
      "lekkie tempo i jasne hooki"
    ],
    th: [
      "ทำนองง่ายและกลุ่มเด็ก",
      "จังหวะเบาและ hook ชัด"
    ],
    zh: [
      "简单旋律与儿童受众",
      " easy 速度与 clear hook"
    ]
  },
  children: {
    uk: [
      "музика для дітей: ясність і гра",
      "короткі форми й м’яка динаміка"
    ],
    pl: [
      "muzyka dla dzieci: jasność i zabawa",
      "krótkie formy i miękka dynamika"
    ],
    th: [
      "ดนตรีสำหรับเด็ก: ชัดเจนและเล่น",
      "ฟอร์มสั้นและไดนามิกนุ่ม"
    ],
    zh: [
      "儿童音乐：清晰与 play",
      "短形式与 soft 动态"
    ]
  }
}

export const MOD_EXTRA = {
  melodic: {
    uk: "мелодія виходить уперед",
    pl: "melodia wysuwa się na pierwszy plan",
    th: "ทำนองเด่นขึ้นมา",
    zh: "旋律更靠前"
  },
  dark: {
    uk: "темний, «нічний» відтінок",
    pl: "ciemny, nocny odcień",
    th: "เฉดมืด กลางคืน",
    zh: "阴暗、深夜色调"
  },
  deep: {
    uk: "глибокий низ і простір",
    pl: "głęboki dół i przestrzeń",
    th: "ทุ่นต่ำลึกและ space",
    zh: "深沉低频与空间"
  },
  chill: {
    uk: "розслаблений темп без різких кутів",
    pl: "spokojne tempo bez ostrych kątów",
    th: "จังหวะผ่อนคลายไม่มีมุมคม",
    zh: "放松节奏、无尖锐棱角"
  },
  sad: {
    uk: "меланхолійний нахил",
    pl: "melancholijne nachylenie",
    th: "โน้มเอนโมห้าเศร้า",
    zh: " melancholy 倾向"
  },
  progressive: {
    uk: "складніші форми",
    pl: "bardziej złożone formy",
    th: "ฟอร์มที่ซับซ้อนขึ้น",
    zh: "更复杂的形式"
  },
  atmospheric: {
    uk: "атмосфера важливіша за удар",
    pl: "atmosfera ważniejsza niż uderzenie",
    th: "บรรยากาศสำคัญกว่า punch",
    zh: "氛围重于冲击"
  },
  classic: {
    uk: "відсилка до «класики» стилю",
    pl: "ukłon w stronę klasyki stylu",
    th: "การยกย่องคลาสสิกของสไตล์",
    zh: "向该风格经典致敬"
  },
  modern: {
    uk: "сучасна продюсерська обгортка",
    pl: "nowoczesna producencka oprawa",
    th: "ห่อโปรducer สมัยใหม่",
    zh: "现代制作人包装"
  },
  traditional: {
    uk: "ближче до традиційного ядра",
    pl: "bliżej tradycyjnego rdzenia",
    th: "ใกล้แกนแบบดั้งเดิม",
    zh: "更接近传统核心"
  },
  experimental: {
    uk: "схильність ламати шаблон",
    pl: "skłonność do łamania szablonu",
    th: "นิสัยทำลายแม่แบบ",
    zh: "习惯打破模板"
  },
  indie: {
    uk: "незалежний, менш глянceвий кут",
    pl: "niezależny, mniej błyszczący kąt",
    th: "มุมอิสระ เงาน้อย",
    zh: "独立、 less glossy 角度"
  },
  instrumental: {
    uk: "без провідного вокалу",
    pl: "bez wiodącego wokalu",
    th: "ไม่มี lead vocal",
    zh: "无 lead vocal"
  },
  vocal: {
    uk: "голос у центрі уваги",
    pl: "głos w centrum uwagi",
    th: "เสียงอยู่กลางความสนใจ",
    zh: "人声居中"
  },
  acoustic: {
    uk: "акустичний каркас",
    pl: "akustyczna rama",
    th: "โครงอะคูสติก",
    zh: "acoustic 框架"
  },
  electric: {
    uk: "електричний драйв",
    pl: "elektryczny drive",
    th: "drive ไฟฟ้า",
    zh: " electric drive"
  },
  heavy: {
    uk: "утяжелена подача",
    pl: "cięższa prezentacja",
    th: "การส่งเสียงหนักขึ้น",
    zh: "更重的呈现"
  },
  soft: {
    uk: "м’яка динаміка",
    pl: "miękka dynamika",
    th: "ไดนามิกนุ่ม",
    zh: " soft 动态"
  },
  funky: {
    uk: "funk‑акцент у ритмі",
    pl: "funkowy akcent w rytmie",
    th: "สำเนียง funk ในจังหวะ",
    zh: " rhythm 中的 funk  accent"
  },
  psychedelic: {
    uk: "психоделічний розмитий край",
    pl: "psychodeliczna rozmyta krawędź",
    th: "ขอบ psychedelic ที่ละลาย",
    zh: " psychedelic 模糊边缘"
  },
  tropical: {
    uk: "тропічний, сонячний відтінок",
    pl: "tropikalny, słoneczny odcień",
    th: "เฉดเขตร้อน แดดจัด",
    zh: "热带、 sunny 色调"
  },
  gothic: {
    uk: "gothic‑тінь в естетиці",
    pl: "gotowski cień w estetyce",
    th: "เงา gothic ในสุนทรีย์",
    zh: "美学中的 gothic 阴影"
  },
  raw: {
    uk: "сирій, майже «живий» звук",
    pl: "surowe, niemal „live” brzmienie",
    th: "เสียงดิบ เกือบ live",
    zh: " raw、 nearly live 声音"
  },
  polish: {
    uk: "полірований студійний блиск",
    pl: "wypolerowany studyjny blask",
    th: "ความเงาสตูดิโอขัดเงา",
    zh: " polished studio gloss"
  },
  future: {
    uk: "фuturistичний цифровий відтінок",
    pl: " futurystyczny cyfrowy odcień",
    th: "เฉดดิจิทัล futurist",
    zh: " futuristic  digital  tint"
  },
  vintage: {
    uk: "vintage‑фактура",
    pl: "vintage faktura",
    th: "พื้นผิว vintage",
    zh: " vintage 质感"
  },
  urban: {
    uk: "міський вуличний вайб",
    pl: "miejski uliczny klimat",
    th: "vibe ถนนในเมือง",
    zh: " urban street vibe"
  },
  rural: {
    uk: "провincialний, «земний» тон",
    pl: "prowincjonalny, ziemisty ton",
    th: "โทนชนบท ดิน",
    zh: " rural、 earthy  tone"
  },
  comic: {
    uk: "грайливий, майже жартівливий кут",
    pl: "figlarny, niemal komiczny kąt",
    th: "มุมขี้เล่น เกือบตลก",
    zh: " playful、 almost comic 角度"
  },
  horror: {
    uk: "тривожна horror‑естетика",
    pl: "niepokojąca estetyka horroru",
    th: "สุนทรีย์ horror ที่ไม่สบายใจ",
    zh: " unsettling horror 美学"
  },
  game: {
    uk: "ігровий/soundtrack контекст",
    pl: "kontekst gry/soundtracku",
    th: "บริบทเกม/soundtrack",
    zh: " game/soundtrack 语境"
  },
  anime: {
    uk: "anime‑естетика й OST‑логіка",
    pl: "estetyka anime i logika OST",
    th: "สุนทรีย์ anime และ logic OST",
    zh: " anime 美学与 OST 逻辑"
  },
  lounge: {
    uk: "lounge‑розслабленість",
    pl: "lounge’owa swoboda",
    th: "ความผ่อนคลายแบบ lounge",
    zh: " lounge 轻松感"
  },
  club: {
    uk: "клубна функція важливіша за альбом",
    pl: "funkcja klubowa ważniejsza niż album",
    th: "ฟังก์ชันคลับสำคัญกว่าอัลบั้ม",
    zh: " club 功能重于专辑故事"
  },
  dance: {
    uk: "танцпол як головна мета",
    pl: "parkiet jako główny cel",
    th: "ฟลอร์เต้นเป็นเป้าหมายหลัก",
    zh: "舞池是首要目标"
  },
  sleep: {
    uk: "музика для сну й фону",
    pl: "muzyka do snu i tła",
    th: "ดนตรีสำหรับนอนและพื้นหลัง",
    zh: "睡眠与背景音乐"
  },
  study: {
    uk: "фон для навчання/фокусу",
    pl: "tło do nauki/fokusu",
    th: "พื้นหลังสำหรับเรียน/โฟกัส",
    zh: "学习/专注背景"
  },
  workout: {
    uk: "темп під рух і тренування",
    pl: "tempo pod ruch i trening",
    th: "จังหวะสำหรับการเคลื่อนไหว",
    zh: "为运动而设的速度"
  },
  christmas: {
    uk: "святковий сезонний відтінок",
    pl: "świąteczny sezonowy odcień",
    th: "เฉดฤดูกาลเทศกาล",
    zh: "节日 seasonal 色调"
  },
  christian: {
    uk: "духовний/християнський текст",
    pl: "duchowy/chrześcijański tekst",
    th: "ข้อความจิตวิญญาณ/คริสเตียน",
    zh: " spiritual/Christian 文本"
  }
}

export const PLACE_EXTRA = [
  {
    uk: "британський",
    pl: "brytyjski",
    th: "อังกฤษ",
    zh: "英国"
  },
  {
    uk: "німецький",
    pl: "niemiecki",
    th: "เยอรมัน",
    zh: "德国"
  },
  {
    uk: "французький",
    pl: "francuski",
    th: "ฝรั่งเศส",
    zh: "法国"
  },
  {
    uk: "японський",
    pl: "japoński",
    th: "ญี่ปุ่น",
    zh: "日本"
  },
  {
    uk: "корейський",
    pl: "koreański",
    th: "เกาหลี",
    zh: "韩国"
  },
  {
    uk: "бrazilian",
    pl: "brazylijski",
    th: "บราซิล",
    zh: "巴西"
  },
  {
    uk: "мексиканський",
    pl: "meksykański",
    th: "เม็กซิโก",
    zh: "墨西哥"
  },
  {
    uk: "африканський",
    pl: "afrykański",
    th: "แอฟริกา",
    zh: "非洲"
  },
  {
    uk: "скандинавський",
    pl: "skandynawski",
    th: "นอร์ดิก",
    zh: "北欧"
  },
  {
    uk: "східноєвропейський",
    pl: "wschodnioeuropejski",
    th: "ยุโรปตะวันออก",
    zh: "东欧"
  },
  {
    uk: "канадський",
    pl: "kanadyjski",
    th: "แคนาดา",
    zh: "加拿大"
  },
  {
    uk: "австралійський",
    pl: "australijski",
    th: "ออสเตรเลีย",
    zh: "澳大利亚"
  },
  {
    uk: "італійський",
    pl: "włoski",
    th: "อิตาลี",
    zh: "意大利"
  },
  {
    uk: "іспанський",
    pl: "hiszpański",
    th: "สเปน",
    zh: "西班牙"
  },
  {
    uk: "нідерlandський/бельгійський",
    pl: "holenderski/belgijski",
    th: "ดัตช์/เบลเยียม",
    zh: "荷兰/比利时"
  },
  {
    uk: "локальний американський",
    pl: "lokalny amerykański",
    th: "อเมริกันท้องถิ่น",
    zh: "美国本地"
  },
  {
    uk: "латиноамериканський",
    pl: "latynoamerykański",
    th: "ลатинอเมริกา",
    zh: "拉丁美洲"
  }
]

export const SEED_SECONDARY = {
  uk: {
    pop: "Поп — масова популярна музика з цепкими мелодіями, формою куплет‑приспів і продакшном під радіо та стрімінг.",
    "post-punk": "Постпанк пішов далі панку: кутовий бас, атмосфера та art‑school краї. Пострадянська хвиля додала холодні синтезатори й нічний міський вайб. Це улюблений жанр творця застосунку.",
    metal: "Метал — важкий гitarний стиль із потужним звучанням, що виріс з hard rock і розгалужився на безліч піджанрів.",
    rock: "Рок — напрям популярної музики з характерним ритмом і гitarним драйвом, що виріс з rock and roll.",
    jazz: "Джazz виріс з афроамериканських традицій: свінг, імпровізація, блю‑ноти та еволюція стилів.",
    techno: "Техно — електронна танцювальна музика з Детройта: повторювані машинні ритми та довгий клубний драйв.",
    house: "Хаус народився в Чикаго 1980‑х: біт four‑on‑the‑floor, soul/vocal хуки та клубний грув.",
    ambient: "Ембієнт робить ставку на атмосферу й тон, а не на звичну пісенну форму.",
    "hip hop": "Хіп‑хоп — культура й музика Нью‑Йорка 1970‑х навколо репу, DJing, breaks і студійного продакшну.",
    rap: "Реп — вокальна подача з римою та ритмічним мовленням, зазвичай поверх біту; ключова частина хіп‑хоп культури.",
    punk: "Панк — швидкий сирий рок і культура 1970‑х: короткі пісні, DIY та антисистемний настрій.",
    phonk: "Фонк поєднує хіп‑хоп із семплами Memphis rap 1990‑х — cowbell, спotворений бас і lo‑fi шorохovatist.",
    hyperpop: "Hyperpop — електронно‑pop рух 2010‑х: максималізм, глянceві та pitch‑shifted вокали, хаотичний internet‑native продакшн.",
    vaporwave: "Vaporwave — internet‑microgenre початку 2010‑х: нарізані й уповільнені семпли lounge та corporate mood 1980–90‑х.",
    shoegaze: "Shoegaze — alternative rock із washed‑out вокалом, стінами гitarних ефектів і immersive texture.",
    synthwave: "Synthwave — retro electronic music, що нагадує 1980s film і game scores.",
    trap: "Trap — хіп‑хоп із чіткими хетами, грохотливими 808 і південними коренями США.",
    drill: "Drill — хіп‑хоп із темними sliding 808 і жорсткою подачею; почався в Чикаго й пізніше розгалужився в UK.",
    dubstep: "Dubstep — бritанський electronic dance style початку 2000‑х: sparse rhythm і heavy bass.",
    "k-pop": "K‑pop — південнокорейська popular music: polished pop, hip‑hop і electronics плюс idol‑group choreography.",
    reggae: "Reggae сформувався на Ямайці наприкінці 1960‑х: offbeat акcentи, bass попереду та sound‑system culture.",
    "dream pop": "Dream pop любить hazy vocal, reverbed guitars і м’який фокус — більше mood, ніж sharp hooks.",
    "new wave": "New wave — pop‑rock кінця 1970‑х / початку 1980‑х після punk: synths і angular guitars.",
    industrial: "Industrial використовує abrasive noise, mechanical rhythms і confrontational aesthetics.",
    grime: "Grime — бritish electronic/rap style початку 2000‑х із East London.",
    "lo-fi": "Lo‑fi як label — warm «imperfect» music: tape hiss, soft beat і cozy grit.",
    afrobeats: "Afrobeats — сучасний West African pop continuum: highlife, hip‑hop і dance rhythms.",
    amapiano: "Amapiano — південноafрican style з house: lush log‑drums і wide bass.",
    reggaeton: "Reggaeton поєднує Latin rhythms з hip‑hop і dancehall influence навколо dembow beat.",
    "drum and bass": "Drum and bass — бritish electronics на fast breakbeats і heavy bass.",
    "black metal": "Black metal — extreme metal з fast tempos, scream і raw atmospheric sound.",
    breakcore: "Breakcore — extreme electronics на chopped Amen breaks, chaotic edits і high BPM.",
    rage: "Rage — trap‑adjacent internet style з distorted 808, yelling hooks і hyper‑aggressive energy."
  },
  pl: {
    pop: "Pop to mainstreamowa muzyka popularna z chwytliwymi melodiami, formą zwrotka‑refren i produkcją pod radio i streaming.",
    "post-punk": "Post‑punk poszedł dalej niż punk: kanciasty bas, atmosfera i art‑school. Fala postsowiecka dodała zimne syntezatory i nocny miejski klimat. To ulubiony gatunek twórcy aplikacji.",
    metal: "Metal to ciężki styl oparty na gitarze, który wyrósł z hard rocka i rozgałęził się na wiele podgatunków.",
    rock: "Rock to popularna muzyka z charakterystycznym rytmem i gitarową energią, wywodząca się z rock and rolla.",
    jazz: "Jazz wywodzi się z tradycji afroamerykańskich: swing, improwizacja, blue notes i ewoluujące style.",
    techno: "Techno to detroicka muzyka taneczna: powtarzalne maszynowe rytmy i długi klubowy drive.",
    house: "House narodził się w Chicago lat 80.: beat four‑on‑the‑floor, soul/vocal hooki i klubowy groove.",
    ambient: "Ambient stawia na atmosferę i ton, a nie na znajomą formę piosenki.",
    "hip hop": "Hip‑hop to kultura i muzyka Nowego Jorku lat 70. wokół rapu, DJ‑ingu, breaków i późniejszej produkcji studyjnej.",
    rap: "Rap to rytmiczna rymowana mowa na becie — centralna część kultury hip‑hop.",
    punk: "Punk to szybki, surowy rock lat 70. i kultura: krótkie utwory, DIY i antysystemowy nastawienie.",
    phonk: "Phonk łączy hip‑hop z sample’ami Memphis rap lat 90.: cowbelle, zniekształcony bas i lo‑fi szorstkość.",
    hyperpop: "Hyperpop to ruch electronic‑pop lat 2010.: maksymalizm, połysk, pitch‑shifted wokale i chaotyczna produkcja internetowa.",
    vaporwave: "Vaporwave to mikrogatunek internetowy początku lat 2010.: posiekane, spowolnione sample lounge i korporacyjnego nastroju lat 80.–90.",
    shoegaze: "Shoegaze to alternative rock z rozmytym wokalem, ścianami efektów gitarowych i immersyjną fakturą.",
    synthwave: "Synthwave to retro elektronika przywodząca na myśl ścieżki filmowe i gier lat 80.",
    trap: "Trap to hip‑hop z wyraźnymi hi‑hatami, grzmotnymi 808 i południowymi korzeniami USA.",
    drill: "Drill to hip‑hop z ciemnymi sliding 808 i twardą prezentacją; zaczął się w Chicago, później rozgałęził się w UK.",
    dubstep: "Dubstep to brytyjski styl muzyki tanecznej początku lat 2000.: rzadki rytm i ciężki bas.",
    "k-pop": "K‑pop to południowokoreańska muzyka popularna: wypolerowany pop, hip‑hop i elektronika plus choreografia grup idol.",
    reggae: "Reggae ukształtował się na Jamajce pod koniec lat 60.: akcenty offbeat, bas z przodu i kultura sound system.",
    "dream pop": "Dream pop lubi mglisty wokal, gitary w reverb i miękki fokus — bardziej nastrój niż ostre hooki.",
    "new wave": "New wave to pop‑rock końca lat 70. / początku lat 80. po punku: syntezatory i kanciaste gitary.",
    industrial: "Industrial wykorzystuje ścierny hałas, mechaniczne rytmy i konfrontacyjną estetykę.",
    grime: "Grime to brytyjski styl elektronika/rap początku lat 2000. ze Wschodniego Londynu.",
    "lo-fi": "Lo‑fi jako etykieta — ciepła „nieidealna” muzyka: szum taśmy, miękki beat i przytulna szorstkość.",
    afrobeats: "Afrobeats to współczesny zachodnioafrykański pop continuum: highlife, hip‑hop i taneczne rytmy.",
    amapiano: "Amapiano to południowoafrykański styl z house: bujne log‑drums i szeroki bas.",
    reggaeton: "Reggaeton łączy rytmy latynoskie z wpływami hip‑hopu i dancehallu wokół bitu dembow.",
    "drum and bass": "Drum and bass to brytyjska elektronika na szybkich breakbeatach i ciężkim basie.",
    "black metal": "Black metal to ekstremalny metal z szybkimi tempami, screamem i surowym, atmosferycznym brzmieniem.",
    breakcore: "Breakcore to ekstremalna elektronika na pociętych breakach Amen, chaotycznych editach i wysokim BPM.",
    rage: "Rage to internetowy styl bliski trapowi ze zniekształconymi 808, krzyczącymi hookami i hiperagresywną energią."
  },
  th: {
    pop: "ป็อปคือดนตรี mainstream ที่มีทำนองติดหู รูปแบบเวิร์ส-คorus และโปรดักชันสำหรับวิทยุและสตรีมมิง",
    "post-punk": "โพสต์พังก์ไปไกลกว่าพังก์: เบสมุมฉาก บรรยากาศ และ art-school หลังคลื่นโพสต์โซviet เพิ่มซินธ์เย็นและ vibe เมืองกลางคืน นี่คือแนวโปรดของผู้สร้างแอป",
    metal: "เมทัลคือสไตล์กีตาร์หนักที่เติบโตจาก hard rock และแตกแขนงเป็นหลายซับแนว",
    rock: "ร็อกคือดนตรี популярที่มีจังหวะและพลังกีตาร์ สืบทอดจาก rock and roll",
    jazz: "แจ๊z มาจาก традиция Afro-American: swing improv blue note และสไตล์ที่พัฒนา",
    techno: "เทคโน่คือดนตรีเต้นอิเล็กทรонิกส์จากดетroit: จังหวะเครื่องจักรวนซ้ำและ drive คลับยาว",
    house: "เฮาส์เกิดในชิคาโก ยุค 80: four-on-the-floor soul/vocal hook และ groove คลับ",
    ambient: "แอมbient เน้นบรรยากาศและโทนมากกว่าฟอร์มเพลงคุ้นเคย",
    "hip hop": "ฮ ip-hop คือวัฒนธรรมและดนตรีนิวยอร์กยุค 70 รอบแร็p DJing breaks และโปรดักชันสตูดิโอ",
    rap: "แร็p คือคำพูดมีสัมผัสจังหวะทับบีต — แกนกลางวัฒนธรรม hip-hop",
    punk: "พังก์คือร็อกดิบเร็วยุค 70 และวัฒนธรรม: เพลงสั้น DIY และท่าทีต่อต้านระบบ",
    phonk: "ฟonk ผสม hip-hop กับเซมเปิล Memphis rap ยุค 90 — cowbell เบสบ искажен และ lo-fi หยาบ",
    hyperpop: "Hyperpop คือขบวน electronic-pop ยุค 2010: maximalist glossy pitch-shifted vocal และโปรดักชันอินเทอร์เน็ตวุ่นวาย",
    vaporwave: "Vaporwave คือไมโครแนวอินเทอร์เน็ตต้นยุค 2010: เซมเปิล lounge และ corporate mood ยุค 80–90 ที่สับและช้าลง",
    shoegaze: "Shoegaze คือ alternative rock ด้วย vocal ที่ละลาย กำแพงเอฟเฟกต์กีตาร์ และพื้นผิวดื่มด่ำ",
    synthwave: "Synthwave คืออิเล็กทรонิกส์ย้อนยุคที่ชวนนึกถึงซาวด์แทร็กหนังและเกมยุค 80",
    trap: "Trap คือ hip-hop ด้วย hi-hat ชัด 808 กระหึ่ม และรากใต้สหรัฐ",
    drill: "Drill คือ hip-hop ด้วย 808 สไลด์มืดและการส่งเสียงแข็ง เริ่มชิคาโกแล้วแตกไป UK",
    dubstep: "Dubstep คือสไตล์เต้นอิเล็กทรонิกส์อังกฤษต้นยุค 2000: จังหวะเว้นช่องและเบสหนัก",
    "k-pop": "K-pop คือดนตรี популярเกาหลีใต้: pop เงา hip-hop อิเล็กทรонิกส์ และการเต้นของ idol",
    reggae: "เรggae ก่อตัวใน Jamaica ปลายยุค 60: offbeat accent เบสนำ และวัฒนธรรม sound system",
    "dream pop": "Dream pop ชอบ vocal หมอก กีตาร์ reverb และโฟกus นุ่ม — อารมณ์มากกว่า hook คม",
    "new wave": "New wave คือ pop-rock ปลาย 70/ต้น 80 หลัง punk: synth และกีตาร์มุมฉาก",
    industrial: "Industrial ใช้เสียงรบกวนขัด จังหวะเครื่องจักร และสุนทรีย์เผชิญหน้า",
    grime: "Grime คือสไตล์อิเล็กทรонิกส์/แร็p อังกฤษต้นยุค 2000 จาก East London",
    "lo-fi": "Lo-fi เป็น label — ดนตรีอบอุ่นไม่สมบูรณ์: เสียงเทป บีตนุ่ม และความหยาบ cozy",
    afrobeats: "Afrobeats คือต่อเนื่องป็อปแอฟริกาตะวันตกสมัยใหม่: highlife hip-hop และจังหวะเต้น",
    amapiano: "Amapiano คือสไตล์แอฟริกาใต้จาก house: log-drums หรูและเบสกว้าง",
    reggaeton: "Reggaeton ผสมจังหวะลatin กับ hip-hop และ dancehall รอบ dembow",
    "drum and bass": "Drum and bass คืออิเล็กทรонิกส์อังกฤษบน breakbeat เร็วและเบสหนัก",
    "black metal": "Black metal คือ extreme metal จังหวะเร็ว scream และเสียงดิบบรรยากาศ",
    breakcore: "Breakcore คืออิเล็กทรонิกส์สุดขั้วบน Amen break สับ edit วุ่นวาย และ BPM สูง",
    rage: "Rage คือสไตล์อินเทอร์เน็ตใกล้ trap ด้วย 808 บ искажен hook ตะโกน และพลัง hyper-aggressive"
  },
  zh: {
    pop: "Pop 是主流流行音乐，拥有 catchy 旋律、主副歌形式，以及面向 radio 与 streaming 的制作。",
    "post-punk": "后朋克超越朋克：棱角 bass、氛围与 art-school 边缘。后苏联浪潮加入 cold synth 与深夜城市 mood。这是应用创作者最喜欢的类型。",
    metal: "Metal 是从 hard rock 发展出的 heavy guitar 风格，并分裂为众多子类型。",
    rock: "Rock 是以 rhythmic drive 与 guitar 能量为基础的流行音乐，源自 rock and roll。",
    jazz: "Jazz 源于非裔美国传统：swing、即兴、蓝调音与不断演化的风格。",
    techno: "Techno 是底特律 electronic dance music：循环 machine 节奏与 long club drive。",
    house: "House 诞生于 1980 年代芝加哥：four-on-the-floor、 soul/vocal hook 与 club groove。",
    ambient: "Ambient 将氛围与音色置于 familiar song form 之上。",
    "hip hop": "Hip-hop 是 1970 年代纽约围绕 rapping、DJing、breaks 与 studio production 的文化与音乐。",
    rap: "Rap 是 beat 上的 rhythmic rhymed speech — hip-hop 文化的核心。",
    punk: "Punk 是 1970 年代 fast raw rock 与文化：短歌、DIY 与反体制态度。",
    phonk: "Phonk 将 hip-hop 与 1990 年代 Memphis rap sample 混合 — cowbell、失真 bass 与 lo-fi grit。",
    hyperpop: "Hyperpop 是 2010 年代 electronic-pop 运动：maximalist、glossy、pitch-shifted vocal 与 chaotic internet-native production。",
    vaporwave: "Vaporwave 是 2010 年代初 internet microgenre：切碎、 slowed lounge 与 1980–90 年代 corporate mood sample。",
    shoegaze: "Shoegaze 是 alternative rock，带有 washed-out vocal、guitar 效果音墙与 immersive texture。",
    synthwave: "Synthwave 是让人联想到 1980 年代电影与游戏配乐的 retro electronic music。",
    trap: "Trap 是 hip-hop，带有清晰 hi-hat、轰鸣 808 与美国南部根源。",
    drill: "Drill 是 hip-hop，带有 dark sliding 808 与 tight delivery；始于芝加哥，后在 UK 分支。",
    dubstep: "Dubstep 是 2000 年代初英国 electronic dance style：sparse rhythm 与 heavy bass。",
    "k-pop": "K-pop 是韩国 popular music：polished pop、hip-hop、electronics 加上 idol 团体 choreography。",
    reggae: "Reggae 于 1960 年代末在牙买加形成：offbeat accent、bass 在前与 sound-system 文化。",
    "dream pop": "Dream pop 偏爱 hazy vocal、reverbed guitar 与 soft focus — mood 重于 sharp hook。",
    "new wave": "New wave 是 1970 年代末/1980 年代初 punk 之后的 pop-rock：synth 与 angular guitar。",
    industrial: "Industrial 使用 abrasive noise、mechanical rhythm 与 confrontational aesthetics。",
    grime: "Grime 是 2000 年代初来自 East London 的英国 electronic/rap style。",
    "lo-fi": "Lo-fi 作为标签 — warm「imperfect」音乐：tape hiss、soft beat 与 cozy grit。",
    afrobeats: "Afrobeats 是当代 West African pop continuum：highlife、hip-hop 与 dance rhythm。",
    amapiano: "Amapiano 是源自 house 的南非 style：lush log-drums 与 wide bass。",
    reggaeton: "Reggaeton 将 Latin rhythm 与 hip-hop、dancehall influence 围绕 dembow beat 结合。",
    "drum and bass": "Drum and bass 是 fast breakbeat 与 heavy bass 上的英国 electronics。",
    "black metal": "Black metal 是 extreme metal，带有 fast tempo、scream 与 raw atmospheric sound。",
    breakcore: "Breakcore 是 extreme electronics，基于 chopped Amen break、chaotic edit 与 high BPM。",
    rage: "Rage 是 trap-adjacent internet style，带有 distorted 808、yelling hook 与 hyper-aggressive energy。"
  }
}