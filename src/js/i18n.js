// Interface text in each supported language. Falls back to English.

const STRINGS = {
  en: {
    speak: "Speak",
    undo: "Undo",
    clear: "Clear",
    next: "Next",
    emptyStrip: "Tap pictures to build a sentence",
    settings: "Settings",
    caregiver: "Caregiver",
    holdForCaregiver: "Hold for 1 second to open caregiver tools",
    testMode: "Test mode",
    language: "Language",
    buttonSize: "Button size",
    speakOnTap: "Speak each picture when tapped",
    voiceRate: "Speech speed",
    close: "Close",
    noVoice:
      "This device has no {lang} voice. Words are shown on screen. A caregiver can record a voice for any button.",
    lastMessage: "Last message: {taps} taps, {seconds} s",
    lastMessageOne: "Last message: 1 tap, {seconds} s",
    recentEmpty: "Sentences you speak will appear here, ready to say again with one tap.",
    help: "Help",
    stopAlarm: "Stop",
    vibrate: "Vibrate when a picture is tapped",
    sizeSmall: "Small",
    sizeMedium: "Medium",
    sizeLarge: "Large",
    wordForms: "Word forms",
    male: "Male (he)",
    female: "Female (she)",
    testRunning: "A test is running. Use Stop test to end it.",
    offlineReady: "Ready to use offline",
    noCustomButtons: "No buttons yet. A caregiver can add photos of real people, food and places.",
  },
  hi: {
    speak: "बोलो",
    undo: "वापस",
    clear: "मिटाओ",
    next: "अगला",
    emptyStrip: "वाक्य बनाने के लिए चित्र दबाएँ",
    settings: "सेटिंग्स",
    caregiver: "देखभालकर्ता",
    holdForCaregiver: "देखभालकर्ता टूल खोलने के लिए 1 सेकंड दबाए रखें",
    testMode: "टेस्ट मोड",
    language: "भाषा",
    buttonSize: "बटन का आकार",
    speakOnTap: "दबाने पर हर चित्र बोलो",
    voiceRate: "बोलने की गति",
    close: "बंद करें",
    noVoice:
      "इस डिवाइस में {lang} आवाज़ नहीं है। शब्द स्क्रीन पर दिखेंगे। देखभालकर्ता किसी भी बटन के लिए आवाज़ रिकॉर्ड कर सकते हैं।",
    lastMessage: "पिछला संदेश: {taps} टैप, {seconds} सेकंड",
    lastMessageOne: "पिछला संदेश: 1 टैप, {seconds} सेकंड",
    recentEmpty: "आप जो वाक्य बोलेंगे, वे यहाँ दिखेंगे और एक टैप में फिर से बोले जा सकेंगे।",
    help: "मदद",
    stopAlarm: "रोकें",
    vibrate: "चित्र दबाने पर कंपन",
    sizeSmall: "छोटा",
    sizeMedium: "मध्यम",
    sizeLarge: "बड़ा",
    wordForms: "शब्दों का रूप",
    male: "पुरुष (थका हुआ)",
    female: "महिला (थकी हुई)",
    testRunning: "टेस्ट चल रहा है। रोकने के लिए Stop test दबाएँ।",
    offlineReady: "ऑफ़लाइन इस्तेमाल के लिए तैयार",
    noCustomButtons: "अभी कोई बटन नहीं। देखभालकर्ता असली लोगों, खाने और जगहों की फ़ोटो जोड़ सकते हैं।",
  },
  es: {
    speak: "Hablar",
    undo: "Deshacer",
    clear: "Borrar",
    next: "Siguiente",
    emptyStrip: "Toca imágenes para formar una frase",
    settings: "Ajustes",
    caregiver: "Cuidador",
    holdForCaregiver: "Mantén pulsado 1 segundo para abrir las herramientas del cuidador",
    testMode: "Modo prueba",
    language: "Idioma",
    buttonSize: "Tamaño de botones",
    speakOnTap: "Decir cada imagen al tocarla",
    voiceRate: "Velocidad de voz",
    close: "Cerrar",
    noVoice:
      "Este dispositivo no tiene voz en {lang}. Las palabras se muestran en pantalla. Un cuidador puede grabar una voz para cualquier botón.",
    lastMessage: "Último mensaje: {taps} toques, {seconds} s",
    lastMessageOne: "Último mensaje: 1 toque, {seconds} s",
    recentEmpty: "Las frases que digas aparecerán aquí para repetirlas con un toque.",
    help: "Ayuda",
    stopAlarm: "Parar",
    vibrate: "Vibrar al tocar una imagen",
    sizeSmall: "Pequeño",
    sizeMedium: "Mediano",
    sizeLarge: "Grande",
    wordForms: "Forma de las palabras",
    male: "Masculino (cansado)",
    female: "Femenino (cansada)",
    testRunning: "Hay una prueba en curso. Usa Stop test para terminarla.",
    offlineReady: "Listo para usar sin conexión",
    noCustomButtons:
      "Aún no hay botones. Un cuidador puede añadir fotos de personas, comida y lugares reales.",
  },
};

/**
 * Look up an interface string and fill in {placeholders}.
 * @param {string} lang language code
 * @param {string} key string key
 * @param {Record<string, string|number>} [vars] placeholder values
 */
export function t(lang, key, vars = {}) {
  const template = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

export const STRING_KEYS = Object.keys(STRINGS.en);
export const STRING_LANGS = Object.keys(STRINGS);
