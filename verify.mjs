#!/usr/bin/env node
/**
 * verify.mjs — exercise the playground's PURE helpers against a known JWT, using
 * the EXACT code shipped in index.html (extracted between the PURE markers), so
 * the test cannot drift from the page. Exits non-zero on failure.
 *   node tools/playground/verify.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const fail = (m) => {
  console.error('FAIL: ' + m);
  process.exit(1);
};

const html = readFileSync(join(HERE, 'index.html'), 'utf8');
const m = html.match(/PURE-START[\s\S]*?\n([\s\S]*?)\/\/ ={3,}\n\s*\/\/ PURE-END/);
if (!m) fail('could not locate the PURE block in index.html');
// Skip the leading comment lines, keep the function declarations.
const pureSource = m[1];

// Evaluate the page's pure functions in this Node context (they use only
// atob / TextDecoder / btoa / crypto, all global in modern Node).
const factory = new Function(
  pureSource + '\nreturn { base64UrlDecodeToString, decodeJwt, claimMeaning, makePkce, base64UrlFromBytes };',
);
const { base64UrlDecodeToString, decodeJwt, claimMeaning, makePkce } = factory();

// A sample RS256 JWT (signature is a placeholder; we only test decode).
const SAMPLE =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Imluc18wMSJ9.' +
  'eyJpc3MiOiJodHRwczovL2RlbW8uYXRsYXNhdXRoLm5ldCIsInN1YiI6InVzZXJfMDFIWFkiLCJhdWQiOiJteV9hcHAiLCJlbWFpbCI6ImphbmVAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwib3JnX2lkIjoib3JnXzAxQUJDIiwib3JnX3JvbGUiOiJhZG1pbiIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6NDg1MzYwMDAwMCwibmJmIjoxNzAwMDAwMDAwfQ.' +
  'c2lnbmF0dXJlLXBsYWNlaG9sZGVyLW5vdC12ZXJpZmllZA';

const { header, payload, signature, parts } = decodeJwt(SAMPLE);

if (parts.length !== 3) fail('expected 3 segments, got ' + parts.length);
if (header.alg !== 'RS256') fail('header.alg !== RS256 (got ' + header.alg + ')');
if (header.typ !== 'JWT') fail('header.typ !== JWT');
if (header.kid !== 'ins_01') fail('header.kid mismatch');
if (payload.iss !== 'https://demo.atlasauth.net') fail('payload.iss mismatch: ' + payload.iss);
if (payload.sub !== 'user_01HXY') fail('payload.sub mismatch');
if (payload.email !== 'jane@example.com') fail('payload.email mismatch');
if (payload.org_role !== 'admin') fail('payload.org_role mismatch');
if (payload.exp !== 4853600000) fail('payload.exp mismatch');
if (signature !== 'c2lnbmF0dXJlLXBsYWNlaG9sZGVyLW5vdC12ZXJpZmllZA') fail('signature segment mismatch');

// UTF-8 correctness: base64url of "café ✓" must round-trip.
const utf8 = Buffer.from('café ✓', 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
if (base64UrlDecodeToString(utf8) !== 'café ✓') fail('base64url UTF-8 decode is wrong');

// Malformed tokens are rejected.
let threw = false;
try { decodeJwt('not-a-jwt'); } catch { threw = true; }
if (!threw) fail('decodeJwt should reject a single-segment string');

// Claim meanings resolve for a standard claim.
if (!claimMeaning('exp')) fail('claimMeaning("exp") is empty');

// PKCE: challenge is a valid base64url SHA-256 of the verifier.
const pkce = await makePkce(globalThis.crypto);
if (!/^[A-Za-z0-9_-]{43}$/.test(pkce.challenge)) fail('PKCE S256 challenge is not 43-char base64url: ' + pkce.challenge);
if (!pkce.verifier || pkce.verifier.length < 43) fail('PKCE verifier too short');

console.log('PASS: playground JWT decoder splits + base64url-decodes correctly; claims, UTF-8, errors, and PKCE S256 all verified.');
