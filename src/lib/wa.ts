// wa.me click-to-chat: opens WhatsApp on the phone with the text ready; Tal presses send himself.
export function waLink(phone: string | null | undefined, text: string) {
  const d = String(phone ?? '').replace(/\D/g, '');
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}
