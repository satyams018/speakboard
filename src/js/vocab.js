// Built-in vocabulary for SpeakBoard.
//
// Every word and phrase has a label in each supported language. Words are combined
// "telegraphically" (I + want + water), which is normal for picture-based AAC.
// Quick phrases are full, grammatical sentences that speak in one tap.
//
// A label is either a string or { m, f } when the word changes with the speaker's
// gender (for example Hindi "थका हुआ" / "थकी हुई", Spanish "cansado" / "cansada").
// The "word forms" setting picks which one is shown and spoken.
//
// NOTE: Hindi and Spanish text should be reviewed by a native speaker before release.

export const LANGUAGES = {
  en: { name: "English", speechLang: "en-US" },
  hi: { name: "हिन्दी", speechLang: "hi-IN" },
  es: { name: "Español", speechLang: "es-ES" },
};

export const LANGUAGE_CODES = Object.keys(LANGUAGES);

export const CATEGORIES = [
  { id: "quick", emoji: "⚡", label: { en: "Quick", hi: "तुरंत", es: "Rápido" } },
  { id: "recent", emoji: "🕘", label: { en: "Recent", hi: "हाल के", es: "Recientes" } },
  { id: "core", emoji: "⭐", label: { en: "Core", hi: "मुख्य", es: "Básico" } },
  { id: "needs", emoji: "🆘", label: { en: "Needs", hi: "ज़रूरतें", es: "Necesidades" } },
  { id: "feelings", emoji: "😊", label: { en: "Feelings", hi: "भावनाएँ", es: "Emociones" } },
  { id: "people", emoji: "👪", label: { en: "People", hi: "लोग", es: "Personas" } },
  { id: "food", emoji: "🍽️", label: { en: "Food", hi: "खाना", es: "Comida" } },
  { id: "actions", emoji: "🏃", label: { en: "Actions", hi: "काम", es: "Acciones" } },
  { id: "places", emoji: "🏠", label: { en: "Places", hi: "जगहें", es: "Lugares" } },
  { id: "mine", emoji: "📷", label: { en: "My buttons", hi: "मेरे बटन", es: "Mis botones" } },
];

export const GENDERS = ["m", "f"];

/** A label that depends on the speaker's gender. */
const g = (m, f) => ({ m, f });

const w = (id, category, emoji, en, hi, es) => ({ id, category, emoji, label: { en, hi, es } });

export const WORDS = [
  // Core words: small, high-frequency words that build most sentences.
  w("i", "core", "🙋", "I", "मैं", "yo"),
  w("you", "core", "👉", "you", "आप", "tú"),
  w("want", "core", "🤲", "want", "चाहिए", "quiero"),
  w("need", "core", "❗", "need", "ज़रूरत", "necesito"),
  w("like", "core", "👍", "like", "पसंद", "me gusta"),
  w("dont-like", "core", "👎", "don't like", "पसंद नहीं", "no me gusta"),
  w("more", "core", "➕", "more", "और", "más"),
  w("stop", "core", "✋", "stop", "रुको", "para"),
  w("go", "core", "➡️", "go", "जाना", "ir"),
  w("help", "core", "🆘", "help", "मदद", "ayuda"),
  w("yes", "core", "✅", "yes", "हाँ", "sí"),
  w("no", "core", "❌", "no", "नहीं", "no"),
  w("please", "core", "🙏", "please", "कृपया", "por favor"),
  w("thank-you", "core", "💐", "thank you", "धन्यवाद", "gracias"),
  w("finished", "core", "🏁", "finished", "हो गया", "terminé"),
  w("am", "core", "🟰", "am", "हूँ", "estoy"),

  // Needs
  w("water", "needs", "💧", "water", "पानी", "agua"),
  w("food", "needs", "🍛", "food", "खाना", "comida"),
  w("toilet", "needs", "🚻", "toilet", "शौचालय", "baño"),
  w("sleep", "needs", "😴", "sleep", "सोना", "dormir"),
  w("medicine", "needs", "💊", "medicine", "दवाई", "medicina"),
  w("pain", "needs", "🤕", "pain", "दर्द", "dolor"),
  w("hot", "needs", "🥵", "hot", "गर्मी", "calor"),
  w("cold", "needs", "🥶", "cold", "ठंड", "frío"),
  w("change-clothes", "needs", "👕", "change clothes", "कपड़े बदलना", "cambiarme de ropa"),

  // Feelings
  w("happy", "feelings", "😀", "happy", "खुश", "feliz"),
  w("sad", "feelings", "😢", "sad", "उदास", "triste"),
  w("angry", "feelings", "😠", "angry", "गुस्सा", g("enojado", "enojada")),
  w("scared", "feelings", "😨", "scared", "डर", g("asustado", "asustada")),
  w("tired", "feelings", "🥱", "tired", g("थका हुआ", "थकी हुई"), g("cansado", "cansada")),
  w("sick", "feelings", "🤢", "sick", "बीमार", g("enfermo", "enferma")),
  w("bored", "feelings", "😐", "bored", "बोर", g("aburrido", "aburrida")),

  // People
  w("mother", "people", "👩", "mother", "माँ", "mamá"),
  w("father", "people", "👨", "father", "पापा", "papá"),
  w("brother", "people", "👦", "brother", "भाई", "hermano"),
  w("sister", "people", "👧", "sister", "बहन", "hermana"),
  w("friend", "people", "🧑‍🤝‍🧑", "friend", "दोस्त", "amigo"),
  w("doctor", "people", "🧑‍⚕️", "doctor", "डॉक्टर", "médico"),
  w("teacher", "people", "🧑‍🏫", "teacher", "शिक्षक", "maestro"),

  // Food and drink
  w("rice", "food", "🍚", "rice", "चावल", "arroz"),
  w("bread", "food", "🫓", "bread", "रोटी", "pan"),
  w("milk", "food", "🥛", "milk", "दूध", "leche"),
  w("fruit", "food", "🍎", "fruit", "फल", "fruta"),
  w("tea", "food", "🍵", "tea", "चाय", "té"),
  w("biscuit", "food", "🍪", "biscuit", "बिस्कुट", "galleta"),
  w("juice", "food", "🧃", "juice", "जूस", "jugo"),

  // Actions
  w("eat", "actions", "😋", "eat", "खाना", "comer"),
  w("drink", "actions", "🥤", "drink", "पीना", "beber"),
  w("play", "actions", "⚽", "play", "खेलना", "jugar"),
  w("watch-tv", "actions", "📺", "watch TV", "टीवी देखना", "ver la tele"),
  w("wash", "actions", "🧼", "wash", "धोना", "lavar"),
  w("sit", "actions", "🪑", "sit", "बैठना", "sentarme"),
  w("walk", "actions", "🚶", "walk", "चलना", "caminar"),
  w("hug", "actions", "🤗", "hug", "गले लगाना", "abrazo"),

  // Places
  w("home", "places", "🏠", "home", "घर", "casa"),
  w("outside", "places", "🌳", "outside", "बाहर", "afuera"),
  w("school", "places", "🏫", "school", "स्कूल", "escuela"),
  w("hospital", "places", "🏥", "hospital", "अस्पताल", "hospital"),
  w("bed", "places", "🛏️", "bed", "बिस्तर", "cama"),
];

