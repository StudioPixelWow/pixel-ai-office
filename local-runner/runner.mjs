#!/usr/bin/env node
// PIXEL AI OFFICE — Local Runner (runs on Tal's Mac). Outbound-only: it polls the office DB; nothing listens on a port.
// Pair once:   node local-runner/runner.mjs --pair ABCD1234
// Run:         node local-runner/runner.mjs
// Needs: Node 20+, ffmpeg + ffprobe on PATH. Session cookies / browser profiles never leave this machine.
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, homedir, hostname } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uaruggdabeyiuppcvbbi.supabase.co';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_3gZ4guS7T6jvix4mCxiZZw_KQheByuZ';
const CFG = join(homedir(), '.pixel-ai-office-runner.json');
const sb = createClient(URL, ANON, { auth: { persistSession: false } });
const call = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(`${fn}: ${error.message}`); return data; };

async function pair(code) {
  const r = await call('office_runner_pair', { p_code: code, p_name: hostname() });
  await writeFile(CFG, JSON.stringify({ token: r.token, runner_id: r.runner_id }), { mode: 0o600 });
  console.log('Paired. Token stored in', CFG);
}

async function render(task, token) {
  const id = task.task.id, lease = task.lease_token;
  const hb = (stage) => call('office_runner_report', { p_token: token, p_task: id, p_lease: lease, p_kind: 'heartbeat', p_result: { stage } });
  const deps = task.dependencies ?? [];
  const clips = deps.flatMap((d) => d.outputs?.clips ?? []).sort((a, b) => a.n - b.n);
  const story = deps.flatMap((d) => d.artifacts ?? []).find((a) => a.kind === 'storyboard')?.data?.shots ?? [];
  if (!clips.length) return call('office_runner_report', { p_token: token, p_task: id, p_lease: lease, p_kind: 'block', p_result: { blocker: 'אין מקטעים מוכנים לעריכה' } });
  const dir = await mkdtemp(join(tmpdir(), 'pao-'));
  await hb('מוריד מקטעים');
  const files = [];
  for (const c of clips) { const r = await fetch(c.url); if (!r.ok) throw new Error(`download ${c.n}: ${r.status}`); const f = join(dir, `clip${c.n}.mp4`); await writeFile(f, Buffer.from(await r.arrayBuffer())); files.push(f); }
  // subtitles (Hebrew) from storyboard captions, timed by clip durations
  let t = 0; const srt = [];
  for (const [i, c] of clips.entries()) { const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', files[i]]); const d = Number(stdout.trim()) || 5;
    const cap = story.find((s) => s.n === c.n)?.caption; if (cap) { const f = (x) => new Date(x * 1000).toISOString().substring(11, 23).replace('.', ','); srt.push(`${srt.length + 1}\n${f(t)} --> ${f(t + d)}\n${cap}\n`); } t += d; }
  await writeFile(join(dir, 'subs.srt'), srt.join('\n'));
  await writeFile(join(dir, 'list.txt'), files.map((f) => `file '${f}'`).join('\n'));
  await hb('מרנדר עם FFmpeg');
  const out = join(dir, 'final.mp4');
  const vf = `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2${srt.length ? `,subtitles=${join(dir, 'subs.srt')}:force_style='FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2'` : ''}`;
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'), '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-movflags', '+faststart', out], { maxBuffer: 1 << 26 });
  // verify the file actually opens and meets the spec before calling it done
  const { stdout: probe } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', out]);
  const p = JSON.parse(probe); const v = p.streams.find((s) => s.codec_type === 'video'); const dur = Number(p.format.duration);
  if (!v || v.width !== 1080 || v.height !== 1920 || !(dur > 1)) throw new Error(`QA failed: ${JSON.stringify(p)}`);
  await hb('מעלה את הקובץ');
  const buf = await readFile(out); const CH = 4 * 1024 * 1024; const total = Math.ceil(buf.length / CH); let blob = null, last;
  for (let i = 0; i < total; i++) { last = await call('office_runner_put_part', { p_token: token, p_task: id, p_lease: lease, p_blob: blob, p_part: i + 1, p_total: total, p_mime: 'video/mp4', p_b64: buf.subarray(i * CH, (i + 1) * CH).toString('base64') }); blob = last.blob_id; }
  await call('office_runner_report', { p_token: token, p_task: id, p_lease: lease, p_kind: 'complete', p_result: {
    outputs: { duration_s: dur, width: v.width, height: v.height, audio: p.streams.some((s) => s.codec_type === 'audio'), subtitles: srt.length },
    artifacts: [{ kind: 'video', title: `${task.content_item?.topic ?? task.task.title} · סרטון`, body: `סרטון ${dur.toFixed(1)} שנ׳, 1080×1920, כתוביות: ${srt.length}`,
      data: { manifest: { clips, subtitles: srt.length, vf }, checks: { opens: true, aspect: '9:16', duration_s: dur } }, mime: 'video/mp4', storage_path: `blob:${blob}`,
      meta: { width: v.width, height: v.height, duration_ms: Math.round(dur * 1000), sha256: last.sha256, size_bytes: last.size_bytes } }] } });
  console.log('Rendered', id, dur.toFixed(1) + 's');
}

async function loop() {
  if (!existsSync(CFG)) { console.error('Not paired. Create a pairing code in /connections and run with --pair CODE'); process.exit(1); }
  const { token } = JSON.parse(await readFile(CFG, 'utf8'));
  await run('ffmpeg', ['-version']).catch(() => { console.error('ffmpeg not found on PATH'); process.exit(1); });
  console.log('Local Runner online. Ctrl+C to stop (work waits safely in the cloud).');
  for (;;) {
    try { const task = await call('office_runner_claim', { p_token: token });
      if (task) { try { await render(task, token); } catch (e) { console.error(e); await call('office_runner_report', { p_token: token, p_task: task.task.id, p_lease: task.lease_token, p_kind: 'fail', p_result: { error: String(e.message ?? e) } }).catch(() => {}); } }
    } catch (e) { console.error(String(e.message ?? e)); }
    await new Promise((r) => setTimeout(r, 15000));
  }
}

const i = process.argv.indexOf('--pair');
if (i > 0) await pair(process.argv[i + 1]); else await loop();
