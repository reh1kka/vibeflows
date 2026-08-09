import type { Locale } from '../i18n'

export type LangBlurb = {
  text: string
  source?: string
}

/** Blurb entry: byLang[locale] or legacy { text, lang }. */
export type WikiBlurb = {
  text?: string
  lang?: string
  source?: string
  byLang?: Partial<Record<Locale, LangBlurb>>
}

export type FallbackParts = {
  open: string[]
  vibe: string[]
  peopleMany: (names: string) => string
  peopleOne: (name: string, track?: string | null) => string
  peopleNone: string
  nearMany: (names: string) => string
  nearOne: (name: string) => string
  favorite: string
}

export const FALLBACKS: Record<Locale, FallbackParts> = {
  ru: {
    open: [
      '«{name}» — жанр Spotify со своей сценой, привычками слушателей и узнаваемым звуковым кодом.',
      'Жанр «{name}» выделяют отдельно: у него свои ориентиры, темп и атмосфера, не просто синоним соседа.',
      'Если включить «{name}», обычно сразу слышно, почему жанр живёт своей жизнью в каталоге.',
    ],
    vibe: [
      'Чаще это про настроение и характерные приёмы записи, а не про строгие правила гармонии.',
      'Слушатели цепляются за тембр, ритм и подачу — то, что отличает сцену на слух за первые секунды.',
      'Плейлисты жанра собирают похожие треки вокруг одного вайба, даже если артисты из разных городов.',
    ],
    peopleMany: (n) => `Ориентиры: ${n}.`,
    peopleOne: (n, t) => `Ориентир: ${n}${t ? ` — «${t}»` : ''}.`,
    peopleNone: 'Лучший способ понять — открыть плейлист жанра и пройтись ушами.',
    nearMany: (n) => ` Основные исполнители: ${n}.`,
    nearOne: (n) => ` Основной исполнитель: ${n}.`,
    favorite: ' Это любимый жанр создателя приложения.',
  },
  en: {
    open: [
      '“{name}” is a Spotify tag with its own scene, listener habits and a recognizable sonic code.',
      'The “{name}” genre stands apart: its own cues, tempo and mood—not just a synonym of a neighbor.',
      'Play “{name}” and you usually hear why the tag lives as its own shelf in the catalog.',
    ],
    vibe: [
      'It is more about mood and recording habits than strict harmony rules.',
      'Listeners lock onto timbre, rhythm and delivery—what makes the scene obvious in the first seconds.',
      'Genre playlists gather similar tracks around one vibe, even when artists are from different cities.',
    ],
    peopleMany: (n) => `Reference artists: ${n}.`,
    peopleOne: (n, t) => `Reference: ${n}${t ? ` — “${t}”` : ''}.`,
    peopleNone: 'Best way to learn it: open the genre playlist and listen.',
    nearMany: (n) => ` Main artists: ${n}.`,
    nearOne: (n) => ` Main artist: ${n}.`,
    favorite: ' This is the app creator’s favorite genre.',
  },
  uk: {
    open: [
      '«{name}» — ярлик Spotify зі своєю сценою, звичками слухачів і впізнаваним звуковим кодом.',
      'Жанр «{name}» виділяють окремо: свої орієнтири, темп і атмосфера, не просто синонім сусіда.',
      'Якщо увімкнути «{name}», зазвичай одразу чутно, чому ярлик живе окремим життям у каталозі.',
    ],
    vibe: [
      'Частіше це про настрій і характерні прийоми запису, а не про суворі правила гармонії.',
      'Слухачі чіпляються за тембр, ритм і подачу — те, що відрізняє сцену на слух за перші секунди.',
      'Плейлисти жанру збирають схожі треки навколо одного вайбу, навіть якщо артисти з різних міст.',
    ],
    peopleMany: (n) => `Орієнтири: ${n}.`,
    peopleOne: (n, t) => `Орієнтир: ${n}${t ? ` — «${t}»` : ''}.`,
    peopleNone: 'Найкращий спосіб зрозуміти — відкрити плейлист жанру і послухати.',
    nearMany: (n) => ` Часто поруч: ${n}.`,
    nearOne: (n) => ` Орієнтир: ${n}.`,
    favorite: ' Це улюблений жанр творця застосунку.',
  },
  pl: {
    open: [
      '„{name}” to tag Spotify z własną sceną, nawykami słuchaczy i rozpoznawalnym kodem brzmienia.',
      'Gatunek „{name}” wyróżnia się osobno: własne tropy, tempo i atmosfera — nie tylko synonim sąsiada.',
      'Włącz „{name}”, a zwykle od razu słychać, czemu tag żyje własnym życiem w katalogu.',
    ],
    vibe: [
      'Częściej chodzi o nastrój i nawyki nagraniowe niż o sztywne reguły harmonii.',
      'Słuchacze łapią barwę, rytm i sposób podania — to, co wyróżnia scenę w pierwszych sekundach.',
      'Playlisty gatunku zbierają podobne utwory wokół jednego vibe’u, nawet gdy artyści są z różnych miast.',
    ],
    peopleMany: (n) => `Punkty odniesienia: ${n}.`,
    peopleOne: (n, t) => `Punkt odniesienia: ${n}${t ? ` — „${t}”` : ''}.`,
    peopleNone: 'Najlepiej otworzyć playlistę gatunku i posłuchać.',
    nearMany: (n) => ` Często obok: ${n}.`,
    nearOne: (n) => ` Punkt odniesienia: ${n}.`,
    favorite: ' To ulubiony gatunek twórcy aplikacji.',
  },
  th: {
    open: [
      '“{name}” เป็นแท็ก Spotify ที่มีซีนของตัวเอง นิสัยผู้ฟัง และรหัสเสียงที่จดจำได้',
      'แนว “{name}” ถูกแยกออกมา: มีจุดสังเกต จังหวะ และบรรยากาศของตัวเอง ไม่ใช่แค่คำพ้องของแนวข้างเคียง',
      'ลองเปิด “{name}” แล้วมักจะได้ยินทันทีว่าทำไมแท็กนี้ถึงมีชีวิตของตัวเองในแคตตาล็อก',
    ],
    vibe: [
      'มักเกี่ยวกับอารมณ์และวิธีอัดเสียงมากกว่ากฎฮาร์โมนีที่เข้มงวด',
      'ผู้ฟังจับโทน จังหวะ และการร้อง/เล่น — สิ่งที่ทำให้ซีนชัดตั้งแต่ไม่กี่วินาทีแรก',
      'เพลย์ลิสต์แนวรวมเพลงคล้ายกันรอบ ๆ ไวบ์เดียว แม้ศิลปินจะมาจากคนละเมือง',
    ],
    peopleMany: (n) => `ศิลปินอ้างอิง: ${n}`,
    peopleOne: (n, t) => `อ้างอิง: ${n}${t ? ` — “${t}”` : ''}`,
    peopleNone: 'วิธีที่ดีที่สุดคือเปิดเพลย์ลิสต์แนวแล้วฟัง',
    nearMany: (n) => ` มักอยู่ใกล้: ${n}`,
    nearOne: (n) => ` อ้างอิง: ${n}`,
    favorite: ' นี่คือแนวโปรดของผู้สร้างแอป',
  },
  zh: {
    open: [
      '“{name}” 是 Spotify 标签，有自己的场景、听歌习惯和可辨识的声音特征。',
      '“{name}” 被单独标出：有自己的线索、速度与氛围，不只是相邻流派的同义词。',
      '打开 “{name}”，通常立刻能听出这个标签为何在目录里独立存在。',
    ],
    vibe: [
      '更关乎情绪与录音习惯，而不是严格的和声规则。',
      '听众抓住音色、节奏与表达——几秒内就能听出场景的不同。',
      '流派歌单把相似曲目聚在同一氛围下，即使艺人来自不同城市。',
    ],
    peopleMany: (n) => `参考艺人：${n}。`,
    peopleOne: (n, t) => `参考：${n}${t ? ` — “${t}”` : ''}。`,
    peopleNone: '最好的方式是打开流派歌单亲自听。',
    nearMany: (n) => ` 常见相关：${n}。`,
    nearOne: (n) => ` 参考：${n}。`,
    favorite: ' 这是应用作者最爱的流派。',
  },
  es: {
    open: [
      '«{name}» es una etiqueta de Spotify con su propia escena, hábitos de escucha y un código sonoro reconocible.',
      'El género «{name}» se distingue por sí mismo: sus propias referencias, tempo y atmósfera, no solo un sinónimo del vecino.',
      'Pon «{name}» y normalmente enseguida se entiende por qué la etiqueta vive como un espacio propio en el catálogo.',
    ],
    vibe: [
      'Tiene más que ver con el estado de ánimo y los hábitos de grabación que con reglas estrictas de armonía.',
      'Los oyentes se enganchan al timbre, al ritmo y a la interpretación: lo que hace obvia la escena en los primeros segundos.',
      'Las listas del género reúnen temas parecidos en torno a un mismo vibe, aunque los artistas sean de ciudades distintas.',
    ],
    peopleMany: (n) => `Artistas de referencia: ${n}.`,
    peopleOne: (n, t) => `Referencia: ${n}${t ? ` — «${t}»` : ''}.`,
    peopleNone: 'La mejor forma de conocerlo: abre la lista del género y escucha.',
    nearMany: (n) => ` A menudo cerca: ${n}.`,
    nearOne: (n) => ` Referencia: ${n}.`,
    favorite: ' Este es el género favorito del creador de la app.',
  },
  pt: {
    open: [
      '“{name}” é uma tag do Spotify com sua própria cena, hábitos de escuta e um código sonoro reconhecível.',
      'O gênero “{name}” se destaca sozinho: suas próprias referências, andamento e clima, não apenas um sinônimo do vizinho.',
      'Toque “{name}” e normalmente dá pra ouvir na hora por que a tag vive como uma prateleira própria no catálogo.',
    ],
    vibe: [
      'Tem mais a ver com clima e hábitos de gravação do que com regras rígidas de harmonia.',
      'Os ouvintes se prendem ao timbre, ao ritmo e à entrega — o que deixa a cena óbvia nos primeiros segundos.',
      'As playlists do gênero juntam faixas parecidas em torno de um mesmo vibe, mesmo com artistas de cidades diferentes.',
    ],
    peopleMany: (n) => `Artistas de referência: ${n}.`,
    peopleOne: (n, t) => `Referência: ${n}${t ? ` — “${t}”` : ''}.`,
    peopleNone: 'Melhor forma de conhecer: abra a playlist do gênero e escute.',
    nearMany: (n) => ` Costuma aparecer perto de: ${n}.`,
    nearOne: (n) => ` Referência: ${n}.`,
    favorite: ' Este é o gênero favorito do criador do app.',
  },
  de: {
    open: [
      '„{name}“ ist ein Spotify-Tag mit eigener Szene, eigenen Hörgewohnheiten und einem wiedererkennbaren Klangcode.',
      'Das Genre „{name}“ hebt sich ab: eigene Anhaltspunkte, Tempo und Stimmung — nicht nur ein Synonym für den Nachbarn.',
      'Spiel „{name}“ ab und meist hört man sofort, warum das Tag im Katalog ein eigenes Regal bekommt.',
    ],
    vibe: [
      'Es geht eher um Stimmung und Aufnahmegewohnheiten als um strenge Harmonieregeln.',
      'Hörer:innen hängen sich an Timbre, Rhythmus und Vortrag — das, was die Szene in den ersten Sekunden erkennbar macht.',
      'Genre-Playlists sammeln ähnliche Tracks um einen Vibe herum, auch wenn die Künstler:innen aus verschiedenen Städten kommen.',
    ],
    peopleMany: (n) => `Referenzkünstler: ${n}.`,
    peopleOne: (n, t) => `Referenz: ${n}${t ? ` — „${t}“` : ''}.`,
    peopleNone: 'Am besten reinhören: die Genre-Playlist öffnen und zuhören.',
    nearMany: (n) => ` Oft in der Nähe: ${n}.`,
    nearOne: (n) => ` Referenz: ${n}.`,
    favorite: ' Das ist das Lieblingsgenre des App-Erstellers.',
  },
  ja: {
    open: [
      '「{name}」はSpotifyのタグで、独自のシーン、リスナーの習慣、そして聞き分けられる音のコードを持っています。',
      '「{name}」というジャンルは独立している。独自の目印、テンポ、ムードがあり、隣接ジャンルの単なる言い換えではない。',
      '「{name}」を再生すれば、このタグがカタログの中で独自の棚として存在する理由がすぐに聞き取れることが多い。',
    ],
    vibe: [
      '厳密なハーモニーの規則よりも、ムードと録音の癖に関わることが多い。',
      'リスナーは音色、リズム、歌い回しに耳を止める——それが最初の数秒でシーンをそれとわかるものにしている。',
      'アーティストが違う街の出身でも、ジャンルのプレイリストは同じ空気感の似た曲を集めている。',
    ],
    peopleMany: (n) => `参考アーティスト: ${n}。`,
    peopleOne: (n, t) => `参考: ${n}${t ? ` —「${t}」` : ''}。`,
    peopleNone: '知る一番の方法は、ジャンルのプレイリストを開いて聴くこと。',
    nearMany: (n) => ` よく近くにあるのは: ${n}。`,
    nearOne: (n) => ` 参考: ${n}。`,
    favorite: ' これはアプリ制作者のお気に入りのジャンルです。',
  },
}