const p = (id, emoji, en, hi, es) => ({ id, category: "quick", emoji, label: { en, hi, es } });

// Quick phrases: whole sentences for urgent or very common messages.
export const PHRASES = [
  p("phrase-help", "🆘", "I need help", "मुझे मदद चाहिए", "Necesito ayuda"),
  p("phrase-toilet", "🚻", "I need the toilet", "मुझे शौचालय जाना है", "Necesito ir al baño"),
  p("phrase-pain", "🤕", "I am in pain", "मुझे दर्द हो रहा है", "Me duele"),
  p("phrase-thirsty", "💧", "I am thirsty", "मुझे प्यास लगी है", "Tengo sed"),
  p("phrase-hungry", "🍛", "I am hungry", "मुझे भूख लगी है", "Tengo hambre"),
  p(
    "phrase-tired",
    "😴",
    "I am tired, I want to rest",
    g("मैं थक गया हूँ, आराम करना है", "मैं थक गई हूँ, आराम करना है"),
    g("Estoy cansado, quiero descansar", "Estoy cansada, quiero descansar"),
  ),
  p("phrase-wait", "⏳", "Please wait", "कृपया रुकिए", "Espera, por favor"),
  p("phrase-not-understand", "🤔", "I don't understand", "मुझे समझ नहीं आया", "No entiendo"),
  p("phrase-again", "🔁", "Please say that again", "कृपया फिर से बोलिए", "Repítelo, por favor"),
  p("phrase-love", "❤️", "I love you", g("मैं आपसे प्यार करता हूँ", "मैं आपसे प्यार करती हूँ"), "Te quiero"),
  p("phrase-yes", "✅", "Yes", "हाँ", "Sí"),
  p("phrase-no", "❌", "No", "नहीं", "No"),
];

// Every built-in item, indexed by id.
export const BUILT_IN = [...PHRASES, ...WORDS];
export const BUILT_IN_BY_ID = new Map(BUILT_IN.map((item) => [item.id, item]));

// Starter sentences (as word ids) that seed next-word suggestions before the
// person has any history of their own.
export const STARTER_SENTENCES = [
  ["i", "want", "water"],
  ["i", "want", "food"],
  ["i", "want", "more"],
  ["i", "want", "go", "home"],
  ["i", "want", "go", "outside"],
  ["i", "want", "sleep"],
  ["i", "want", "mother"],
  ["i", "need", "toilet"],
  ["i", "need", "help"],
  ["i", "need", "medicine"],
  ["i", "am", "tired"],
  ["i", "am", "happy"],
  ["i", "am", "sad"],
  ["i", "am", "hot"],
  ["i", "am", "cold"],
  ["i", "like", "tea"],
  ["i", "dont-like", "rice"],
  ["more", "water", "please"],
  ["more", "food", "please"],
  ["want", "milk"],
  ["want", "play"],
  ["go", "outside"],
  ["go", "home"],
  ["stop", "please"],
  ["help", "please"],
  ["you", "help"],
  ["thank-you"],
  ["finished"],
];
