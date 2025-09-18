// Simple intent extraction

export function parseIntent(text) {
  const t = (text || '').toLowerCase().trim()
  if (!t) return { intent: 'none' }
  if (/open (the )?camera|start (the )?camera|camera on/.test(t)) return { intent: 'open_camera' }
  if (/close (the )?camera|stop (the )?camera|camera off|hide camera/.test(t)) return { intent: 'close_camera' }
  if (/retake|take again|try again/.test(t)) return { intent: 'retake' }
  // tolerate common misspellings for text/color
  if (/read( the)? (text|txet|txt)|\btext\b( please)?/.test(t)) return { intent: 'read_text' }
  if (/identify( the)? colou?r|what( is)? the colou?r|colou?r/.test(t)) return { intent: 'identify_color' }
  if (/identify( the)? currency|currency|money|note/.test(t)) return { intent: 'identify_currency' }
  if (/^(capture|take|shot|photo)/.test(t) || /\b(capture|photo|picture|snap)\b/.test(t)) return { intent: 'capture' }
  if (/help|what can you do|how to/.test(t)) return { intent: 'help' }
  if (/repeat|again/.test(t)) return { intent: 'repeat' }
  if (/describe|color|colour/.test(t)) return { intent: 'describe' }
  if (/settings|speed|rate|voice|language/.test(t)) return { intent: 'settings' }
  return { intent: 'unknown', text: t }
}