export const ARTIST_ABOUT: Record<
  Locale,
  [(name: string, g: string) => string, (name: string, g: string) => string, (name: string, g: string) => string]
> = {
  ru: [
    (name, g) =>
      `${name} — исполнитель в зоне «${g}». В VibeFlows он всплывает как ориентир сцены: характерный тембр, узнаваемый почерк и треки, с которых удобно начать знакомство с жанром.`,
    (name, g) =>
      `Коротко о ${name}: звучит ближе к ${g}. Жанры и соседи собраны по пересечениям плейлистов — кто рядом крутится в тех же подборках.`,
    (name, g) =>
      `${name} часто оказывается в подборках ${g}. Ниже — демо топ‑треков и соседи по сцене; полный каталог всегда можно открыть в Spotify.`,
  ],
  en: [
    (name, g) =>
      `${name} is an artist in the “${g}” zone. In VibeFlows they show up as a scene landmark: a signature sound and tracks that are a good entry point.`,
    (name, g) =>
      `Short take on ${name}: closer to ${g}. Genres and neighbors come from playlist overlap—who else shows up in the same piles.`,
    (name, g) =>
      `${name} often appears in ${g} playlists. Below: demo top tracks and scene neighbors; the full catalog is always on Spotify.`,
  ],
  uk: [
    (name, g) =>
      `${name} — виконавець у зоні «${g}». В VibeFlows він з’являється як орієнтир сцени: характерний тембр і треки, з яких зручно почати.`,
    (name, g) =>
      `Коротко про ${name}: звучить ближче до ${g}. Жанри й сусіди зібрані за перетинами плейлистів.`,
    (name, g) =>
      `${name} часто трапляється в добірках ${g}. Нижче — демо топ‑треків і сусіди по сцені; повний каталог — у Spotify.`,
  ],
  pl: [
    (name, g) =>
      `${name} to artysta ze strefy „${g}”. W VibeFlows pojawia się jako punkt orientacyjny sceny: charakterystyczne brzmienie i utwory na start.`,
    (name, g) =>
      `Krótko o ${name}: bliżej ${g}. Gatunki i sąsiedzi pochodzą z przecięć playlist.`,
    (name, g) =>
      `${name} często pojawia się w playlistach ${g}. Poniżej demo top utworów i sąsiedzi sceny; pełny katalog jest na Spotify.`,
  ],
  th: [
    (name, g) =>
      `${name} เป็นศิลปินในโซน “${g}” ใน VibeFlows โผล่เป็นจุดสังเกตของซีน: โทนเสียงที่เป็นเอกลักษณ์และเพลงเริ่มต้นที่ดี`,
    (name, g) =>
      `สรุปสั้น ๆ เกี่ยวกับ ${name}: ใกล้กับ ${g} แนวและเพื่อนบ้านมาจากการทับซ้อนของเพลย์ลิสต์`,
    (name, g) =>
      `${name} มักอยู่ในเพลย์ลิสต์ ${g} ด้านล่างเป็นท็อปเดโมและเพื่อนบ้านในซีน แคตตาล็อกเต็มอยู่บน Spotify`,
  ],
  zh: [
    (name, g) =>
      `${name} 属于 “${g}” 区域。在 VibeFlows 中作为场景地标出现：标志性音色，以及适合入门的曲目。`,
    (name, g) =>
      `关于 ${name}：更接近 ${g}。流派与邻居来自歌单交叉——谁常出现在同一批歌单里。`,
    (name, g) =>
      `${name} 常出现在 ${g} 歌单中。下方是演示热门与场景邻居；完整曲库始终在 Spotify。`,
  ],
  es: [
    (name, g) =>
      `${name} es un artista en la zona «${g}». En VibeFlows aparece como referencia de la escena: un sonido característico y temas ideales para empezar.`,
    (name, g) =>
      `Resumen rápido de ${name}: más cerca de ${g}. Los géneros y vecinos vienen del cruce de listas — quién más aparece en las mismas selecciones.`,
    (name, g) =>
      `${name} aparece a menudo en listas de ${g}. Debajo: canciones top de demo y vecinos de escena; el catálogo completo siempre está en Spotify.`,
  ],
  pt: [
    (name, g) =>
      `${name} é um artista na zona “${g}”. No VibeFlows ele aparece como referência da cena: um som característico e faixas boas para começar.`,
    (name, g) =>
      `Resumo rápido de ${name}: mais perto de ${g}. Gêneros e vizinhos vêm da sobreposição de playlists — quem mais aparece nas mesmas seleções.`,
    (name, g) =>
      `${name} costuma aparecer em playlists de ${g}. Abaixo: faixas top de demo e vizinhos de cena; o catálogo completo está sempre no Spotify.`,
  ],
  de: [
    (name, g) =>
      `${name} ist Künstler:in in der Zone „${g}“. In VibeFlows taucht er/sie als Szene-Landmarke auf: ein charakteristischer Sound und Tracks, die einen guten Einstieg bieten.`,
    (name, g) =>
      `Kurz zu ${name}: näher an ${g}. Genres und Nachbarn stammen aus Playlist-Überschneidungen — wer sonst noch in denselben Sammlungen auftaucht.`,
    (name, g) =>
      `${name} taucht oft in ${g}-Playlists auf. Unten: Demo-Top-Titel und Szene-Nachbarn; der vollständige Katalog ist immer auf Spotify.`,
  ],
  ja: [
    (name, g) =>
      `${name}は「${g}」ゾーンのアーティストです。VibeFlowsではシーンの目印として現れます：特徴的なサウンドと、入り口として良い曲です。`,
    (name, g) =>
      `${name}を一言で言うと：${g}に近い。ジャンルと隣接アーティストはプレイリストの重なりから来ています——同じ選集に他に誰が出てくるか。`,
    (name, g) =>
      `${name}は${g}のプレイリストによく登場します。以下はデモのトップ曲とシーンの隣接アーティスト。完全なカタログは常にSpotifyにあります。`,
  ],
}
