// Click-to-chat: opens WhatsApp on the phone with the text ready; Tal presses send himself.
// api.whatsapp.com/send (not wa.me): wa.me's redirect re-encodes the text and breaks emoji into "�".
export function waLink(phone: string | null | undefined, text: string) {
  const d = String(phone ?? '').replace(/\D/g, '');
  return d ? `https://api.whatsapp.com/send?phone=${d}&text=${encodeURIComponent(text)}` : null;
}
